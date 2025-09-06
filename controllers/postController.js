const mongoose = require('mongoose');
const HttpError = require("../models/errorModel");
const PostModel = require("../models/postModel");
const UserModel = require("../models/userModel");
const { v4: uuid } = require("uuid");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs");

const path = require("path");

// create post
// Post:api/posts
// Protected
const createPost = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      return next(new HttpError("User not authenticated", 401));
    }

    const { body } = req.body;
    const image = req.files?.image;

    if (!body) return next(new HttpError("Please provide post text", 422));
    if (!image) return next(new HttpError("Please choose an image", 422));
    if (image.size > 1_000_000)
      return next(new HttpError("Image must be less than 1MB", 422));

    // Rename and save locally
    const ext = image.name.split(".").pop();
    const fileName = `${uuid()}.${ext}`;
    const localPath = path.join(__dirname, "..", "uploads", fileName);

    await image.mv(localPath);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: "image",
      folder: "posts",
    });

    if (!result?.secure_url)
      return next(new HttpError("Failed to upload image to Cloudinary", 500));

    // Save post to DB
    const newPost = await PostModel.create({
      creator: req.user._id,
      body,
      image: result.secure_url,
    });

    // Update user's posts array
    await UserModel.findByIdAndUpdate(req.user._id, {
      $push: { posts: newPost._id },
    });

    // Remove local file
    fs.unlink(localPath, (err) => {
      if (err) console.error("Failed to remove local file:", err);
    });

    // Populate creator for frontend
    const populatedPost = await newPost.populate(
      "creator",
      "fullName username profilePhoto _id"
    );

    return res.status(201).json(populatedPost);
  } catch (error) {
    console.error("Error in createPost:", error.message);
    return next(new HttpError(error.message || "Server error", 500));
  }
};

// Get post by id
// get:api/posts/:id
// Protected
const getPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await PostModel.findById(id)
      .populate("creator")
      .populate({ path: "comments", options: { sort: { createdAt: -1 } } });
    res.json({ message: "Get post by id done", post });
  } catch (error) {
    return next(new HttpError(error.response.data));
  }
};

// Get all  posts
// get:api/posts
// Protected
const getPosts = async (req, res, next) => {
  try {
    const posts = await PostModel.find()
      .populate("creator", "fullName profilePhoto")
      .sort({ createdAt: -1 });
    res.status(200).json({ message: "Get all posts", posts });
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Update post
// patch:api/posts/:id
// Protected
const updatePost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const { body } = req.body;
    //  get post from db
    const post = await PostModel.findById(postId);
    // check if creator of the post is the logged in user
    if (post?.creator != req.user.id) {
      return next(
        new HttpError(
          "You can't update this post since you are not the creator",
          403
        )
      );
    }
    const updatedPost = await PostModel.findByIdAndUpdate(
      postId,
      { body },
      { new: true }
    );

    res.status(200).json({
      message: "Updated post details successfully",
      post: updatedPost,
    });
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Delete post
// delete:api/posts/:id
// Protected
const deletePost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    //  get post from db
    const post = await PostModel.findById(postId);
    // check if creator of the post is the logged in user
    if (post?.creator != req.user.id) {
      return next(
        new HttpError(
          "You can't delete this post since you are not the creator",
          403
        )
      );
    }
    const deletedPost = await PostModel.findByIdAndDelete(postId);
    await UserModel.findByIdAndUpdate(post?.creator, {
      $pull: { posts: post?._id },
    });
    res
      .json({ message: "Delete post details successfully", deletedPost })
      .status(200);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Get followings post
// get:api/posts/followings
// Protected
const getFollowingPosts = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    const posts = await PostModel.find({ creator: { $in: user?.following } });
    res.json({ message: "The Followers post data", posts, user });
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Like or dislike post
// patch: api/posts/:id/like
// Protected
const likeDislikePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await PostModel.findById(id);

    if (!post) {
      return next(new HttpError("Post not found", 404));
    }

    let updatedPost;

    if (post.likes.includes(req.user.id)) {
      // Dislike
      updatedPost = await PostModel.findByIdAndUpdate(
        id,
        { $pull: { likes: req.user.id } },
        { new: true }
      );
    } else {
      // Like
      updatedPost = await PostModel.findByIdAndUpdate(
        id,
        { $push: { likes: req.user.id } },
        { new: true }
      );
    }

    return res.status(200).json(updatedPost); //  return only the updated post
  } catch (error) {
    console.error("Error in likeDislikePost:", error);
    return next(new HttpError("Server error while liking post", 500));
  }
};

// Get  post for particular user
// get:api/users/:id/posts
// Protected

const getUserPosts = async (req, res, next) => {
  try {
    const userId = req.params.id;

    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new HttpError("Invalid user ID", 400));
    }

    const user = await UserModel.findById(userId).populate({
      path: "posts",
      options: { sort: { createdAt: -1 } },
    });

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    return res.status(200).json({
      message: "Get User's posts",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
      },
      posts: user.posts || [],
    });
  } catch (error) {
    console.log("Error in getUserPost:", error.message);
    return next(new HttpError(error.message || "Server error", 500));
  }
};

// create Bookmark
// post:api/posts/:id/:bookmark
// Protected
const createBookmark = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(req.user.id);
    const postIsBookmarked = user?.bookmarks?.includes(id);

    if (postIsBookmarked) {
      const userBookmarks = await UserModel.findByIdAndUpdate(
        req.user.id,
        { $pull: { bookmarks: id } },
        { new: true }
      );
      res.json({ message: "Post removed from bookmark", userBookmarks });
    } else {
      const userBookmarks = await UserModel.findByIdAndUpdate(
        req.user.id,
        { $push: { bookmarks: id } },
        { new: true }
      );
      res.json({ message: "Post added to bookmark", userBookmarks });
    }
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Get Bookmarks
// get:api/bookmark
// Protected
const getUserBookmarks = async (req, res, next) => {
  try {
    const userBookmarks = await UserModel.findById(req.user.id).populate({
      path: "bookmarks",
      options: { sort: { createdAt: -1 } },
    });
    res.json({ message: "Get User's post Bookmarks are", userBookmarks });
  } catch (error) {
    return next(new HttpError(error));
  }
};

module.exports = {
  createPost,
  updatePost,
  deletePost,
  getPost,
  getPosts,
  getUserPosts,
  getUserBookmarks,
  createBookmark,
  likeDislikePost,
  getFollowingPosts,
};
