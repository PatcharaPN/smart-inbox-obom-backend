const express = require("express");
const multer = require("multer");
const emailService = require("./src/services/emailService"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const authRoutes = require("./src/routes/AuthRoute"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const emailRoutes = require("./src/routes/EmailRoute");
const jobRoutes = require("./src/routes/JobRoute");
const getDiskUsage = require("./src/controllers/diskUsageController");
const getInbox = require("./src/services/checkMail");
const authMiddleware = require("./src/middlewares/authMiddleWare");
const connectDB = require("./src/middlewares/connectDB");
const fetchNewEmails = require("./src/services/FetchNewEmail");
const axios = require("axios");
const app = express();
const User = require("./src/models/userModel");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const cors = require("cors");
const PORT = 3000;
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const Upload = require("./src/models/uploadModel");
const FetchNewEmails = require("./src/services/FetchNewEmail");
const notificationRoutes = require("./src/routes/NotificationRoute");
const http = require("http");
const cron = require("node-cron");
const {
  FetchEmails,
  FetchEmail,
} = require("./src/controllers/emailController");
const EmailModel = require("./src/models/emailModel");
const employeeCardRoutes = require("./src/routes/CardRoute");
const EmailAccountModel = require("./src/models/emailAccounts");
const { startSocketServer } = require("./src/configs/socketio");
const { getLoginHistory } = require("./src/controllers/loginHistoryController");
const LoginHistory = require("./src/models/loginHistoryModel");
dotenv.config();
app.use(
  cors({
    origin: [
      "https://try.responsiveviewer.org",
      "http://database.obomgauge.com",
      "http://db.obomgauge.com",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://100.127.64.22",
      "https://obomgauge.com",
    ],
    methods: ["GET", "DELETE", "POST", "PUT"],
    credentials: true,
  })
);
const server = http.createServer(app);
app.use(express.json());
startSocketServer(server);
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

app.use(cookieParser());
const uploadPath = path.join(__dirname, "uploads");

const baseUploadPath = path.join(__dirname);

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
    // แปลงชื่อไฟล์จาก latin1 เป็น utf8
    const originalnameBuffer = Buffer.from(file.originalname, "latin1");
    const originalnameUtf8 = originalnameBuffer.toString("utf8");
    cb(null, originalnameUtf8);
  },
});

const upload = multer({ storage });
// const job = new CronJob("0 8 * * *", () => {
//   fetchNewEmails();
// });
// job.start();
app.use("/photos", express.static(path.join(__dirname, "public/photos")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));
app.use("/employee-card", employeeCardRoutes);
app.use("/api", notificationRoutes);
// Upload PDF
app.use("/emails", emailRoutes);
app.use("/auth", authRoutes);
app.use("/api/job", jobRoutes);
app.get("/api/connectionCheck", (req, res) => {
  res.status(200).send("OK");
});

app.get("/", (req, res) => {
  res.send("📨 Email Service API is running");
});

app.use("/attachments", express.static(path.join(__dirname, "attachments")));

cron.schedule("*/10 * * * *", async () => {
  console.log("⏰ Running auto email sync at", new Date().toLocaleString());
  try {
    const response = await axios.post(
      "http://100.127.64.22:3000/emails/sync/all-emails"
    );
    console.log("✅ Auto sync result:", response.data.message);
  } catch (error) {
    console.error("❌ Auto sync failed:", error.message || error);
  }
});
app.post("/fetch-new", authMiddleware, async (req, res) => {
  const { folders } = req.body;
  const userId = req.user._id;
  const department = req.user.role;
  console.log(department);

  if (!userId) {
    return res.status(400).json({
      error: "User ID is required",
    });
  }

  try {
    await fetchNewEmails({
      userId,
      folders,
      department,
    });

    return res.status(200).json({ message: "📬 Fetching latest email..." });
  } catch (error) {
    if (error.code === "NO_IMAP") {
      return res.status(400).json({
        success: false,
        message:
          "ไม่สามารถซิงค์ข้อมูลได้ เนื่องจากบัญชีไม่มีข้อมูล IMAP กรุณาติดต่อฝ่าย IT",
      });
    }

    console.error("❌ Unexpected error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดบางอย่าง",
    });
  }
});
app.post("/copy", authMiddleware, async (req, res) => {
  const { sourcePath, targetFilename } = req.body;
  console.log(sourcePath, targetFilename);

  if (!sourcePath || !targetFilename) {
    return res
      .status(400)
      .json({ error: "Missing sourcePath or targetFilename" });
  }

  try {
    const fileDoc = await Upload.findOne({ path: sourcePath });
    if (!fileDoc)
      return res.status(404).json({ error: "Source file not found" });

    const sourceFullPath = path.join(__dirname, sourcePath);
    const targetFullPath = path.join(
      path.dirname(sourceFullPath),
      targetFilename
    );

    await fsPromises.copyFile(sourceFullPath, targetFullPath);

    const targetRelativePath = path
      .relative(__dirname, targetFullPath)
      .replace(/\\/g, "/");

    const newUpload = new Upload({
      filename: targetFilename,
      path: targetRelativePath,
      uploaderId: req.user._id,
      uploadedAt: new Date(),
      deleted: false,
    });

    await newUpload.save();

    return res.json({ message: "File copied successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to copy file" });
  }
});
app.post("/paste", authMiddleware, async (req, res) => {
  try {
    const { sourcePath, targetDir, newFilename, action } = req.body;

    if (!sourcePath || !targetDir || !newFilename) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const baseUploadPath = path.join(__dirname);

    const fullSourcePath = path.join(baseUploadPath, sourcePath);
    const fullTargetPath = path.join(baseUploadPath, targetDir, newFilename);

    if (
      !fullSourcePath.startsWith(baseUploadPath) ||
      !fullTargetPath.startsWith(baseUploadPath)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (action === "copy") {
      await fs.promises.copyFile(fullSourcePath, fullTargetPath);

      const targetRelativePath = path
        .relative(baseUploadPath, fullTargetPath)
        .replace(/\\/g, "/");
      const newUpload = new Upload({
        filename: newFilename,
        path: targetRelativePath,
        uploaderId: req.user._id,
        uploadedAt: new Date(),
        deleted: false,
      });
      const saveAction = new LoginHistory({
        user: req.user._id,
        action: `คัดลอก ${newFilename} ไป ${targetRelativePath}`,
        loginAt: new Date(),
      });
      await saveAction.save();
      await newUpload.save();
    } else if (action === "cut") {
      await fs.promises.rename(fullSourcePath, fullTargetPath);
      const sourceRelativePath = path
        .relative(baseUploadPath, fullSourcePath)
        .replace(/\\/g, "/");
      const targetRelativePath = path
        .relative(baseUploadPath, fullTargetPath)
        .replace(/\\/g, "/");
      const updated = await Upload.findOneAndUpdate(
        { path: sourceRelativePath },
        { $set: { path: targetRelativePath, filename: newFilename } }
      );
      if (!updated) {
        return res.status(404).json({ error: "Source file record not found" });
      }
      const saveAction = new LoginHistory({
        user: req.user._id,
        action: `ย้าย ${newFilename} ไป ${targetRelativePath}`,
        loginAt: new Date(),
      });
      await saveAction.save();
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    res.status(200).json({ message: `${action} successful` });
  } catch (error) {
    console.error("Paste error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/cut", authMiddleware, async (req, res) => {
  try {
    let { sourcePath, targetFilename } = req.body;

    if (!sourcePath || !targetFilename) {
      return res
        .status(400)
        .json({ error: "Missing sourcePath or targetFilename" });
    }

    const baseUploadPath = path.join(__dirname, "uploads");

    const fullSourcePath = path.join(baseUploadPath, sourcePath);
    const fullTargetPath = path.join(baseUploadPath, targetFilename);

    if (
      !fullSourcePath.startsWith(baseUploadPath) ||
      !fullTargetPath.startsWith(baseUploadPath)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      await fs.access(fullSourcePath);
    } catch {
      return res.status(404).json({ error: "Source file not found" });
    }

    await fs.rename(fullSourcePath, fullTargetPath);

    return res.status(200).json({ message: "File moved successfully" });
  } catch (error) {
    console.error("Cut file error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/fetch-email", authMiddleware, async (req, res) => {
  let department;
  const { startDate, endDate, folders } = req.body;
  const userId = req.user._id;
  department = req.user.role;
  console.log(req.body);

  if (!userId) {
    return res.status(400).json({
      error: "User ID is required",
    });
  }
  try {
    await emailService({
      userId,
      startDate,
      endDate,
      folders,
      department,
    });

    res.status(200).json({ message: "📬 Fetching latest email..." });
  } catch (err) {
    if (err.code === "NO_IMAP") {
      return res.status(400).json({
        success: false,
        message:
          "ไม่สามารถซิงค์ข้อมูลได้ เนื่องจากบัญชีไม่มีข้อมูล IMAP กรุณาติดต่อฝ่าย IT",
      });
    }

    console.error("❌ Unexpected error:", err);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดบางอย่าง",
    });
  }
});
app.get("/ram-usage", getDiskUsage.getRamUsage);
app.get("/disk-usage", getDiskUsage.getDiskUsage);

app.get("/emails", FetchEmail);

app.get("/fetch-emails", FetchEmails);

const BASE_DIR = path.join(__dirname, "uploads");

const getFileCategory = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext))
    return "รูปภาพ";
  if ([".mp4", ".avi", ".mkv", ".mov", ".webm"].includes(ext)) return "วิดีโอ";
  if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) return "ไฟล์เสียง";
  if ([".pdf"].includes(ext)) return "pdf";
  if ([".txt", ".md", ".log"].includes(ext)) return "ไฟล์อักษร";
  if ([".doc", ".docx"].includes(ext)) return "word";
  if ([".xls", ".xlsx"].includes(ext)) return "excel";
  if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext)) return "archive";
  return "ไฟล์";
};

app.get("/explorer", authMiddleware, async (req, res) => {
  const requestedPaths = req.query.paths
    ? req.query.paths.split(",")
    : ["Uploads"];

  try {
    const allResults = [];

    for (const requestedPath of requestedPaths) {
      // ใช้ path.join ธรรมดาแทน path.posix.join
      const fullPath = path.join(__dirname, requestedPath);
      const files = await fs.promises.readdir(fullPath, {
        withFileTypes: true,
      });

      const filePaths = files.map((file) =>
        path.join(requestedPath, file.name)
      );

      const uploads = await Upload.find({
        path: { $in: filePaths },
        deleted: false,
      }).lean();

      const uploadMap = new Map(uploads.map((u) => [u.path, u]));

      const uploaderIds = [
        ...new Set(
          uploads.map((u) => u.uploaderId?.toString()).filter(Boolean)
        ),
      ];
      const users = await User.find({ _id: { $in: uploaderIds } }).lean();
      const userMap = new Map(users.map((u) => [u._id.toString(), u.username]));

      for (const file of files) {
        const filePath = path.join(requestedPath, file.name);
        const stat = await fs.promises.stat(path.join(fullPath, file.name));

        let uploader = null;
        let uploaderId = null;

        const uploadDoc = uploadMap.get(filePath);
        if (uploadDoc) {
          uploaderId = uploadDoc.uploaderId?.toString() ?? null;
          uploader = uploaderId ? userMap.get(uploaderId) ?? null : null;
        }

        allResults.push({
          name: file.name,
          type: file.isDirectory() ? "folder" : "file",
          category: file.isDirectory() ? "Folder" : getFileCategory(file.name),
          path: filePath,
          fullPath: path.join(fullPath, file.name),
          modified: stat.mtime,
          size: file.isDirectory() ? null : stat.size,
          uploader,
          uploaderId,
        });
      }
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8"); // ตั้ง charset ให้ response
    res.json(allResults);
  } catch (error) {
    console.error("❌ Error reading directories:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// const getUploader = async (filename) => {
//   try {
//     const file = await Upload.findOne({ filename });

//     if (!file || !file.uploaderId) return null;

//     const uploader = await User.findById(file.uploaderId).select("email name");

//     return uploader ? { email: uploader.email, name: uploader.name } : null;
//   } catch (error) {
//     console.error("❌ Error getting uploader:", error);
//     return null;
//   }
// };

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
  console.log("Original filename:", req.file.originalname);
  console.log("Saved file path:", req.file.path);

  const relativePath = path
    .relative(__dirname, req.file.path)
    .replace(/\\/g, "/");

  try {
    const newUpload = new Upload({
      filename: req.file.originalname, // เก็บชื่อจริงๆ ไม่ใช่แปลงอะไร
      path: relativePath,
      uploaderId: req.user._id,
      uploadedAt: new Date(),
      deleted: false,
    });

    await newUpload.save();

    res.status(200).json({ message: "Upload complete" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Error uploading file", details: error.message });
  }
});

const fsPromises = require("fs").promises;
app.post("/rename", authMiddleware, async (req, res) => {
  const { oldPath, newFilename } = req.body;
  console.log(oldPath, newFilename);

  if (!oldPath || !newFilename) {
    return res.status(400).json({ error: "Missing oldPath or newFilename" });
  }

  try {
    const fileDoc = await Upload.findOne({ path: oldPath });
    if (!fileDoc) return res.status(404).json({ error: "File not found" });

    const userId = req.user._id;
    if (
      String(fileDoc.uploaderId) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const oldFullPath = path.join(__dirname, oldPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newFilename);

    await fsPromises.rename(oldFullPath, newFullPath);

    const newRelativePath = path
      .relative(__dirname, newFullPath)
      .replace(/\\/g, "/");

    fileDoc.filename = newFilename;
    fileDoc.path = newRelativePath;
    await fileDoc.save();

    return res.json({ message: "File renamed successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to rename file" });
  }
});

app.delete("/delete", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    let targetPath = req.query.path;

    if (!targetPath) {
      return res.status(400).json({ error: "No path specified" });
    }

    const fileDoc = await Upload.findOne({ path: targetPath });

    if (!fileDoc) {
      return res.status(404).json({
        message: `File with path ${targetPath} was not found`,
      });
    }

    if (
      String(fileDoc.uploaderId) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Permission denied" });
    }

    // sanitize path ก่อนลบไฟล์จริง
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
    } else {
      await fsPromises.unlink(fullPath);
    }

    // ถ้าลบไฟล์สำเร็จ ค่อยอัปเดตในฐานข้อมูล
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

    // บันทึกประวัติ
    const saveAction = new LoginHistory({
      user: req.user._id,
      action: `ลบ ${req.query.path}`,
      loginAt: new Date(),
    });
    await saveAction.save();

    return res.json({
      message: stats.isDirectory()
        ? "Folder deleted successfully"
        : "File deleted successfully",
    });
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
    return res.status(400).json({
      error: "Folder name must be named",
    });
  }

  try {
    const sanitizedPath = path
      .normalize(filePath)
      .replace(/^(\.\.(\/|\\|$))+/, "");

    const relativePath = path.posix.join(sanitizedPath, folderName); // <-- ใช้อันนี้ในการบันทึก DB
    const fullPath = path.join(__dirname, relativePath); // <-- สำหรับสร้างจริง

    if (fs.existsSync(fullPath)) {
      return res.status(400).json({
        error: "Folder already exists",
      });
    }

    await fs.promises.mkdir(fullPath, { recursive: true });

    const saveAction = new LoginHistory({
      user: req.user._id,
      action: `สร้างโฟลเดอร์ ${folderName}`,
      loginAt: new Date(),
    });
    await saveAction.save();
    await Upload.create({
      filename: folderName,
      path: relativePath, // ✅ บันทึกเป็น relative path
      uploaderId: uploaderId ?? null,
      uploadedAt: new Date(),
      deleted: false,
    });

    res.status(201).json({
      message: "📁 Folder created successfully",
      path: relativePath, // ✅ ส่งกลับเป็น relative เช่นกัน
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

app.get("/logs", getLoginHistory);

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
  let filePath = req.query.path;
  console.log("Incoming filePath:", filePath);

  if (!filePath) {
    return res.status(400).json({ error: "Missing file path" });
  }

  // ลบ uploads/ ถ้า user ส่งมาซ้ำ
  if (filePath.startsWith("uploads/")) {
    filePath = filePath.replace(/^uploads\//, "");
  }

  const fullFilePath = path.join(baseUploadPath, filePath);
  console.log("Resolved fullFilePath:", fullFilePath);

  // ป้องกันการเข้าถึง path ที่ผิด เช่น ../
  if (!fullFilePath.startsWith(baseUploadPath)) {
    return res.status(403).json({ error: "Access denied" });
  }

  fs.stat(fullFilePath, (err, stats) => {
    if (err || !stats.isFile()) {
      console.error("File not found:", fullFilePath);
      return res.status(404).json({ error: "File not found" });
    }

    res.sendFile(fullFilePath);
  });
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

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
