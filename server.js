const express = require("express");
const multer = require("multer");
const emailService = require("./src/services/emailService"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const authRoutes = require("./src/routes/AuthRoute"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const getDiskUsage = require("./src/controllers/diskUsageController");
const getInbox = require("./src/services/checkMail");
const connectDB = require("./src/middlewares/connectDB");
const fetchNewEmails = require("./src/services/FetchNewEmail");
const app = express();
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const cors = require("cors");
const PORT = 3000;
const { CronJob } = require("cron");
const dotenv = require("dotenv");
const FetchNewEmails = require("./src/services/FetchNewEmail");
const {
  FetchEmails,
  FetchEmail,
} = require("./src/controllers/emailController");
const EmailModel = require("./src/models/emailModel");
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);
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
    const targetPath = req.body.targetPath || "Uploads";
    const fullPath = path.join(__dirname, targetPath);
    fs.mkdirSync(fullPath, { recursive: true });
    cb(null, fullPath);
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

app.use(cors());
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

app.get("/explorer", async (req, res) => {
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

    // รวมไฟล์ทั้งหมดจากหลาย directory เป็น array เดียว
    const mergedResults = allResults.flat();

    res.json(mergedResults);
  } catch (err) {
    console.error("❌ Error reading directories:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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

const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const targetPath = req.query.targetPath || "Uploads";
      const uploadPath = path.join(__dirname, targetPath);
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  }),
});

app.post("/upload", uploadMiddleware.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    message: "File uploaded successfully",
    filename: req.file.originalname,
    path: req.file.path,
  });
});
const fsPromises = require("fs").promises;

app.delete("/delete", async (req, res) => {
  try {
    let targetPath = req.query.path;
    if (!targetPath) {
      return res.status(400).json({ error: "No path specified" });
    }

    // ถ้ามีคำว่า "Uploads/" ข้างหน้าให้ตัดออก
    if (targetPath.startsWith("Uploads/")) {
      targetPath = targetPath.slice("Uploads/".length);
    }

    const sanitizedPath = path
      .normalize(targetPath)
      .replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(__dirname, "Uploads", sanitizedPath);

    console.log("Deleting path:", fullPath); // debug

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

  // Recursive walk
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

app.post("/create-folder", async (req, res) => {
  const filePath = req.query.path || "Uploads";
  const folderName = req.query.foldername;
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

    res.status(201).json({
      message: "📁 Folder created successfully",
      path: path.join(sanitizedPath, folderName),
    });
  } catch (error) {
    console.error("❌ Error creating folder:", error);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

const fetchGAReport = async (Granularity = "daily") => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: "./src/credentials/abiding-ion-453707-v2-8d672386f50c.json",
      scopes: "https://www.googleapis.com/auth/analytics.readonly",
    });

    const analyticsData = google.analyticsdata("v1beta");
    const authClient = await auth.getClient();
    google.options({ auth: authClient });
    let dimensionName;
    let startDate;

    switch (Granularity) {
      case "monthly":
        dimensionName = "month";
        startDate = "90daysAgo";
        break;
      case "weekly":
        dimensionName = "week";
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
  }
};
app.get("/ga4-report", async (req, res) => {
  const { granularity = "daily" } = req.query;

  if (cacheGAData) {
    return res.json(cacheGAData);
  }

  try {
    const data = await fetchGAReport(granularity);
    cacheGAData = data;
    res.json(data);
  } catch (error) {
    console.error("GA Report error:", error);
    res.status(500).json({ error: "Failed to fetch GA report" });
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
