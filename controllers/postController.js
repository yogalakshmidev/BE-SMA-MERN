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
    const { body } = req.body;
    if (!body) {
      return next(new HttpError("Fill in text field and choose image", 422));
    }
    if (!req.files.image) {
      return next(new HttpError("Please choose an image", 422));
    } else {
      const { image } = req.files;
      // image should be less than 1mb
      if (image.size > 1000000) {
        return next(
          new HttpError(
            "Profile picture is too big. It should be less than 500mb",
            422
          )
        );
      }
      // rename image
      let fileName = image.name;
      fileName = fileName.split(".");
      fileName = fileName[0] + uuid() + "." + fileName[fileName.length - 1];
      await image.mv(
        path.join(__dirname, "..", "uploads", fileName),
        async (err) => {
          if (err) {
            return next(new HttpError(err));
          }
          //store image on cloudinary
          const result = await cloudinary.uploader.upload(
            path.join(__dirname, "..", "uploads", fileName),
            { resource_type: "image" }
          );

          if (!result.secure_url) {
            return next(
              new HttpError(
                "Could not upload image to cloudinary for the post",
                422
              )
            );
          }
          // save post to database
          const newPost = await PostModel.create({
            creator: req.user.id,
            body,
            image: result.secure_url,
          });

          await UserModel.findByIdAndUpdate(newPost?.creator, {
            $push: { posts: newPost?._id, profilePhoto: newPost?.profilePhoto },
          });

          res.json({ message: "New Post created", newPost });
        }
      );
    }
  } catch (error) {
    return next(new HttpError(error.response.data));
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
    const posts = await PostModel.find().sort({ createdAt: -1 });
    res.json({ message: "Get all posts", posts });
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

    res
      .json({ message: "Updated post details successfully", updatedPost })
      .status(200);
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
// get:api/posts/id/like
// Protected
const likeDislikePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(req.user.id);

    const post = await PostModel.findById(id);

    //  check if the logged in user has already liked your post
    let updatedPost;

    if (post?.likes.includes(req.user.id)) {
      updatedPost = await PostModel.findByIdAndUpdate(
        id,
        { $pull: { likes: req.user.id } },
        { new: true }
      );

      res.json({ message: `${user.fullName} disliked your post`, updatedPost });
    } else {
      updatedPost = await PostModel.findByIdAndUpdate(
        id,
        { $push: { likes: req.user.id } },
        { new: true }
      );

      res.json({ message: `${user.fullName} liked your post`, updatedPost });
    }
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Get  post for particular user
// get:api/users/:id/posts
// Protected
const getUserPosts = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const posts = await UserModel.findById(userId).populate({
      path: "posts",
      options: { sort: { createdAt: -1 } },
    });
    res.json({ message: "Get User's post", posts });
  } catch (error) {
    return next(new HttpError(error));
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
