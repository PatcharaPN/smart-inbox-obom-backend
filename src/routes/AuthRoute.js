const authController = require("../controllers/authController");
const express = require("express");
const router = express.Router();

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/register", authController.register);
router.get("/me", authController.getUserProfile);
router.get("/user/:id", authController.getUserById);
router.post("/refresh", authController.refresh);
router.put("/me/edit", authController.editUserByCredential);
module.exports = router;
