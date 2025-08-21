const {Schema,model}= require("mongoose")

const userSchema = new Schema({
  fullName:{type:String, required:true},
  email:{type:String, required:true},
  password:{type:String, required:true},
  profilePhoto:{type:String, 
    default:'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQD-PS5aP9HvVdR5rftLTOctBJO6V3EEgGXsL2WalVcEKIuq85LK2hZZBTzfA82ildvCrQ&usqp=CAU'},
    // default:'https://res.cloudinary.com/dezgy7ygx/image/upload/v1748592548/a6tceqzkifkxgf4kwdbm.png'},
  bio:{type:String, default:"No Bio yet"},
  followers:[{type:Schema.Types.ObjectId, ref: "User"}],
  following:[{type:Schema.Types.ObjectId, ref:"User"}],
  bookmarks:[{type:Schema.Types.ObjectId, ref:"Post"}],
  posts:[{type:Schema.Types.ObjectId, ref:"Post"}],
  resetPasswordToken: String,
resetPasswordExpire: Date,

},{timestamps: true})

module.exports = model("User",userSchema)