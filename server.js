const express = require("express");
const multer = require("multer");
const emailService = require("./src/services/emailService"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const authRoutes = require("./src/routes/AuthRoute"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const getDiskUsage = require("./src/controllers/diskUsageController");
const getInbox = require("./src/services/checkMail");
const authMiddleware = require("./src/middlewares/authMiddleWare");
const connectDB = require("./src/middlewares/connectDB");
const fetchNewEmails = require("./src/services/FetchNewEmail");
const app = express();
const User = require("./src/models/userModel");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const cors = require("cors");
const PORT = 3000;
const { CronJob } = require("cron");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const Upload = require("./src/models/uploadModel");
const FetchNewEmails = require("./src/services/FetchNewEmail");
const {
  FetchEmails,
  FetchEmail,
} = require("./src/controllers/emailController");
const EmailModel = require("./src/models/emailModel");
const EmailAccountModel = require("./src/models/emailAccounts");

app.use(express.json());

app.use(
  cors({
    origin: [
      "http://database.obomgauge.com",
      "http://localhost:5173",
      "http://100.127.64.22",
      "http://100.127.64.22/Setting/account",
    ],
    methods: ["GET", "DELETE", "POST", "PUT"],
    credentials: true,
  })
);
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://5944-125-25-17-122.ngrok-free.app",
// ];

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin) return callback(null, true); // สำหรับ Postman หรือ curl
//       if (allowedOrigins.includes(origin)) {
//         callback(null, origin); // ✅ ส่ง origin กลับ ไม่ใช่ true
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//   })
// );
require("./src/configs/swagger")(app);
let cacheGAData = null;
app.use(cookieParser());
const uploadPath = path.join(__dirname, "uploads");

const baseUploadPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}
connectDB();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const targetPath = req.query.targetPath || "Uploads";
    const uploadDir = path.join(__dirname, targetPath);

    if (!uploadDir.startsWith(path.join(__dirname, "Uploads"))) {
      return cb(new Error("Invalid upload path"));
    }

    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });
const job = new CronJob("0 8 * * *", () => {
  fetchNewEmails();
});
job.start();
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));

// Upload PDF

app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("📨 Email Service API is running");
});

dotenv.config();
app.use("/attachments", express.static(path.join(__dirname, "attachments")));

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
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({
      error: "User ID is required",
    });
  }
  try {
    emailService(userId);
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
app.get("/fetch-new", FetchNewEmails);

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

app.get("/explorer", authMiddleware, async (req, res) => {
  const requestedPaths = req.query.paths
    ? req.query.paths.split(",")
    : ["Uploads"];

  const getFileCategory = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext))
      return "รูปภาพ";
    if ([".mp4", ".avi", ".mkv", ".mov", ".webm"].includes(ext))
      return "วิดีโอ";
    if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) return "ไฟล์เสียง";
    if ([".pdf"].includes(ext)) return "pdf";
    if ([".txt", ".md", ".log"].includes(ext)) return "ไฟล์อักษร";
    if ([".doc", ".docx"].includes(ext)) return "word";
    if ([".xls", ".xlsx"].includes(ext)) return "excel";
    if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext)) return "archive";
    return "ไฟล์";
  };

  try {
    const allResults = await Promise.all(
      requestedPaths.map(async (requestedPath) => {
        const fullPath = path.join(__dirname, requestedPath);
        const files = await fs.promises.readdir(fullPath, {
          withFileTypes: true,
        });

        return Promise.all(
          files.map(async (file) => {
            const filePath = path.join(fullPath, file.name);
            const stat = await fs.promises.stat(filePath);

            const uploaderDoc = file.isDirectory()
              ? null
              : await getUploader(file.name); // ปรับให้คืนทั้ง doc

            return {
              name: file.name,
              type: file.isDirectory() ? "folder" : "file",
              category: file.isDirectory()
                ? "Folder"
                : getFileCategory(file.name),
              path: path.posix.join(requestedPath, file.name),
              fullPath: path.join(fullPath, file.name),
              modified: stat.mtime,
              size: file.isDirectory() ? null : stat.size,
              uploader: uploaderDoc?.name ?? null,
              uploaderId: uploaderDoc?._id ?? null,
            };
          })
        );
      })
    );

    res.json(allResults.flat());
  } catch (err) {
    console.error("❌ Error reading directories:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const getUploader = async (filename) => {
  try {
    const file = await Upload.findOne({ filename });

    if (!file || !file.uploaderId) return null;

    const uploader = await User.findById(file.uploaderId).select("email name");

    return uploader ? { email: uploader.email, name: uploader.name } : null;
  } catch (error) {
    console.error("❌ Error getting uploader:", error);
    return null;
  }
};

const DEFAULT_LIMIT = 10;

app.get("/recent-files", async (req, res) => {
  try {
    const requestedPaths = req.query.paths
      ? req.query.paths.split(",")
      : ["Uploads"];
    const limit = parseInt(req.query.limit) || DEFAULT_LIMIT;

    const getFileCategory = (filename) => {
      const ext = path.extname(filename).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext))
        return "image";
      if ([".mp4", ".avi", ".mkv", ".mov", ".webm"].includes(ext))
        return "video";
      if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) return "audio";
      if ([".pdf"].includes(ext)) return "pdf";
      if ([".txt", ".md", ".log"].includes(ext)) return "text";
      if ([".doc", ".docx"].includes(ext)) return "word";
      if ([".xls", ".xlsx"].includes(ext)) return "excel";
      if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext))
        return "archive";
      return "file";
    };

    const allResults = await Promise.all(
      requestedPaths.map(async (requestedPath) => {
        const fullPath = path.join(__dirname, requestedPath);
        const files = await fs.promises.readdir(fullPath, {
          withFileTypes: true,
        });

        return Promise.all(
          files.map(async (file) => {
            const filePath = path.join(fullPath, file.name);
            const stat = await fs.promises.stat(filePath);

            return {
              name: file.name,
              type: file.isDirectory() ? "folder" : "file",
              category: file.isDirectory()
                ? "Folder"
                : getFileCategory(file.name),
              path: path.join(requestedPath, file.name),
              modified: stat.mtime,
              size: file.isDirectory() ? null : stat.size,
            };
          })
        );
      })
    );

    const mergedResults = allResults.flat();

    const onlyFiles = mergedResults.filter((item) => item.type === "file");

    onlyFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    const limitedFiles = onlyFiles.slice(0, limit);

    res.json(limitedFiles);
  } catch (err) {
    console.error("❌ Error reading recent files:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// const uploadMiddleware = multer({
//   storage: multer.diskStorage({
//     destination: function (req, file, cb) {
//       const targetPath = req.query.targetPath || "Uploads";
//       const uploadPath = path.join(__dirname, targetPath);
//       fs.mkdirSync(uploadPath, { recursive: true });
//       cb(null, uploadPath);
//     },
//     filename: function (req, file, cb) {
//       cb(null, file.originalname);
//     },
//   }),
// });

app.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  const uploaderId = req.user._id;
  const filename = req.file.filename;
  const filepath = req.file.path;

  try {
    // ใช้ Upload model เพื่อบันทึกข้อมูลลงใน MongoDB
    const newUpload = new Upload({
      filename,
      path: filepath,
      uploaderId,
    });

    await newUpload.save();

    res.status(200).json({ message: "Upload complete" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error uploading file", details: error.message });
  }
});
const fsPromises = require("fs").promises;

app.delete("/delete", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    let targetPath = req.query.path;

    if (!targetPath) {
      return res.status(400).json({ error: "No path specified" });
    }
    const fullFilePath = path.join(__dirname, targetPath);
    // ดึงข้อมูลไฟล์จาก DB
    const fileDoc = await Upload.findOne({ path: fullFilePath });

    if (!fileDoc) {
      return res.status(404).json({
        message: `File with path ${targetPath} was not found`,
      });
    }

    // ✅ ตรวจสอบสิทธิ์การลบ
    if (
      String(fileDoc.uploaderId) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Permission denied" });
    }

    // 👇 เก็บ log การลบก่อน
    await Upload.updateOne(
      { _id: fileDoc._id },
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
          deletedBy: req.user._id,
        },
      }
    );

    // 🔒 Sanitize path ก่อนลบไฟล์จริง
    if (targetPath.startsWith("Uploads/")) {
      targetPath = targetPath.slice("Uploads/".length);
    }

    const sanitizedPath = path
      .normalize(targetPath)
      .replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(__dirname, "Uploads", sanitizedPath);

    console.log("Deleting path:", fullPath);

    const stats = await fsPromises.stat(fullPath);

    if (stats.isDirectory()) {
      await fsPromises.rm(fullPath, { recursive: true, force: true });
      return res.json({ message: "Folder deleted successfully" });
    } else {
      await fsPromises.unlink(fullPath);
      return res.json({ message: "File deleted successfully" });
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "File or folder not found" });
    }
    console.error(err);
    return res.status(500).json({ error: "Failed to delete" });
  }
});

app.get("/filter-by-date", async (req, res) => {
  const { startDate, endDate, limit = 20, page = 1 } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Missing startDate or endDate" });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const limitNum = parseInt(limit);
  const pageNum = parseInt(page);
  const skip = (pageNum - 1) * limitNum;

  try {
    const totalCount = await EmailModel.countDocuments({
      date: { $gte: start, $lte: end },
    });

    const totalPage = Math.ceil(totalCount / limitNum);

    const result = await EmailModel.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $sort: { date: -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ]);

    res
      .status(200)
      .json({ data: result, totalCount, totalPage, page: pageNum });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.get("/search", async (req, res) => {
  const query = req.query.query?.toLowerCase();
  if (!query) return res.status(400).json({ error: "Query is required" });

  const basePath = path.join(__dirname, "Uploads");

  const getFileCategory = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext))
      return "รูปภาพ";
    if ([".mp4", ".avi", ".mkv", ".mov", ".webm"].includes(ext))
      return "วิดีโอ";
    if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) return "ไฟล์เสียง";
    if ([".pdf"].includes(ext)) return "pdf";
    if ([".txt", ".md", ".log"].includes(ext)) return "ไฟล์อักษร";
    if ([".doc", ".docx"].includes(ext)) return "word";
    if ([".xls", ".xlsx"].includes(ext)) return "excel";
    if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext)) return "archive";
    return "ไฟล์";
  };

  const results = [];

  async function walk(dir, relativePath = "") {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);
      const stats = await fs.promises.stat(fullPath);

      const item = {
        name: entry.name,
        type: entry.isDirectory() ? "folder" : "file",
        category: entry.isDirectory() ? "Folder" : getFileCategory(entry.name),
        path: path.join("Uploads", relPath),
        modified: stats.mtime,
        size: entry.isDirectory() ? null : stats.size,
      };

      // Match with query
      if (
        item.name.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      ) {
        results.push(item);
      }

      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      }
    }
  }

  try {
    await walk(basePath);
    res.json(results);
  } catch (error) {
    console.error("❌ Error during search:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/create-folder", authMiddleware, async (req, res) => {
  const filePath = req.query.path || "Uploads";
  const folderName = req.query.foldername;
  const uploaderId = req.user?._id;
  if (!folderName || folderName.trim() === "") {
    return res.status(500).json({
      error: "Folder name must be named",
    });
  }
  try {
    const sanitizedPath = path
      .normalize(filePath)
      .replace(/^(\.\.(\/|\\|$))+/, "");

    const fullPath = path.join(__dirname, sanitizedPath, folderName);

    if (fs.existsSync(fullPath)) {
      return res.status(400).json({
        error: "Folder already exists",
      });
    }
    await fs.promises.mkdir(fullPath, { recursive: true });
    await Upload.create({
      filename: folderName,
      path: fullPath,
      uploaderId: uploaderId ?? null,
      uploadedAt: new Date(),
      deleted: false,
    });
    res.status(201).json({
      message: "📁 Folder created successfully",
      path: path.join(sanitizedPath, folderName),
    });
  } catch (error) {
    console.error("❌ Error creating folder:", error);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

const cacheGADataMap = {};

async function fetchGAReport(granularity = "daily") {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: "../credentials/abiding-ion-453707-v2-8d672386f50c.json",
      scopes: "https://www.googleapis.com/auth/analytics.readonly",
    });

    const analyticsData = google.analyticsdata("v1beta");
    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    let dimensionName;
    let startDate;

    switch (granularity) {
      case "monthly":
        dimensionName = "month";
        startDate = "90daysAgo";
        break;
      case "weekly":
        dimensionName = "date";
        startDate = "28daysAgo";
        break;
      case "daily":
      default:
        dimensionName = "date";
        startDate = "7daysAgo";
        break;
    }

    const response = await analyticsData.properties.runReport({
      property: "properties/434121266",
      requestBody: {
        dateRanges: [{ startDate, endDate: "today" }],
        dimensions: [{ name: dimensionName }, { name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
      },
    });

    return response.data;
  } catch (error) {
    console.error("GA API error:", error);
    throw error;
  }
}

app.get("/ga4-report", async (req, res) => {
  const granularity = req.query.granularity || "daily";

  if (cacheGADataMap[granularity]) {
    return res.json(cacheGADataMap[granularity]);
  }

  try {
    const data = await fetchGAReport(granularity);
    cacheGADataMap[granularity] = data;
    res.json(data);
  } catch (error) {
    console.error("GA Report error:", error);
    res.status(500).json({ error: "Failed to fetch GA report" });
  }
});
app.get("/ga4-engagement", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: "./src/credentials/abiding-ion-453707-v2-8d672386f50c.json",
      scopes: "https://www.googleapis.com/auth/analytics.readonly",
    });

    const analyticsData = google.analyticsdata("v1beta");
    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    const response = await analyticsData.properties.runReport({
      property: "properties/434121266", // เปลี่ยนเป็น property ID ของคุณ
      requestBody: {
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "engagedSessions" },
          { name: "averageSessionDuration" },
          { name: "engagementRate" },
        ],
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error("GA API error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/file", (req, res) => {
  const filePath = req.query.path;
  const fullFilePath = path.join(baseUploadPath, filePath);
  res.sendFile(fullFilePath);
});

app.post("/email-accounts", authMiddleware, async (req, res) => {
  try {
    const userId = req.body.userId; // เปลี่ยนจาก req.user._id เป็น req.body.userId เพราะ front ส่ง userId มาเลือก

    const { email, password, host, port, tls, folder } = req.body;

    // เช็คว่าบัญชีอีเมลนี้ผูกกับ userId นี้อยู่แล้วหรือยัง
    const existingAccount = await EmailAccountModel.findOne({
      user: userId,
      email,
    });
    if (existingAccount) {
      return res
        .status(400)
        .json({ error: "ผู้ใช้รายนี้ผูกบัญชีอีเมลนี้อยู่แล้ว" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newEmailAccount = new EmailAccountModel({
      user: userId,
      email,
      password: hashedPassword,
      host,
      port,
      folder,
      tls,
    });

    await newEmailAccount.save();

    res.status(201).json({
      message: "Email account created successfully",
      accountId: newEmailAccount._id,
    });
  } catch (error) {
    console.error("Create Email Account Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
