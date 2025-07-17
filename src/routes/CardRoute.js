const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cardController = require("../controllers/cardController");

// 📂 กำหนดที่เก็บไฟล์อัปโหลดชั่วคราว
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../uploads/employees"));
  },
  filename: function (req, file, cb) {
    // ตั้งชื่อไฟล์เช่น employeeId-เวลาปัจจุบัน.jpg
    const ext = path.extname(file.originalname);
    const filename = `${req.body.employeeId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({ storage });

// 📌 Route สำหรับสร้าง PDF บัตรพนักงาน
router.post("/pdf", upload.single("photo"), cardController.createCard);
router.get("/cards", cardController.getAllCards);
router.get("/generate-pdf/:id", cardController.generateCardByUID);
router.delete("/delete/:id", cardController.deleteEmployeeCardById);
module.exports = router;
