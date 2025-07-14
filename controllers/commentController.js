const HttpError = require('../models/errorModel')
const CommentModel = require('../models/commentModel')
const PostModel = require('../models/postModel')
const UserModel = require('../models/userModel')


// create comment
// post:api/comments/:postId
// protected

const createComment = async (req,res,next) => {
  try {
    const {postId} = req.params;
    const {comment}= req.body;
    if(!comment){
      return next(new HttpError("Please write a comment",422))  
    }
    // get the comment creator from the db
    const commentCreator = await UserModel.findById(req.user.id)   

    const newComment = await CommentModel.create({creator: {creatorId: req.user.id,creatorName: commentCreator?.fullName,creatorPhoto: commentCreator?.profilePhoto},comment,postId})

    await PostModel.findByIdAndUpdate(postId,{$push:{comments: newComment?._id}},{new:true})

    res.json({message:"New comments added",newComment})
  } catch (error) {
    return next(new HttpError(error))
  }
  
}


// Get Post comment
// get:api/comments/:postId
// protected

const getPostComments = async (req,res,next) => {
  try {
    const {postId} = req.params;
    const comments = await PostModel.findById(postId).populate({path:'comments',options:{sort:{createdAt:-1}}})
    res.json({message:"Get all comments for that post",comments})
  } catch (error) {
    return next(new HttpError(error))
  }
  
}


// delete comment
// delete:api/comments/:commentId
// protected

const deleteComment = async (req,res,next) => {
  try {
    const {commentId}= req.params;
    // get the comment from db
    const comment = await CommentModel.findById(commentId)
  
    const commentCreator = await UserModel.findById(comment?.creator?.creatorId)
    // check if the creator is the one performing the deletion
  if(commentCreator?._id != req.user.id){
    return next(new HttpError("Unauthorized actions.",403))
  }
  //  remove comment id from post comment array
  
  await PostModel.findByIdAndUpdate(comment?.postId,{$pull:{comments: commentId}})
  const deletedComment = await CommentModel.findByIdAndDelete(commentId)

  res.json({message:"Comment Deleted Successfully",deletedComment})
  } catch (error) {
    return next(new HttpError(error))
  }
  
}

module.exports = {createComment,getPostComments,deleteComment}