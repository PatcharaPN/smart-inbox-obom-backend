const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: { type: String },
  username: { type: String },
  email: { type: String },
  password: { type: String },
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
});

module.exports = mongoose.model("User", userSchema);
