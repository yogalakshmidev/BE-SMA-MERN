const jwt = require("jsonwebtoken");
const HttpError = require("../models/errorModel");
const userModel = require("../models/userModel");
const UserModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const uuid = require("uuid").v4;
const fs = require("fs");
const path = require("path");
const cloudinary = require("../utils/cloudinary");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const mongoose = require('mongoose');


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

    res.status(201).json({
  message: "User registered successfully",
  user: {
    id: newUser._id,
    fullName: newUser.fullName,
    email: newUser.email,
  },
});
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

  res.status(200).json({
  token,
  id: user?._id,
  profilePhoto: user?.profilePhoto,
  message: "Login Successfully",
});

  } catch (error) {
    return next(new HttpError(error));
  }
};

// Forgot Password
const forgotPassword = async (req, res, next) => {
  try {
    const user = await UserModel.findOne({ email: req.body.email });
    if (!user) return next(new HttpError("No user with that email", 404));

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const message = `
      <h1>Password Reset Request</h1>
      <p>Click below link to reset your password (valid for 10 minutes):</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset",
      message,
    });

    res.json({ message: "Password reset link sent to your email" });
  } catch (error) {
    return next(new HttpError(error.message, 500));
  }
};

// Reset Password
const resetPassword = async (req, res, next) => {
  try {
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await UserModel.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) return next(new HttpError("Invalid or expired token", 400));

    // user.password = req.body.password;
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    return next(new HttpError(error.message, 500));
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
    const currentUserId = req.user.id;

    // Fetch the current user to get their following list
    const currentUser = await UserModel.findById(currentUserId);

    // Find all users excluding the current user and already followed users
    const users = await UserModel.find({
      _id: { $nin: [currentUserId, ...(currentUser.following || [])] },
    }).select("-password"); // exclude password

    res.status(200).json({ message: "Suggested users", users });
  } catch (error) {
    return next(new HttpError(error.message, 500));
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

// Search User
// get:api/users/search?query=yoga
// protected

const searchUser = async (req,res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.json([]);
    }

    const users = await UserModel.find({
      fullName: { $regex: query, $options: "i" }, // case-insensitive
    }).select("fullName profilePhoto _id");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

}

// Follow/unfollow User
// get:api/users/:id/follow-unfollow
// protected

const followUnfollowUser = async (req, res, next) => {
  try {
    const userToFollowId = req.params.id.toString();
    const currentUserId = req.user.id.toString();

    if (currentUserId === userToFollowId) {
      return next(new HttpError("You can't follow/unfollow yourself", 422));
    }

    const currentUser = await UserModel.findById(currentUserId);
    const isFollowing = currentUser?.following?.includes(userToFollowId);

    let updatedUser;

    if (!isFollowing) {
      updatedUser = await UserModel.findByIdAndUpdate(
        userToFollowId,
        { $push: { followers: currentUserId } },
        { new: true }
      );
      await UserModel.findByIdAndUpdate(
        currentUserId,
        { $push: { following: userToFollowId } },
        { new: true }
      );
    } else {
      updatedUser = await UserModel.findByIdAndUpdate(
        userToFollowId,
        { $pull: { followers: currentUserId } },
        { new: true }
      );
      await UserModel.findByIdAndUpdate(
        currentUserId,
        { $pull: { following: userToFollowId } },
        { new: true }
      );
    }

    const refreshedCurrentUser = await UserModel.findById(currentUserId);

    res.json({
      message: isFollowing ? "Unfollowed" : "Followed",
      updatedUser,
      currentUserFollowing: refreshedCurrentUser.following,
    });
  } catch (error) {
    return next(new HttpError(error.message, 500));
  }
};


// Change  User profile photo
// post: api/users/avatar
// protected

const changeUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "avatars"
    });

    // remove temp file
    fs.unlinkSync(req.file.path);

    // update user
    req.user.profilePhoto = result.secure_url;
    await req.user.save();

    res.status(200).json({
      message: "Profile photo updated successfully",
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  registerUser,
  loginUser,
  getUser,
  getUsers,
  editUser,
  searchUser,
  followUnfollowUser,
  changeUserAvatar,
  forgotPassword,
  resetPassword,
};
