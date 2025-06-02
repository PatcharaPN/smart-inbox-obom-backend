const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  isAdmin: { type: Boolean },
  role: { type: String },
  username: { type: String },
  name: { type: String },
  surname: { type: String },
  phoneNumber: { type: String },
  email: { type: String },
  password: { type: String },
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
});

module.exports = mongoose.model("User", userSchema);
