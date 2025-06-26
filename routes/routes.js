const router = require("express").Router();

const {
  registerUser,
  loginUser,
  getUser,
  getUsers,
  editUser,
  followUnfollowUser,
  changeUserAvatar,
} = require("../controllers/userController");

const {
  createPost,
  updatePost,
  deletePost,
  getPost,
  getPosts,
  getUserPosts,
  getUserBookmarks,
  createBookmark,
  likeDislikePost,
  getFollowingPosts
} = require("../controllers/postController");

const {createComment,getPostComments,deleteComment} = require('../controllers/commentController')


const {createMessage,getMessages,getConversations} = require('../controllers/messageController')
const authMiddleware = require("../middleware/authMiddleware");

// user routes

router.post("/users/register", registerUser);
router.post("/users/login", loginUser);
// Post Routes for get userbookmark post
router.get("/users/bookmarks",authMiddleware, getUserBookmarks);

router.get("/users/:id", authMiddleware, getUser);
router.get("/users", authMiddleware, getUsers);
router.patch("/users/:id", authMiddleware, editUser);
router.get("/users/:id/follow-unfollow", authMiddleware, followUnfollowUser);
router.post("/users/avatar", authMiddleware, changeUserAvatar);
// Post Routes for get userposts
router.get("/users/:id/posts",authMiddleware, getUserPosts);

// Post Routes
router.post("/posts",authMiddleware, createPost);
router.get("/posts/following",authMiddleware, getFollowingPosts);
router.get("/posts/:id",authMiddleware, getPost);
router.get("/posts",authMiddleware, getPosts);
router.patch("/posts/:id",authMiddleware, updatePost);
router.delete("/posts/:id",authMiddleware, deletePost);
router.get("/posts/:id/like",authMiddleware, likeDislikePost);
router.get("/posts/:id/bookmark",authMiddleware, createBookmark);

// Comment Routes
router.post('/comments/:postId',authMiddleware,createComment)
router.get('/comments/:postId',authMiddleware,getPostComments)
router.delete('/comments/:commentId',authMiddleware,deleteComment)

// Message Routes
router.post('/messages/:receiverId',authMiddleware,createMessage)
router.get('/messages/:receiverId',authMiddleware,getMessages)
router.get('/conversations',authMiddleware,getConversations)


module.exports = router;
