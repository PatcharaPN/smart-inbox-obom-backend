const authController = require("../controllers/authController");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const upload = require("../middlewares/uploadMiddleWare");

router.post("/login", authController.login);
router.get("/users", authController.getUsers);
router.post("/register", authController.register);
router.get("/me", authController.getUserProfile);
router.get("/user/:id", authController.getUserById);
router.put("/user/edit", authController.updateEmailAndPassword);
router.put("/me/edit", authController.editUserByCredential);
router.put(
  "/upload-profile-pic",
  upload.single("profilePic"),
  authController.uploadProfilePic
);

module.exports = router;
