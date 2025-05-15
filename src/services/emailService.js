const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const connectDB = require("../middlewares/connectDB");
const path = require("path");
const EmailModel = require("../models/emailModel");
const attachmentsDir = path.join(__dirname, "../attachments");

connectDB(); // เชื่อมต่อ MongoDB
if (!fs.existsSync(attachmentsDir)) {
  // ถ้าไม่มี, ให้สร้างโฟลเดอร์ขึ้นมา
  fs.mkdirSync(attachmentsDir, { recursive: true });
  console.log(`✅ Created 'attachments' directory at ${attachmentsDir}`);
}
// เชื่อมต่อ MongoDB

const emailService = () => {
  const imap = new Imap({
    user: "drakenx00@gmail.com",
    password: "pihb vkob wmqk gtpx", // หรือใช้ app password
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });

  // เชื่อมต่อ inbox
  function openInbox(cb) {
    imap.openBox("INBOX", false, cb);
  }

  imap.once("ready", function () {
    openInbox(function (err, box) {
      if (err) throw err;

      imap.search(["ALL"], function (err, results) {
        if (err || !results || results.length === 0) {
          console.log("📭 No emails found.");
          return imap.end();
        }

        const latest = results[results.length - 1]; // เลือกอีเมลล่าสุด

        const f = imap.fetch(latest, { bodies: "" });

        f.on("message", function (msg) {
          msg.on("body", function (stream) {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error("❌ Error parsing email:", err);
                return;
              }

              console.log("📨 Latest Email:");
              console.log("From:", parsed.from.text);
              console.log("Subject:", parsed.subject);
              console.log("Text:", parsed.text);

              // จัดเตรียมข้อมูลทั้งหมดที่ต้องการบันทึกลง MongoDB
              const emailData = {
                from: parsed.from.text,
                subject: parsed.subject,
                text: parsed.text,
                date: parsed.date,
                attachments: parsed.attachments.map((att) => ({
                  filename: att.filename,
                  contentType: att.contentType,
                  contentDisposition: att.contentDisposition,
                  content: att.content.toString("base64"), // เก็บไฟล์เป็น base64 เพื่อส่ง
                })),
              };

              // บันทึกอีเมลลง MongoDB
              try {
                const savedEmail = await EmailModel.create(emailData);
                console.log("✅ Email saved to MongoDB:", savedEmail._id);
              } catch (dbErr) {
                console.error("❌ Error saving to MongoDB:", dbErr);
              }

              // บันทึกไฟล์แนบ (ถ้ามี)
              if (parsed.attachments.length > 0) {
                const emailDate = new Date(parsed.date);
                const folderName = `${emailDate.getFullYear()}-${(
                  emailDate.getMonth() + 1
                )
                  .toString()
                  .padStart(2, "0")}-${emailDate
                  .getDate()
                  .toString()
                  .padStart(2, "0")}`;
                const emailAttachmentsDir = path.join(
                  attachmentsDir,
                  folderName
                );
                const footerAttachmentsDir = path.join(
                  emailAttachmentsDir,
                  "footer"
                );

                if (!fs.existsSync(emailAttachmentsDir)) {
                  // ถ้าไม่มี, ให้สร้างโฟลเดอร์ขึ้นมา
                  fs.mkdirSync(emailAttachmentsDir, { recursive: true });
                  console.log(
                    `✅ Created '${folderName}' directory at ${emailAttachmentsDir}`
                  );
                }
                if (!fs.existsSync(footerAttachmentsDir)) {
                  fs.mkdirSync(footerAttachmentsDir, { recursive: true });
                  console.log(
                    `✅ Created 'footer' folder: ${footerAttachmentsDir}`
                  );
                }

                parsed.attachments.forEach((attachment) => {
                  console.log(`📎 Found attachment: ${attachment.filename}`);

                  // ตรวจสอบว่าเป็นไฟล์ footer หรือไม่
                  if (attachment.filename.includes("messageImage")) {
                    // ถ้าเป็น footer ให้บันทึกในโฟลเดอร์ footer
                    const footerFilePath = path.join(
                      footerAttachmentsDir,
                      attachment.filename
                    );
                    fs.writeFile(footerFilePath, attachment.content, (err) => {
                      if (err) {
                        console.error("❌ Error saving footer file:", err);
                      } else {
                        console.log(
                          `✅ Footer attachment saved at ${footerFilePath}`
                        );
                      }
                    });
                    return;
                  }

                  // ถ้าไม่ใช่ footer ให้บันทึกในโฟลเดอร์หลัก
                  const filePath = path.join(
                    emailAttachmentsDir,
                    attachment.filename
                  );
                  fs.writeFile(filePath, attachment.content, (err) => {
                    if (err) {
                      console.error("❌ Error saving file:", err);
                    } else {
                      console.log(`✅ Attachment saved at ${filePath}`);
                    }
                  });
                });
              }
            });
          });
        });

        f.once("end", function () {
          imap.end();
        });
      });
    });
  });

  imap.once("error", function (err) {
    console.log("❌ IMAP Error:", err);
  });

  imap.once("end", function () {
    console.log("✅ Done.");
  });

  imap.connect();
};
module.exports = emailService;
