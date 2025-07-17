const { default: mongoose } = require("mongoose");
const EmailModel = require("../models/emailModel");
const Email = require("../models/emailModel");
const emailAccounts = require("../models/emailAccounts");
const fetchNewEmails = require("../services/FetchNewEmail");
exports.FetchEmails = async (req, res) => {
  try {
    const emails = await Email.find();

    if (emails.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No emails found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Emails retrieved successfully",
      data: {
        emails,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve emails",
      error: error.message,
    });
  }
};
// exports.FetchEmail = async (req, res) => {
//   const search = req.query.search;
//   const folder = req.query.folder;
//   const selectedYear = req.query.year;
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 5;
//   const skip = (page - 1) * limit;

//   try {
//     const filter = {};
//     if (selectedYear && selectedYear !== "all") {
//       const startOfYear = new Date(`${selectedYear}-01-01T00:00:00.000Z`);
//       const endOfYear = new Date(
//         `${parseInt(selectedYear) + 1}-01-01T00:00:00.000Z`
//       );
//       filter.date = { $gte: startOfYear, $lt: endOfYear };
//     }
//     if (folder && folder !== "all") {
//       filter.folder = folder;
//     }
//     if (req.query.new === "true") {
//       const filter = {};

//       if (search && search.trim() !== "") {
//         const searchRegEX = new RegExp(search.trim(), "i");
//         filter.$or = [
//           { subject: searchRegEX },
//           { text: searchRegEX },
//           { from: searchRegEX },
//         ];
//       }

//       if (selectedYear && selectedYear !== "all") {
//         const startOfYear = new Date(`${selectedYear}-01-01T00:00:00.000Z`);
//         const endOfYear = new Date(
//           `${parseInt(selectedYear) + 1}-01-01T00:00:00.000Z`
//         );
//         filter.date = { $gte: startOfYear, $lt: endOfYear };
//       }

//       if (folder && folder !== "all") {
//         filter.folder = folder;
//       }

//       const emails = await Email.find(filter).sort({ date: -1 }).limit(7);

//       const year = await Email.aggregate([
//         { $project: { year: { $year: "$date" } } },
//         { $group: { _id: "$year" } },
//         { $sort: { _id: -1 } },
//       ]);

//       return res.json({
//         data: emails,
//         year,
//       });
//     }

//     if (search && search.trim() !== "") {
//       const searchRegEX = new RegExp(search.trim(), "i");
//       filter.$or = [
//         { subject: searchRegEX },
//         { text: searchRegEX },
//         { from: searchRegEX },
//       ];
//     }
//     const emails = await Email.find(filter)
//       .sort({ date: -1 })
//       .skip(skip)
//       .limit(limit);

//     const total = await Email.countDocuments(filter);

//     const year = await Email.aggregate([
//       { $project: { year: { $year: "$date" } } },
//       { $group: { _id: "$year" } },
//       { $sort: { _id: -1 } },
//     ]);

//     res.json({
//       data: emails,
//       page,
//       totalPage: Math.ceil(total / limit),
//       total,
//       year,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Fail to fetch email from server" });
//   }
// };
exports.FetchEmail = async (req, res) => {
  const search = req.query.search;
  const folder = req.query.folder;
  const selectedYear = req.query.year;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const skip = (page - 1) * limit;

  // ตรวจสอบว่า req.user มีค่าและมี _id
  const userId = req.user && req.user._id ? req.user._id : req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const filter = { user: userObjectId };

    if (selectedYear && selectedYear !== "all") {
      const startOfYear = new Date(`${selectedYear}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(
        `${parseInt(selectedYear) + 1}-01-01T00:00:00.000Z`
      );
      filter.date = { $gte: startOfYear, $lt: endOfYear };
    }

    if (folder && folder !== "all") {
      filter.folder = folder;
    }

    if (req.query.new === "true") {
      const searchRegEX =
        search && search.trim() !== "" ? new RegExp(search.trim(), "i") : null;

      if (searchRegEX) {
        filter.$or = [
          { subject: searchRegEX },
          { text: searchRegEX },
          { from: searchRegEX },
        ];
      }

      const emails = await Email.find(filter).sort({ date: -1 }).limit(7);

      const Resultyear = await Email.aggregate([
        { $match: { user: userObjectId } },
        { $project: { year: { $year: "$date" } } },
        { $group: { _id: "$year" } },
        { $sort: { _id: -1 } },
      ]);

      const year = Resultyear.map((item) => item._id);

      return res.json({
        data: emails,
        year,
      });
    }

    // การค้นหาตามคีย์เวิร์ด search
    const searchRegEX =
      search && search.trim() !== "" ? new RegExp(search.trim(), "i") : null;
    if (searchRegEX) {
      filter.$or = [
        { subject: searchRegEX },
        { text: searchRegEX },
        { from: searchRegEX },
      ];
    }

    // ดึงอีเมลของผู้ใช้จากฐานข้อมูลตามเงื่อนไข
    const emails = await Email.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Email.countDocuments(filter);

    const yearResult = await Email.aggregate([
      { $match: { user: userObjectId } },
      { $project: { year: { $year: "$date" } } },
      { $group: { _id: "$year" } },
      { $sort: { _id: -1 } },
    ]);
    const year = yearResult.map((item) => item._id);
    res.json({
      data: emails,
      page,
      totalPage: Math.ceil(total / limit),
      total,
      year,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch email from server" });
  }
};

// exports.FetchNewEmails = async (req, res) => {
//   try {
//     // Get the current date
//     const currentDate = new Date();

//     // emails received in the last 7 days
//     const sevenDaysAgo = new Date(
//       currentDate.setDate(currentDate.getDate() - 7)
//     );

//     // Fetch emails that are newer than 7 days
//     const newEmails = await Email.find({ date: { $gte: sevenDaysAgo } })
//       .sort({ date: -1 }) // Sort by date (newest first)
//       .limit(10); // Limit to the latest 10 emails

//     if (newEmails.length > 0) {
//       console.log("Latest new emails:", newEmails);
//       res.json({
//         success: true,
//         message: "Fetched latest new emails",
//         emails: newEmails,
//       });
//     } else {
//       console.log("No new emails found");
//       res.json({
//         success: false,
//         message: "No new emails found",
//         emails: [],
//       });
//     }
//   } catch (err) {
//     console.error("Error Fetching latest new emails:", err);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching latest new emails",
//       error: err.message,
//     });
//   }
// };

exports.CheckIMAP = async (req, res) => {
  // รับ ID จาก req
  const userId = req.user._id;

  // เช็ค ว่า User มี IMAP ไหม
  try {
    const hasIMAP = await emailAccounts.exists({ user: userId });
    // ถ้ามี ส่ง hasIMAP true ไม่มีส่ง false
    if (hasIMAP) {
      return res.status(200).json({
        hasIMAP: !!hasIMAP,
      });
    }
  } catch (error) {
    // ถ้า catch error ได้ ให้ส่ง Server Error พร้อม status 500
    console.error("CheckIMAP error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.autoFetchEmails = async (req, res) => {
  try {
    const accounts = await emailAccounts.find({});

    for (const account of accounts) {
      try {
        await fetchNewEmails({
          userId: account.user,
          department: account.folder,
          folders: ["INBOX", "Sent", "Trash"],
        });

        console.log(`✅ Synced emails for user ${account.user}`);
      } catch (err) {
        console.error(`❌ Failed to sync user ${account.user}:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "📬 Finished syncing all email accounts.",
    });
  } catch (err) {
    console.error("❌ Failed to fetch EmailAccounts:", err.message);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงบัญชีอีเมล",
    });
  }
};
