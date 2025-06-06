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
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Upload = mongoose.model("Upload", uploadSchema);

module.exports = Upload;
