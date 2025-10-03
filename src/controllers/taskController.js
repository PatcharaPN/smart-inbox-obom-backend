const TaskModel = require("../models/taskModel");
const User = require("../models/userModel");

exports.createTask = async (req, res) => {
  try {
    const {
      titleName,
      companyName,
      companyPrefix,
      poNumber,
      dueDate,
      qtNumber,
      sale,
      approveDate,
      description,
      taskType,
    } = req.body;

    let tasks = [];
    if (req.body.tasks) {
      tasks = JSON.parse(req.body.tasks);
    }

    tasks = tasks.map((task, idx) => {
      const attachments = req.files
        .filter((f) => f.fieldname === `tasks[${idx}][attachments]`)
        .map((f) => ({
          originalName: f.originalname,
          savedName: f.filename,
          path: `/uploads/task/${f.filename}`,
          uploadedAt: new Date(),
        }));
      return { ...task, attachments };
    });

    let newTask = new TaskModel({
      titleName,
      companyName,
      companyPrefix,
      poNumber,
      qtNumber,
      dueDate,
      sale,
      approveDate,
      description,
      taskType,
      tasks,
    });

    await newTask.save();
    newTask = await newTask.populate("sale");
    res.status(201).json({ message: "สร้างงานสำเร็จ", task: newTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
  }
};

exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await TaskModel.find().populate("sale");
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await TaskModel.findById(req.params.id).populate("sale");
    if (!task) return res.status(404).json({ message: "ไม่พบงานนี้" });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
  }
};

exports.getTaskListViews = async (req, res) => {
  try {
    const task = await TaskModel.find(
      {},
      "titleName companyName tasks.material isApprove dueDate taskType"
    ).populate("sale", "name surname profilePic");

    if (!task) return res.status(404).json({ message: "ไม่พบงานนี้" });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: error.message });
  }
};
exports.approveTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    const task = await TaskModel.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "ไม่พบ Task" });
    }

    task.isApprove = true;
    task.approveDate = req.body.approveDate
      ? new Date(req.body.approveDate)
      : new Date();
    task.updatedAt = new Date();

    await task.save();

    res.status(200).json({
      message: "อนุมัติคำขอเรียบร้อยแล้ว",
      task,
    });
  } catch (error) {
    console.error("approveTask error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};
exports.markPrinted = async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { filename } = req.body;

    const task = await TaskModel.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const subtask = task.tasks.id(subtaskId);
    if (!subtask) return res.status(404).json({ message: "Subtask not found" });

    const attachment = subtask.attachments.find((a) => a.filename === filename);
    if (!attachment)
      return res.status(404).json({ message: "Attachment not found" });

    attachment.hasprinted = true;
    await task.save();

    res.status(200).json({ message: "Marked as printed", task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const {
      titleName,
      companyName,
      companyPrefix,
      poNumber,
      qtNumber,
      sale,
      dueDate,
      description,
      taskType,
      tasks,
    } = req.body;

    task.titleName = titleName;
    task.companyName = companyName;
    task.companyPrefix = companyPrefix;
    task.poNumber = poNumber;
    task.qtNumber = qtNumber;
    task.sale = sale;
    task.dueDate = dueDate;
    task.description = description;
    task.taskType = taskType;
    task.tasks = JSON.parse(tasks);

    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
