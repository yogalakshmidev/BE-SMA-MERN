const HttpError = require('../models/errorModel')
const ConversationModel = require('../models/conversationModel')
const MessageModel = require('../models/messageModel');
const { getReceiverSocketId ,io} = require('../socket/socket');

// create message
// post:api/messages/:receiverId
// protected

const createMessage = async(req, res,next)=>{
  try {
    const {receiverId}= req.params;
    const {messageBody}=   req.body;
    
    // check if there is conversation between already current user and receiver
    let conversation = await ConversationModel.findOne({
      participants:{$all:[req.user.id,receiverId]}
    })

    // create new conversation if none is found
    if(!conversation){
      conversation = await ConversationModel.create({
        participants:[req.user.id,receiverId],lastMessage:{text:messageBody,senderId : req.user.id}
      })
    }

    // create a new message
    const newMessage = await MessageModel.create({conversationId: conversation._id,senderId:req.user.id, text:messageBody})   
    
    await conversation.updateOne({lastMessage:{text:messageBody, senderId:req.user.id}})

    const receiverSocketId = getReceiverSocketId(receiverId)

    if(receiverSocketId){
      io.to(receiverSocketId).emit("newMessage",newMessage);
    }

    res.json({message:"New Message sent",newMessage})
  } catch (error) {
    return next(new HttpError(error))
  }
}


// get message
// get:api/messages/:receiverId
// protected

const getMessages = async(req, res,next)=>{
  try {
    const {receiverId}= req.params;
    const conversation = await ConversationModel.findOne({participants:{$all:[req.user.id,receiverId]}})
    if(!conversation){
      return next(new HttpError("You have no conversation with this person",404))
    }
    const messages = await MessageModel.find({conversationId:conversation._id}).sort({createdAt:1})

    res.json({message:"Get all messages",messages})
  } catch (error) {
    return next(new HttpError(error))
  }
}


// Get conversation message
// get:api/conversations
// protected

const getConversations = async(req, res,next)=>{
  try {
let conversations = await ConversationModel.find({participants:req.user.id}).populate({path:"participants",select:"fullName profilePhoto"}).sort({createdAt: -1})

// remove logged in user from the participants array
conversations.forEach((conversation) => {
  conversation.participants = conversation.participants.filter(
    (participant) => participant._id.toString() !== req.user.id.toString()
  )
  
});
res.json({message:"To get all conversations",conversations})
  } catch (error) {
    return next(new HttpError(error))
  }
}

module.exports = {createMessage,getMessages,getConversations}