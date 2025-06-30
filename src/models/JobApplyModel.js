const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    birthDate: {
      type: Date,
      required: true,
    },
    address: {
      district: {
        type: String,
        required: true,
        trim: true,
      },
      province: {
        type: String,
        required: true,
        trim: true,
      },
      postalCode: {
        type: String,
        required: true,
        trim: true,
      },
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    application: {
      applyPosition: {
        type: String,
        required: true,
        trim: true,
      },
      expectedSalary: {
        type: String,
        required: true,
      },
      availableDate: {
        type: Date,
        required: true,
      },
      educationLevel: {
        type: String,
        required: true,
      },
      institution: {
        type: String,
        required: true,
      },
      faculty: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        enum: [
          "รอดำเนินการ",
          "ผ่านการคัดเลือก",
          "ไม่ผ่านการคัดเลือก",
          "รอสัมภาษณ์",
          "สัมภาษณ์แล้ว",
          "เสนองาน",
          "ยืนยันรับงาน",
          "ปฏิเสธรับงาน",
          "ยกเลิกการสมัคร",
        ],
        default: "รอดำเนินการ",
      },
      educationDetails: {
        type: String,
      },
      jobTypesInterested: {
        type: [String],
        enum: ["fullTime", "partTime", "contract"],
        default: [],
      },
    },
    attachment: {
      fileName: String,
      fileUrl: String,
      fileType: String,
      fileSize: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Application", ApplicationSchema);
