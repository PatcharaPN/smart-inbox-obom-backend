const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    path: { type: String, required: true },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    uploadedAt: { type: Date, default: Date.now },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },

  { timestamps: true }
);

const Upload = mongoose.model("Upload", uploadSchema);

module.exports = Upload;
