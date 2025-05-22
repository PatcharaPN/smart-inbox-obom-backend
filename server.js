const express = require("express");
const multer = require("multer");
const emailService = require("./src/services/emailService"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const authRoutes = require("./src/routes/AuthRoute"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const getDiskUsage = require("./src/controllers/diskUsageController");
const getInbox = require("./src/services/checkMail");
const fetchNewEmails = require("./src/services/FetchNewEmail");
const app = express();
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const PORT = 3000;
const { CronJob } = require("cron");
const dotenv = require("dotenv");
const {
  FetchEmails,
  FetchEmail,
  FetchNewEmails,
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

const job = new CronJob("0 8 * * *", () => {
  fetchNewEmails();
});
job.start();
const upload = multer({ storage });

app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));

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
// app.get("/fetch-new", FetchNewEmails);

/**
 * @swagger
 * /list:
 *   get:
 *     summary: Get all Folder
 *     responses:
 *       200:
 *         description: A list of Emails
 */
const BASE_DIR = path.join(__dirname, "uploads");

app.get("/explorer", async (req, res) => {
  const requestedPath = req.query.path || "Uploads";
  const fullPath = path.join(__dirname, requestedPath);
  const getFileCategory = (filename) => {
    const ext = path.extname(filename).toLowerCase();

    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext))
      return "image";
    if ([".mp4", ".avi", ".mkv", ".mov", ".webm"].includes(ext)) return "video";
    if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) return "audio";
    if ([".pdf"].includes(ext)) return "pdf";
    if ([".txt", ".md", ".log"].includes(ext)) return "text";
    if ([".doc", ".docx"].includes(ext)) return "word";
    if ([".xls", ".xlsx"].includes(ext)) return "excel";
    if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext)) return "archive";
    return "file";
  };
  try {
    const files = await fs.promises.readdir(fullPath, { withFileTypes: true });

    const result = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(fullPath, file.name);
        const stat = await fs.promises.stat(filePath);

        return {
          name: file.name,
          type: file.isDirectory() ? "folder" : "file",
          category: file.isDirectory() ? "Folder" : getFileCategory(file.name),
          path: path.join(requestedPath, file.name),
          modified: stat.mtime,
          size: file.isDirectory() ? null : stat.size,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error("❌ Error reading directory:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/file", (req, res) => {
  const filePath = req.query.path;
  const fullFilePath = path.join(baseUploadPath, filePath);
  res.sendFile(fullFilePath);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
