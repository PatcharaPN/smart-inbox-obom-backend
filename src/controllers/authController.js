const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
};

exports.register = async (req, res) => {
  const {
    username,
    email,
    password,
    role,
    name,
    surname,
    phoneNumber,
    isAdmin,
  } = req.body;
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
      name,
      surname,
      phoneNumber,
      isAdmin,
      password: hashedPassword,
    });
    await newUser.save();
    const token = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
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
    if (!user)
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });

    const userData = user.toObject();
    delete userData.password;

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      status: "success",
      message: "User logged in successfully",
      data: {
        user: userData,
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      status: "error",
      message: "Error logging in user",
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

// exports.refresh = (req, res) => {
//   const refreshToken = req.cookies.refreshToken;
//   if (!refreshToken) return res.sendStatus(401);

//   jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, user) => {
//     if (err) return res.sendStatus(403);

//     const accessToken = generateAccessToken({
//       id: user.id,
//       email: user.email,
//       role: user.role,
//     });

//     res.cookie("accessToken", accessToken, {
//       httpOnly: true,
//       secure: false,
//       sameSite: "Lax",
//       maxAge: 15 * 60 * 1000,
//     });

//     res.status(200).json({ message: "Token refreshed" });
//   });
// };
// exports.logout = (req, res) => {
//   res
//     .clearCookie("accessToken", { httpOnly: true, sameSite: "Strict" })
//     .clearCookie("refreshToken", { httpOnly: true, sameSite: "Strict" })
//     .status(200)
//     .json({ status: "success", message: "Logged out successfully" });
// };

exports.getUserProfile = async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token)
      return res.status(401).json({
        message: "No token Provided",
      });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({ status: "success", data: { user: userData } });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error retrieving user",
      error: error.message,
    });
  }
};

exports.editUserByCredential = async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const updateData = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const userOBJ = updatedUser.toObject();
    delete userOBJ.password;
    res.status(200).json({
      status: "success",
      data: { user: userOBJ },
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      status: "Success",
      data: userData,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error retrieving user",
      error: error.message,
    });
  }
};
exports.uploadProfilePic = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const profilePath = req.file?.path.replace(/\\/g, "/");

    user.profilePic = profilePath;
    await user.save();

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      status: "success",
      message: "Profile picture updated",
      data: { user: userData },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error uploading profile picture",
      error: error.message,
    });
  }
};
