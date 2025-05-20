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
    openInbox(async function (err, box) {
      if (err) throw err;

      imap.search(
        [
          ["SINCE", "30-May-2024"],
          ["BEFORE", "31-May-2024"],
        ],
        async function (err, results) {
          if (err || !results || results.length === 0) {
            console.log("📭 No emails found.");
            return imap.end();
          }
          const latest = results.slice(-1000);
          const batchSize = 100;

          for (let i = 0; i < latest.length; i += batchSize) {
            const batch = latest.slice(i, i + batchSize);

            console.log(
              `📦 Fetching batch ${i / batchSize + 1} of ${Math.ceil(
                latest.length / batchSize
              )}`
            );

            const f = imap.fetch(batch, { bodies: "", struct: true });

            await new Promise((resolve, reject) => {
              f.on("message", function (msg) {
                let rawEmailBuffer = [];
                let emailSize;

                msg.on("body", function (stream) {
                  stream.on("data", (chunk) => rawEmailBuffer.push(chunk));
                  stream.on("end", async () => {
                    const fullBuffer = Buffer.concat(rawEmailBuffer);
                    emailSize = fullBuffer.length;
                    try {
                      const parsed = await simpleParser(fullBuffer);
                      const trimmedReceiver =
                        parsed.to?.text.match(/<([^>]+)>/);
                      const receiver = trimmedReceiver
                        ? trimmedReceiver[1]
                        : parsed.to?.text || "";
                      const messageId = parsed.messageId || "";
                      const trimmedEmail = parsed.from?.text.match(/<([^>]+)>/);
                      const email = trimmedEmail
                        ? trimmedEmail[1]
                        : parsed.from?.text || "";

                      console.log("📨 Email:", parsed.subject);
                      if (parsed.html) {
                        const htmlFilePath = path.join(
                          attachmentsDir,
                          "email.html"
                        );
                        fs.writeFileSync(htmlFilePath, parsed.html);
                        console.log(`✅ Saved HTML email to ${htmlFilePath}`);
                      }

                      const emailData = {
                        messageId,
                        from: email,
                        to: receiver,
                        cc: parsed.cc?.text || "",
                        bcc: parsed.bcc?.text || "",
                        subject: parsed.subject,
                        html: parsed.html,
                        text: parsed.text,
                        date: parsed.date,
                        size: emailSize,
                        attachments: parsed.attachments.map((att) => {
                          const filename = att.filename || "unknown";
                          const emailDate = new Date(parsed.date);
                          const folderName = `${emailDate.getFullYear()}-${String(
                            emailDate.getMonth() + 1
                          ).padStart(2, "0")}-${String(
                            emailDate.getDate()
                          ).padStart(2, "0")}`;

                          const subfolder = filename.includes("messageImage")
                            ? "footer"
                            : filename.toLowerCase().endsWith(".pdf")
                            ? "pdf"
                            : "";

                          const filePath = path
                            .join(folderName, subfolder, filename)
                            .replace(/\\/g, "/");
                          return {
                            filename,
                            contentType: att.contentType,
                            contentDisposition: att.contentDisposition,
                            url: filePath,
                          };
                        }),
                      };
                      if (!messageId) {
                        console.warn("⚠️ Email has no messageId, skipping.");
                        return;
                      }

                      const exists = await EmailModel.findOne({ messageId });
                      if (exists) {
                        console.log(
                          `⚠️ Duplicate messageId, skipping: ${messageId}`
                        );
                        return;
                      }
                      const savedEmail = await EmailModel.create(emailData);
                      console.log("✅ Saved to MongoDB:", savedEmail._id);

                      // Save attachments
                      if (parsed.attachments.length > 0) {
                        const emailDate = new Date(parsed.date);
                        const folderName = `${emailDate.getFullYear()}-${String(
                          emailDate.getMonth() + 1
                        ).padStart(2, "0")}-${String(
                          emailDate.getDate()
                        ).padStart(2, "0")}`;

                        const emailAttachmentsDir = path.join(
                          attachmentsDir,
                          folderName
                        );
                        const footerAttachmentsDir = path.join(
                          emailAttachmentsDir,
                          "footer"
                        );
                        const pdfAttachmentsDir = path.join(
                          emailAttachmentsDir,
                          "pdf"
                        );
                        fs.mkdirSync(emailAttachmentsDir, { recursive: true });
                        fs.mkdirSync(footerAttachmentsDir, { recursive: true });
                        fs.mkdirSync(pdfAttachmentsDir, { recursive: true });

                        parsed.attachments.forEach((attachment) => {
                          let targetDir;
                          if (attachment.filename.includes("messageImage")) {
                            targetDir = footerAttachmentsDir;
                          } else if (
                            attachment.filename.toLowerCase().endsWith(".pdf")
                          ) {
                            targetDir = pdfAttachmentsDir;
                          } else {
                            targetDir = emailAttachmentsDir;
                          }

                          const filePath = path.join(
                            targetDir,
                            attachment.filename
                          );
                          fs.writeFile(filePath, attachment.content, (err) => {
                            if (err) {
                              console.error("❌ Attachment save error:", err);
                            } else {
                              console.log(`✅ Saved attachment at ${filePath}`);
                            }
                          });
                        });
                      }
                    } catch (err) {
                      console.error("❌ Parsing error:", err);
                    }
                  });
                });
              });

              f.once("end", () => {
                console.log(`✅ Batch ${i / batchSize + 1} completed.`);
                resolve();
              });

              f.once("error", (err) => {
                console.error("❌ Fetch error:", err);
                reject(err);
              });
            });
          }

          imap.end();
          console.log(`Ended..`);
        }
      );
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
