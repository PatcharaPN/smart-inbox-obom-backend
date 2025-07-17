const Notification = require("../models/notificationModel");

const getNotifications = async (req, res) => {
  try {
    const role = req.user?.role || "";

    if (!role) {
      return res
        .status(400)
        .json({ success: false, message: "ไม่มีข้อมูลแผนกของผู้ใช้" });
    }

    const notifications = await Notification.find({
      role: { $in: [role, "all", ""] },
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
};

module.exports = { getNotifications };
