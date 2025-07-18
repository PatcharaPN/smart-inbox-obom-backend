const express = require("express");
const router = express.Router();
const getNotifications = require("../controllers/notificationController");
const authMiddleware = require("../middlewares/authMiddleWare");

router.get("/notifications", authMiddleware, getNotifications.getNotifications);
router.post(
  "/notifications",
  authMiddleware,
  getNotifications.pushNotification
);
module.exports = router;
