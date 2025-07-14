const jwt = require("jsonwebtoken");
const HttpError = require("../models/errorModel");
const userModel = require("../models/userModel");
const UserModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const uuid = require('uuid').v4;
const fs = require('fs')
const path = require('path')
const cloudinary = require('../utils/cloudinary')


// Register User
// Post:api/user/register
// Unprotected
const registerUser = async (req, res, next) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;
    if (!fullName || !email || !password || !confirmPassword) {
      return next(new HttpError("Fill in all the fields", 422));
    }

    // make the email lowercased
    const lowercasedEmail = email.toLowerCase();
    // check db if email already exist
    const emailExists = await userModel.findOne({ email: lowercasedEmail });

    if (emailExists) {
      return next(new HttpError("Email already exists", 422));
    }
    // check if password and confirm password not match
    if (password != confirmPassword) {
      return next(new HttpError("Password does not match", 422));
    }

    // check password length
    if (password.length < 6) {
      return next(
        new HttpError("Password should be atleast 6 characters", 422)
      );
    }
    // hashPassword
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // add user to db
    const newUser = await UserModel.create({
      fullName,
      email: lowercasedEmail,
      password: hashedPassword,
    });

    res.json(newUser).status(201);
    // res.json("Register User")
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Login User
// Post:api/user/login
// Unprotected
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new HttpError("Fill in all fields", 422));
    }
    const lowercasedEmail = email.toLowerCase();

    // fetch user from the DB
    const user = await UserModel.findOne({ email: lowercasedEmail });

    if (!user) {
      return next(new HttpError("Invalid Credentials", 422));
    }

    // compare Passwords
    const comparePass = await bcrypt.compare(password, user?.password);

    if (!comparePass) {
      return next(new HttpError("Invalid password credential", 422));
    }
    const token = await jwt.sign({ id: user?._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res
      .json({ token, id: user?._id, profilePhoto:user?.profilePhoto, message: "Login Successfully" })
      .status(200);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Get User
// Get:api/user/:id
// protected
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id).select("-password");
    if (!user) {
      return next(new HttpError("User not found", 422));
    }

    res.json({ message: "UserDetails are", user }).status(200);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Get all Users
// Get:api/users
// protected
const getUsers = async (req, res, next) => {
  try {
    const user = await UserModel.find().limit(10).sort({ createdAt: -1 });
    res.json({ message: "Get All Users", user }).status(200);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Edit User
// Patch:api/users/edit
// protected
const editUser = async (req, res, next) => {
  try {
    const { fullName, bio } = req.body;
    const editedUser = await UserModel.findByIdAndUpdate(
      req.user.id,
      { fullName, bio },
      { new: true }
    );

    res.json({ message: "profile updated", editedUser }).status(200);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Follow/unfollow User
// get:api/users/:id/follow-unfollow
// protected
const followUnfollowUser = async (req, res, next) => {
  try {
    const userToFollowId = req.params.id;
    if (req.user.id == userToFollowId) {
      return next(new HttpError("You can't follow / unfollow yourself", 422));
    }
    const currentUser = await UserModel.findById(req.user.id);
    const isFollowing = currentUser?.following?.includes(userToFollowId);

    // follow if not following else viceversa
    if (!isFollowing) {
      const updatedUser = await UserModel.findByIdAndUpdate(
        userToFollowId,
        { $push: { followers: req.user.id } },
        { new: true }
      );

      await UserModel.findByIdAndUpdate(
        req.user.id,
        { $push: { following: userToFollowId } },
        { new: true }
      );
      console.log(
        "follow and current user ids are",

        currentUser.fullName,
        userToFollowId
      );
      res.json({
        message: `${currentUser.fullName} Follow successfully`,
        updatedUser,
      });
    } else {
      const updatedUser = await UserModel.findByIdAndUpdate(
        userToFollowId,
        { $pull: { followers: req.user.id } },
        { new: true }
      );

      await UserModel.findByIdAndUpdate(
        req.user.id,
        { $pull: { following: userToFollowId } },
        { new: true }
      );

      res.json({
        message: `${currentUser.fullName} UnFollow successfully`,
        updatedUser,
      });
    }

    // res.json("Follow/unfollow User")
  } catch (error) {
    return next(new HttpError(error));
  }
};

// Change  User profile photo
// post:api/users/avatar
// protected
const changeUserAvatar = async (req, res, next) => {
  try {
    if(!req.files.avatar){
      return next(new HttpError("Please choose an image",422));
    }
    const {avatar} = req.files;
    // check file size
    // if(avatar.size > 500000){
    //   return next(new HttpError("Profile picture size is too big. It should be less than 500kb"));
    // }

    let fileName = avatar.name;
    let splittedFilename = fileName.split('.')
    let newFilename = splittedFilename[0] + uuid()+"."+splittedFilename[splittedFilename.length -1]

    avatar.mv(path.join(__dirname,'..',"uploads",newFilename),
    async (err) => {
      if(err) {
        return next(new HttpError(err));
      }
      // store image in cloudinary
      const result = await cloudinary.uploader.upload(path.join(__dirname,"..","uploads",newFilename),{resource_type: "image"})

      if(!result.secure_url) {
        return next(new HttpError("Could not upload image to cloudinary",422));
      }
      const updatedUser = await UserModel.findByIdAndUpdate(req.user.id, {profilePhoto: result?.secure_url},{new: true})
      
      res.json(updatedUser).status(200)
    })
    res.json(newFilename);
    console.log("profile photo updated");
  } catch (error) {
    return next(new HttpError(error));
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUser,
  getUsers,
  editUser,
  followUnfollowUser,
  changeUserAvatar,
};
