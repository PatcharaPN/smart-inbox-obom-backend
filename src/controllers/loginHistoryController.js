const LoginHistory = require("../../src/models/loginHistoryModel");
const authMiddleware = require("../middlewares/authMiddleWare");

exports.getLoginHistory = async (req, res) => {
  try {
    const history = await LoginHistory.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          _id: 1,
          action: 1,
          loginAt: 1,
          createdAt: 1,
          "user.id": 1,
          "user.role": 1,
          "user.categories": 1,
          "user.username": 1,
          "user.name": 1,
          "user.email": 1,
          "user.role": 1,
          "user.profilePic": 1,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    res.status(200).json({
      history,
    });
  } catch (error) {
    res.status(500).json({
      message: "An Internal Server error",
    });
  }
};
exports.addActivityHistory = [
  authMiddleware,
  async (req, res) => {
    const { action, user } = req.body;

    if (!action || !user) {
      return res.status(400).json({ message: "User and action are required." });
    }

    try {
      const newLog = new LoginHistory({
        user,
        action,
        loginAt: new Date(),
      });

      await newLog.save();

      res.status(201).json({
        message: "Activity logged successfully.",
        data: newLog,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error while logging activity." });
    }
  },
];
