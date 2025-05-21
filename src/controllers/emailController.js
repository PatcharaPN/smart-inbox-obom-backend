const EmailModel = require("../models/emailModel");
const Email = require("../models/emailModel");
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

exports.FetchEmail = async (req, res) => {
  const search = req.query.search;
  const folder = req.query.folder;
  const selectedYear = req.query.year;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const skip = (page - 1) * limit;

  try {
    const filter = {};
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
    if (search && search.trim() !== "") {
      const searchRegEX = new RegExp(search.trim(), "i");
      filter.$or = [
        { subject: searchRegEX },
        { text: searchRegEX },
        { from: searchRegEX },
      ];
    }
    const emails = await Email.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Email.countDocuments(filter);

    const year = await Email.aggregate([
      { $project: { year: { $year: "$date" } } },
      { $group: { _id: "$year" } },
      { $sort: { _id: -1 } },
    ]);

    res.json({
      data: emails,
      page,
      totalPage: Math.ceil(total / limit),
      total,
      year,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Fail to fetch email from server" });
  }
};
