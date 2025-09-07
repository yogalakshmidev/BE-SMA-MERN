const Story = require("../models/storyModel");
const cloudinary = require("./cloudinary"); // adjust path if necessary

const cleanExpiredStories = async () => {
  try {
    const expiredStories = await Story.find({ expiresAt: { $lt: Date.now() } });

    for (const story of expiredStories) {
      if (story.media) {
        const publicId = story.media.split("/").slice(-1)[0].split(".")[0];

        await cloudinary.uploader.destroy(`stories/${publicId}`, {
          resource_type: story.media.includes(".mp4") ? "video" : "image",
        });
      }
      await Story.findByIdAndDelete(story._id);
    }

    console.log(`Cleaned ${expiredStories.length} expired stories`);
  } catch (err) {
    console.error("Error cleaning expired stories:", err.message);
  }
};

module.exports = cleanExpiredStories;
