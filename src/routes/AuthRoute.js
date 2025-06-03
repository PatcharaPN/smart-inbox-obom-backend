const authController = require("../controllers/authController");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/profilePics";

    // ✅ Check if folder exists, if not, create it
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true }); // recursive = creates parent folders if needed
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/register", authController.register);
router.get("/me", authController.getUserProfile);
router.get("/user/:id", authController.getUserById);
router.post("/refresh", authController.refresh);
router.put("/me/edit", authController.editUserByCredential);
router.put(
  "/upload-profile-pic",
  upload.single("profilePic"),
  authController.uploadProfilePic
);

module.exports = router;
