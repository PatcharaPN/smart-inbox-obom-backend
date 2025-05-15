const express = require("express");
const emailService = require("./src/services/emailService"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const authRoutes = require("./src/routes/AuthRoute"); // โมเดลที่สร้างไว้ก่อนหน้านี้
const getDiskUsage = require("./src/controllers/diskUsageController");
const app = express();
const cors = require("cors");
const PORT = 3000;
const dotenv = require("dotenv");
const { FetchEmail } = require("./src/controllers/emailController");
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use("/auth", authRoutes);
app.get("/", (req, res) => {
  res.send("📨 Email Service API is running");
});

dotenv.config();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
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
app.get("/fetch-email", FetchEmail);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
