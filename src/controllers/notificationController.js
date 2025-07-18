const Notification = require("../models/notificationModel");

exports.getNotifications = async (req, res) => {
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

exports.pushNotification = async (req, res) => {
  try {
    const {
      role,
      type,
      notitype = "",
      iconUrl = "",
      message,
      describtion = [],
      timestamp = new Date(),
    } = req.body;

    if (!message || !type || !role) {
      return res
        .status(400)
        .json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
    }

    const notification = new Notification({
      role,
      type,
      notitype,
      iconUrl,
      message,
      describtion,
      timestamp,
    });

    await notification.save();
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error("Push notification error:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
};
