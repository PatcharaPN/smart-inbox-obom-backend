const mongoose = require("mongoose");

const EmailSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    subject: { type: String },
    text: { type: String },
    date: { type: Date },
    attachments: [
      {
        filename: String,
        contentType: String,
        contentDisposition: String,
        content: String,
      },
    ],
  },
  { timestamps: true }
);

const EmailModel = mongoose.model("Email", EmailSchema);

module.exports = EmailModel;
