const mongoose = require("mongoose");

const EmailSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      require: true,
    },
    messageId: { type: String, unique: true, sparse: true },
    from: { type: String, required: true },
    subject: { type: String },
    text: { type: String },
    date: { type: Date },
    to: { type: String },
    cc: { type: String },
    bcc: { type: String },
    html: { type: String },
    size: { type: String },
    folder: { type: String },
    attachments: [
      {
        filename: String,
        contentType: String,
        contentDisposition: String,
        content: String,
        url: String,
      },
    ],
  },
  { timestamps: true }
);

const EmailModel = mongoose.model("Email", EmailSchema);

module.exports = EmailModel;
