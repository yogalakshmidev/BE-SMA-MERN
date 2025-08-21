// models/postModel.js
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  body: { type: String, required: true },
  image: { type: String },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

const PostModel = mongoose.model("Post", postSchema);

module.exports = PostModel;
