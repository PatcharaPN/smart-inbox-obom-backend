const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const connectDB = require("../middlewares/connectDB");
const path = require("path");
const EmailModel = require("../models/emailModel");

const attachmentsDir = path.join(__dirname, "../attachments");

// เชื่อมต่อ MongoDB
connectDB();

// สร้างโฟลเดอร์ attachments ถ้ายังไม่มี
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
  console.log(`✅ Created 'attachments' directory at ${attachmentsDir}`);
}

const emailService = () => {
  const imap = new Imap({
    user: "salessupport@obomgauge.com",
    password: "yzkH#x!yJ3",
    host: "asia.hostneverdie.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });

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
        {
          /* const latest = results[results.length - 1]; */
        }
        const latest = results.slice(-10);

        const f = imap.fetch(latest, { bodies: "", struct: true });

        const formatSize = (bytes) => {
          if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + " GB";
          if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(2) + " MB";
          if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
          return bytes + " bytes";
        };

        f.on("message", function (msg) {
          let emailSize = 0;
          let rawEmailBuffer = [];

          msg.on("attributes", function (attrs) {
            if (attrs.size) {
              emailSize = attrs.size;
              console.log(`📏 Email Size from attributes: ${emailSize} bytes`);
            }
          });

          msg.on("body", function (stream) {
            stream.on("data", (chunk) => rawEmailBuffer.push(chunk));
            stream.on("end", async () => {
              const fullBuffer = Buffer.concat(rawEmailBuffer);
              if (!emailSize) {
                emailSize = formatSize(fullBuffer.length);
                console.log(
                  `📏 Email Size calculated from buffer: ${emailSize} bytes`
                );
              }

              try {
                const parsed = await simpleParser(fullBuffer);
                const trimmedReciever = parsed.to?.text.match(/<([^>]+)>/);
                const reciever = trimmedReciever
                  ? trimmedReciever[1]
                  : parsed.to?.text || "";

                const trimmedEmail = parsed.from?.text.match(/<([^>]+)>/);
                const email = trimmedEmail
                  ? trimmedEmail[1]
                  : parsed.from?.text || "";

                console.log("📨 Latest Email:");
                console.log("From:", parsed.from.text);
                console.log("Subject:", parsed.subject);
                console.log("Text:", parsed.text);

                const emailData = {
                  from: email || "",
                  to: reciever || "",
                  cc: parsed.cc?.text || "",
                  bcc: parsed.bcc?.text || "",
                  subject: parsed.subject,
                  text: parsed.text,
                  date: parsed.date,
                  size: emailSize,
                  attachments: parsed.attachments.map((att) => ({
                    filename: att.filename,
                    contentType: att.contentType,
                    contentDisposition: att.contentDisposition,
                    content: att.content.toString("base64"),
                  })),
                };

                // Save to MongoDB
                const savedEmail = await EmailModel.create(emailData);
                console.log("✅ Email saved to MongoDB:", savedEmail._id);

                // Save attachments to disk
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

                  fs.mkdirSync(emailAttachmentsDir, { recursive: true });
                  fs.mkdirSync(footerAttachmentsDir, { recursive: true });

                  parsed.attachments.forEach((attachment) => {
                    const targetDir = attachment.filename.includes(
                      "messageImage"
                    )
                      ? footerAttachmentsDir
                      : emailAttachmentsDir;

                    const filePath = path.join(targetDir, attachment.filename);
                    fs.writeFile(filePath, attachment.content, (err) => {
                      if (err) {
                        console.error("❌ Error saving attachment:", err);
                      } else {
                        console.log(`✅ Attachment saved at ${filePath}`);
                      }
                    });
                  });
                }
              } catch (err) {
                console.error("❌ Error parsing or saving email:", err);
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
    console.error("❌ IMAP Error:", err);
  });

  imap.once("end", function () {
    console.log("✅ Done.");
  });

  imap.connect();
};

module.exports = emailService;
