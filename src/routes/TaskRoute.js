const taskController = require("../controllers/taskController");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../../uploads/task");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const poName = req.body.poNumber || req.body.qtNumber || "unknown";
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, "_");
    const savedName = `${timestamp}-${safeName}`;

    if (!req.fileMeta) req.fileMeta = [];
    req.fileMeta.push({
      originalName: file.originalname,
      savedName,
      path: `/uploads/task/${savedName}`,
      uploadedAt: new Date(),
    });

    cb(null, savedName);
  },
});

const upload = multer({ storage });

router.post("/create", upload.any(), taskController.createTask);
router.get("/tasks", taskController.getAllTasks);
router.get("/getAllTasks", taskController.getTaskListViews);
router.put("/:id/approve", taskController.approveTask);
router.get("/:id", taskController.getTaskById);
router.put("/update/:id", taskController.updateTask);
// router.put("/:taskId/subtask/:subtaskId/print", taskController.markPrinted);
module.exports = router;
