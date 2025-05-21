const express = require("express");
const multer = require("multer");
const emailService = require("./src/services/emailService"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const authRoutes = require("./src/routes/AuthRoute"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const getDiskUsage = require("./src/controllers/diskUsageController");
const getInbox = require("./src/services/checkMail");
const app = express();
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const PORT = 3000;
const dotenv = require("dotenv");
const {
  FetchEmails,
  FetchEmail,
} = require("./src/controllers/emailController");
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
require("./src/configs/swagger")(app);
const uploadPath = path.join(__dirname, "uploads");

const baseUploadPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

app.use("/files", express.static(uploadPath));

// Upload PDF
app.post("/upload", upload.single("pdf"), (req, res) => {
  res.send({ message: "Uploaded successfully", file: req.file.originalname });
});
app.use("/auth", authRoutes);
app.get("/", (req, res) => {
  res.send("📨 Email Service API is running");
});

dotenv.config();
app.use("/attachments", express.static(path.join(__dirname, "attachments")));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

/**
 * @swagger
 * /fetch-email:
 *   post:
 *     summary: Get all Emails
 *     responses:
 *       200:
 *         description: A list of Emails
 */
app.post("/fetch-email", (req, res) => {
  try {
    emailService();
    res.status(200).json({ message: "📬 Fetching latest email..." });
  } catch (err) {
    console.error("❌ Failed to fetch email:", err);
    res.status(500).json({ error: "Failed to fetch email" });
  }
});
app.get("/ram-usage", getDiskUsage.getRamUsage);
app.get("/disk-usage", getDiskUsage.getDiskUsage);
/**
 * @swagger
 * /emails:
 *   get:
 *     summary: Get all Emails
 *     responses:
 *       200:
 *         description: A list of Emails
 */
app.get("/emails", FetchEmail);

/**
 * @swagger
 * /fetch-emails:
 *   get:
 *     summary: Get all Emails
 *     responses:
 *       200:
 *         description: A list of Emails
 */
app.get("/fetch-emails", FetchEmails);
/**
 * @swagger
 * /list:
 *   get:
 *     summary: Get all Folder
 *     responses:
 *       200:
 *         description: A list of Emails
 */
app.get("/list", (req, res) => {
  const { dirPath } = req.query; // ใช้ชื่อพารามิเตอร์ใหม่

  console.log("Received path:", dirPath); // ตรวจสอบว่าค่า path ที่ได้รับถูกต้องหรือไม่

  if (!dirPath) {
    return res.status(400).json({ error: "Directory path is required" });
  }

  const fullPath = path.join(baseUploadPath, dirPath); // ใช้ dirPath แทน path
  console.log("Full path:", fullPath);

  // ตรวจสอบว่าโฟลเดอร์นี้มีอยู่จริงหรือไม่
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Directory not found" });
  }

  // อ่านไฟล์และส่งข้อมูลกลับ
  fs.readdir(fullPath, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return res.status(500).json({ error: "Failed to read directory" });
    }

    const entries = files.map((file) => ({
      name: file,
      type: fs.statSync(path.join(fullPath, file)).isDirectory()
        ? "folder"
        : "file",
      path: path.join(dirPath, file), // สร้างเส้นทาง relative
    }));

    res.json(entries);
  });
});

app.get("/file", (req, res) => {
  const filePath = req.query.path;
  const fullFilePath = path.join(baseUploadPath, filePath);
  res.sendFile(fullFilePath);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
