const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    mongoose
      .connect("mongodb://100.127.64.22:27017/", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => console.log("✅ MongoDB connected"))
      .catch((err) => console.error("❌ MongoDB connection error:", err));
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
  }
};

module.exports = connectDB;
