const checkDiskSpace = require("check-disk-space").default;

exports.getDiskUsage = async (req, res) => {
  try {
    const diskSpace = await checkDiskSpace("C:\\");

    const total = diskSpace.size;
    const used = diskSpace.used;
    const free = diskSpace.free;

    const percentUsed = ((used / total) * 100).toFixed(2);
    const percentFree = ((free / total) * 100).toFixed(2);

    const diskInfo = {
      status: "success",
      totalDiskSpace: total,
      usedDiskSpace: used,
      freeDiskSpace: free,
      percentUsed: percentUsed,
      percentFree: percentFree,
    };

    res.status(200).json(diskInfo);
  } catch (error) {
    console.error("Error getting disk space:", error);
    res
      .status(500)
      .json({ status: "error", message: "Unable to retrieve disk space info" });
  }
};
