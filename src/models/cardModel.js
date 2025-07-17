const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cardSchema = new Schema(
  {
    cardType: {
      type: String,
      enum: ["vertical", "horizontal"],
      default: "horizontal",
      required: true,
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    employeeId: { type: String, required: true },
    department: { type: String, required: true },
    employeeType: { type: String, required: true },
    nickname: { type: String },
    imagePath: { type: String, required: true },
    note: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmployeeCard", cardSchema);
