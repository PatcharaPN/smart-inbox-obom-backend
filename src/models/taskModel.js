const mongoose = require("mongoose");
const { Schema } = mongoose;

// SubTask Schema
const SubTaskSchema = new Schema({
  name: { type: String, required: true },
  material: { type: String, required: true },
  quantity: { type: Number, required: true },
  attachments: [
    {
      originalName: { type: String, required: true },
      savedName: { type: String, required: true },
      path: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
});

const TaskSchema = new Schema(
  {
    titleName: { type: String, required: true },
    companyName: { type: String, required: true },
    companyPrefix: { type: String, required: true },
    poNumber: { type: String, required: true },
    qtNumber: { type: String, required: true },
    sale: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String },
    taskType: {
      type: [
        { type: String, enum: ["งานด่วน", "งานแก้ไข", "งานเสีย", "งานใหม่"] },
      ],
      default: ["งานใหม่"],
    },
    tasks: [SubTaskSchema],
    dueDate: { type: Date },
    approveDate: { type: Date, default: null },
    isApprove: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", TaskSchema);
