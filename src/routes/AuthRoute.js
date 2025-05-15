const authController = require("../controllers/authController");
const express = require("express");
const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/user/:id", authController.getUser);

module.exports = router;
