const express = require("express");
const multer = require("multer");
const emailService = require("./src/services/emailService"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const authRoutes = require("./src/routes/AuthRoute"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const getDiskUsage = require("./src/controllers/diskUsageController");
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
  fs.readdir(uploadPath, { withFileTypes: true }, (err, entries) => {
    if (err) return res.status(500).send("Error reading folder");

    const list = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "folder" : "file",
    }));

    res.json(list);
  });
});
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
