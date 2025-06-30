const express = require("express");
const router = express.Router();
const applicationController = require("../controllers/applicationController");

router.post("/submit", applicationController.submitApplication);
router.get("/applicant", applicationController.getAllApplicant);
router.put("/edit/:id", applicationController.editApplicantStatus);
router.delete("/delete/:id", applicationController.deleteApplicant);
module.exports = router;
