const authController = require("../controllers/authController");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/profilePics";

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post("/login", authController.login);
router.get("/users", authController.getUsers);
router.post("/register", authController.register);
router.get("/me", authController.getUserProfile);
router.get("/user/:id", authController.getUserById);
router.put("/me/edit", authController.editUserByCredential);
router.put(
  "/upload-profile-pic",
  upload.single("profilePic"),
  authController.uploadProfilePic
);

module.exports = router;
