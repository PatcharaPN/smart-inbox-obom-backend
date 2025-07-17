const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");

router.get("/hasImap", emailController.CheckIMAP);
router.post("/sync/all-emails", emailController.autoFetchEmails);
module.exports = router;
