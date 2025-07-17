const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    role: {
      type: String,
      enum: ["HR", "it", "accounting", "production", "all", ""],
      default: "",
    },

    type: {
      type: String,
      enum: ["system", "user"],
      required: true,
    },

    notitype: {
      type: String,
      enum: ["applicant", "warning", "info", ""],
      default: "",
    },

    iconUrl: {
      type: String,
      default: "",
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    describtion: {
      type: [String],
      default: [],
    },

    read: {
      type: Boolean,
      default: false,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", NotificationSchema);
