const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

exports.register = async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      role,
      password: hashedPassword,
    });
    await newUser.save();
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    const userData = newUser.toObject();
    delete userData.password;
    res.status(201).json({
      status: "success",
      message: "User registered successfully",
      data: {
        role: userData.role,
        user: userData,
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error registering user",
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    const userData = user.toObject();
    delete userData.password;
    res.status(200).json({
      status: "success",
      message: "User logged in successfully",
      data: {
        role: userData.role,
        user: userData,
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error logging in user",
      error: error.message,
    });
  }
};

exports.getUser = async (req, res) => {
  // ตรวจสอบว่า req.user.id มีค่า
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({
      status: "error",
      message: "User ID is missing",
    });
  }

  try {
    // ดึงข้อมูลผู้ใช้จากฐานข้อมูลโดยใช้ userId
    const user = await User.findById(userId);

    // ถ้าผู้ใช้ไม่พบ
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // เปลี่ยนแปลงข้อมูลผู้ใช้เป็นรูปแบบ Object
    const userData = user.toObject();

    // ลบข้อมูลที่ไม่ต้องการ (password, email)
    delete userData.password;
    delete userData.email;

    // ส่งข้อมูลผู้ใช้ที่ต้องการ
    res.status(200).json({
      status: "success",
      message: "User retrieved successfully",
      data: {
        username: userData.username, // ส่งเฉพาะข้อมูลที่ไม่อ่อนไหว
      },
    });
  } catch (error) {
    // ถ้ามีข้อผิดพลาด
    res.status(500).json({
      status: "error",
      message: "Error retrieving user",
      error: error.message,
    });
  }
};
