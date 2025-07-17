const Application = require("../models/JobApplyModel");
const Notification = require("../models/notificationModel");
exports.submitApplication = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      gender,
      birthDate,
      district,
      province,
      postalCode,
      phone,
      email,
      status = "รอดำเนินการ",
      applyPosition,
      expectedSalary,
      availableDate,
      educationLevel,
      institution,
      faculty,
      educationDetails,
      jobTypesInterested,
    } = req.body;

    let attachment = null;
    if (req.file) {
      attachment = {
        fileName: req.file.originalname,
        fileUrl: `/attachments/applicant_attachments/${req.file.filename}`,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      };
    }

    const newApplication = new Application({
      firstName,
      lastName,
      gender,
      birthDate,
      address: {
        district,
        province,
        postalCode,
      },
      phone,
      email,
      application: {
        applyPosition,
        expectedSalary,
        availableDate,
        educationLevel,
        institution,
        status,
        faculty,
        educationDetails,
        jobTypesInterested: Array.isArray(jobTypesInterested)
          ? jobTypesInterested
          : [jobTypesInterested],
      },
      attachment,
    });

    await newApplication.save();

    const notification = new Notification({
      userId: null,
      department: "hr",
      type: "system",
      notitype: "applicant",
      message: `ใบสมัครงานใหม่จาก ${firstName} ${lastName}`,
      describtion: [
        `ตำแหน่งที่สมัคร: ${applyPosition}`,
        `สถานะปัจจุบัน: ${status}`,
      ],
    });

    await notification.save();
    res
      .status(201)
      .json({ message: "ส่งใบสมัครเรียบร้อย", data: newApplication });
  } catch (error) {
    console.error("Application Submit Error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: error.message });
  }
};
exports.getAllApplicant = async (req, res) => {
  try {
    const result = await Application.find({});
    res.status(200).json({
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      error: "Server Error",
    });
  }
};
exports.editApplicantStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;
    if (!status)
      return res.status(400).json({
        message: "กรุณาระบุสถานะใหม่",
      });
    const allowedStatus = [
      "รอดำเนินการ",
      "ผ่านการคัดเลือก",
      "ไม่ผ่าน",
      "รอสัมภาษณ์",
      "สัมภาษณ์แล้ว",
      "เสนองาน",
      "ยืนยันรับงาน",
      "ปฏิเสธรับงาน",
      "ยกเลิกการสมัคร",
    ];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
    }
    const updated = await Application.findByIdAndUpdate(
      userId,
      {
        "application.status": status,
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "ไม่พบผู้สมัคร" });

    res.status(200).json({ message: "อัปเดตสถานะสำเร็จ", data: updated });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: error.message });
  }
};
exports.deleteApplicant = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const deletedUser = await Application.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: "ไม่พบผู้สมัครที่ต้องการลบ" });
    }

    res.status(200).json({ message: "ลบผู้สมัครสำเร็จ" });
  } catch (error) {
    console.error("Deleting Applicant Error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาด",
      error: error.message,
    });
  }
};
