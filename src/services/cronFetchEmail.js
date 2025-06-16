const mongoose = require("mongoose");
const fetchNewEmails = require("./fetchNewEmails");
const EmailAccount = require("../models/emailAccounts");
const connectDB = require("../middlewares/connectDB");

const run = async () => {
  try {
    await connectDB();

    const accounts = await EmailAccount.find({});

    for (const account of accounts) {
      const userId = account.user;
      const department = account.department || "DefaultFolder";

      console.log(`🔁 Fetching emails for user: ${userId}`);

      try {
        await fetchNewEmails({ userId, department });
      } catch (error) {
        console.error(`❌ Error fetching emails for ${userId}:`, err.message);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ Cron job failed:", err);
    process.exit(1);
  }
};

run();
