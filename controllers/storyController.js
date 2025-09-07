const Story = require("../models/storyModel");
const User = require("../models/userModel");
const HttpError = require("../models/errorModel");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs");

// Create story
const createStory = async (req, res, next) => {
  try {
    const { text } = req.body;
    let mediaUrl = null;

    if (req.file) {
      let resourceType = req.file.mimetype.startsWith("video/")
        ? "video"
        : "image";

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "stories",
        resource_type: resourceType,
      });

      mediaUrl = result.secure_url;

      fs.unlinkSync(req.file.path);
    }

    if (!text && !mediaUrl) {
      return next(new HttpError("Story must have text or media", 422));
    }

    const story = await Story.create({
      user: req.user._id,
      text,
      media: mediaUrl,
      // expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 10 * 1000),
    });

    const populatedStory = await story.populate(
      "user",
      "fullName profilePhoto"
    );

    return res
      .status(201)
      .json({ message: "Story created", story: populatedStory });
  } catch (error) {
    console.error("Error in createStory:", error.message);
    return next(new HttpError(error.message, 500));
  }
};

// Get all active stories (not expired)
// In storyController.js
const getStories = async (req, res, next) => {
  try {
    // Delete expired stories first
    await cleanExpiredStories();

    const stories = await Story.find({ expiresAt: { $gt: Date.now() } })
      .populate("user", "fullName profilePhoto")
      .sort({ createdAt: -1 });

    res.status(200).json({ stories });
  } catch (error) {
    return next(new HttpError(error.message, 500));
  }
};

const cleanExpiredStories = async () => {
  try {
    const expiredStories = await Story.find({ expiresAt: { $lt: Date.now() } });

    for (const story of expiredStories) {
      // Optional: delete media from Cloudinary
      if (story.media) {
        // Extract public_id from Cloudinary URL
        const publicId = story.media.split("/").slice(-1)[0].split(".")[0]; // crude but works if URL format is standard
        await cloudinary.uploader.destroy(`stories/${publicId}`, {
          resource_type: story.media.includes(".mp4") ? "video" : "image",
        });
      }
      await Story.findByIdAndDelete(story._id);
    }

    if (expiredStories.length > 0) {
      console.log(`Cleaned ${expiredStories.length} expired stories`);
    }
  } catch (err) {
    console.error("Error cleaning expired stories:", err.message);
  }
};



module.exports = {
  createStory,
  getStories,
  cleanExpiredStories,
};
