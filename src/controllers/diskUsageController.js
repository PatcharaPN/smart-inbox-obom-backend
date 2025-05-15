const checkDiskSpace = require("check-disk-space").default;
const os = require("os");
exports.getDiskUsage = async (req, res) => {
  try {
    const diskSpace = await checkDiskSpace("/");

    const total = diskSpace.size;
    const free = diskSpace.free;
    const used = total - free;

    const percentUsed = Number(((used / total) * 100).toFixed(2));
    const percentFree = Number(((free / total) * 100).toFixed(2));

    const diskInfo = {
      status: "success",
      totalDiskSpace: total,
      usedDiskSpace: used,
      freeDiskSpace: free,
      percentUsed,
      percentFree,
    };

    res.status(200).json(diskInfo);
  } catch (error) {
    console.error("Error getting disk space:", error);
    res
      .status(500)
      .json({ status: "error", message: "Unable to retrieve disk space info" });
  }
};

exports.getRamUsage = async (req, res) => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percentUsed = Number(((used / total) * 100).toFixed(2));
  const percentFree = Number(((free / total) * 100).toFixed(2));
  const ramInfo = {
    status: "success",
    totalRam: total,
    usedRam: used,
    freeRam: free,
    percentUsed,
    percentFree,
  };
  res.status(200).json(ramInfo);
};
