const Email = require("../models/emailModel");
exports.FetchEmail = async (req, res) => {
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
