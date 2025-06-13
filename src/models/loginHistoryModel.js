const mongoose = require("mongoose");

const loginHistory = new mongoose.Schema(
  {
    loginAt: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String },
  },
  { timestamps: true }
);

const LoginHistory = mongoose.model("History", loginHistory);

module.exports = LoginHistory;
