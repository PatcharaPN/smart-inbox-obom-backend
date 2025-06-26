const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");

router.get("/hasImap", emailController.CheckIMAP);

module.exports = router;
