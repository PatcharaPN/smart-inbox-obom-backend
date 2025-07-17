const EmployeeCard = require("../models/cardModel");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const os = require("os");
const fsPromises = require("fs").promises;

const fontPath = path.join(
  __dirname,
  "../../src/assets/fonts/NotoSansThai-SemiBold.ttf"
);

const mmToPt = (mm) => (mm * 72) / 25.4;

function getDimensions(cardType) {
  if (cardType === "vertical") {
    return {
      width: mmToPt(54),
      height: mmToPt(85.6),
      radius: mmToPt(15.5),
      bgPath: path.join(__dirname, "../assets/Vertical.png"),
    };
  }

  return {
    width: mmToPt(85.6),
    height: mmToPt(54),
    radius: mmToPt(14.5),
    bgPath: path.join(__dirname, "../assets/Horizontal.png"),
  };
}

function drawEmployeeCard(doc, data, dims, photoPath, cardType = "horizontal") {
  const { width, height, radius, bgPath } = dims;
  const { firstName, lastName, employeeId, department, nickname, note } = data;

  doc.image(bgPath, 0, 0, { width, height });

  let centerX, centerY, textStartX, textStartY;
  const padding = mmToPt(5);
  const fontSize = 9;

  if (cardType === "vertical") {
    // ตัวอย่างวางรูปบนตรงกลาง กึ่งกลางแนวแกน X, ห่างบนเล็กน้อย
    centerX = width / 2;
    centerY = radius + mmToPt(13.2);

    // ข้อความเริ่มจากด้านล่างของรูป
    textStartX = mmToPt(10);
    textStartY = centerY + radius + mmToPt(9);
  } else {
    // แนวนอน (default)
    centerX = width - radius - mmToPt(5);
    centerY = height / 2;
    textStartX = mmToPt(10);
    textStartY = mmToPt(17);
  }

  let currentY = textStartY;

  doc.font("S").fillColor("#FFFFFF").fontSize(fontSize);
  doc.text(
    `${firstName}${nickname ? ` (${nickname})` : ""}`,
    textStartX,
    currentY
  );

  if (lastName) {
    currentY += padding;
    doc.text(lastName, textStartX, currentY);
  }

  currentY += padding;
  doc.text(`ID: ${employeeId}`, textStartX, currentY);

  currentY += padding;
  doc.text(`Section: ${department}`, textStartX, currentY);

  if (note) {
    currentY += padding;
    doc.text(`หมายเหตุ: ${note}`, textStartX, currentY, {
      width: width - textStartX * 2 - radius * 2,
    });
  }

  // วาดรูปวงกลม
  doc.save();
  doc.circle(centerX, centerY, radius).clip();
  doc.image(photoPath, centerX - radius, centerY - radius, {
    width: radius * 2,
    height: radius * 2,
  });
  doc.restore();

  // วาดกรอบวงกลม
  doc.lineWidth(1.5).strokeColor("#FFFFFF");
  doc.circle(centerX, centerY, radius).stroke();
}

exports.createCard = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      employeeId,
      department,
      employeeType,
      cardType = "horizontal", // กำหนด default เป็น horizontal
      nickname,
      note,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const dims = getDimensions(cardType);

    // แปลงรูปภาพด้วย sharp
    const outputPath = path.join(os.tmpdir(), `processed-${Date.now()}.png`);
    await sharp(req.file.path)
      .resize({
        width: 300,
        height: 300,
        fit: "cover",
        position: "center",
        withoutEnlargement: true,
      })
      .modulate({ saturation: 1.3 })
      .png({
        compressionLevel: 0,
        quality: 100,
        adaptiveFiltering: false,
      })
      .toFile(outputPath);
    const finalFilename = `${employeeId}-${Date.now()}.png`;
    const finalPath = path.join(
      __dirname,
      "../../uploads/employees",
      finalFilename
    );
    const imagePath = `uploads/employees/${finalFilename}`;
    await fs.promises.rename(outputPath, finalPath);
    // บันทึกข้อมูลลงฐานข้อมูล
    const newCard = new EmployeeCard({
      firstName,
      lastName,
      employeeId,
      department,
      employeeType,
      cardType,
      nickname,
      imagePath,
      note,
    });
    await newCard.save();

    // สร้าง PDF
    const doc = new PDFDocument({ size: [dims.width, dims.height], margin: 0 });
    doc.registerFont("S", fontPath);
    const pdfFilename = `EmployeeCard-${employeeId}.pdf`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdfFilename}"`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    drawEmployeeCard(
      doc,
      { firstName, lastName, employeeId, department, nickname, note },
      dims,
      finalPath,
      cardType
    );

    doc.end();

    // ลบไฟล์ชั่วคราว
    res.on("finish", () => {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("ลบไฟล์ต้นฉบับไม่สำเร็จ:", err);
      });
      fs.unlink(outputPath, (err) => {
        if (err) console.error("ลบไฟล์แปลงแล้วไม่สำเร็จ:", err);
      });
    });
  } catch (error) {
    console.error("Error generating card:", error);
    res
      .status(500)
      .json({ message: "Error creating employee card", error: error.message });
  }
};
exports.getAllCards = async (req, res) => {
  try {
    const cards = await EmployeeCard.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: cards });
  } catch (error) {
    console.error("Error fetching employee cards:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
};
exports.generateCardByUID = async (req, res) => {
  try {
    const cardtype = req.query.orientation || "horizontal";
    const employeeId = req.params.id;
    const card = await EmployeeCard.findById(employeeId);
    if (!card) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบบัตรพนักงาน" });
    }
    const dims = getDimensions(cardtype);
    const imagePath = path.join(__dirname, "../../", card.imagePath);

    const doc = new PDFDocument({ size: [dims.width, dims.height], margin: 0 });
    doc.registerFont("S", fontPath);
    const pdfFilename = `EmployeeCard-${card.employeeId}.pdf`;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdfFilename}"`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);
    drawEmployeeCard(
      doc,
      {
        firstName: card.firstName,
        lastName: card.lastName,
        employeeId: card.employeeId,
        department: card.department,
        nickname: card.nickname,
        note: card.note,
      },
      dims,
      imagePath,
      cardtype
    );
    doc.end();
  } catch (error) {
    console.error("Error generating card by UID:", error);
    res
      .status(500)
      .json({ message: "ไม่สามารถสร้างบัตรได้", error: error.message });
  }
};
exports.deleteEmployeeCardById = async (req, res) => {
  try {
    const { id } = req.params;
    const card = await EmployeeCard.findByIdAndDelete(id);
    if (!card) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบบัตรพนักงาน" });
    }

    const imagePath = path.join(__dirname, "../../", card.imagePath);
    try {
      await fsPromises.unlink(imagePath);
    } catch (err) {
      console.error("ลบไฟล์รูปภาพไม่สำเร็จ:", err);
    }

    res.status(200).json({ success: true, message: "ลบบัตรพนักงานสำเร็จ" });
  } catch (error) {
    console.error("Error deleting employee card:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
};
