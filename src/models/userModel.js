const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  id: { type: String },
  isAdmin: { type: Boolean },
  role: { type: String },
  username: { type: String },
  name: { type: String },
  surname: { type: String },
  phoneNumber: { type: String },
  categories: { type: String },
  email: { type: String },
  password: { type: String },
  profilePic: { type: String },
});

module.exports = mongoose.model("User", userSchema);
