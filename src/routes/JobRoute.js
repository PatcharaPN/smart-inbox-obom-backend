const express = require("express");
const router = express.Router();
const applicationController = require("../controllers/applicationController");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./attachments/applicant_attachments";

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
router.post(
  "/submit",
  upload.single("resume"),
  applicationController.submitApplication
);
router.get("/applicant", applicationController.getAllApplicant);
router.put("/edit/:id", applicationController.editApplicantStatus);
router.delete("/delete/:id", applicationController.deleteApplicant);
module.exports = router;
