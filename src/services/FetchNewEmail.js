const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const connectDB = require("../middlewares/connectDB");
const path = require("path");
const EmailModel = require("../models/emailModel");
const EmailAccount = require("../models/emailAccounts");
// ระบุโฟลเดอร์ที่จะดึงอีเมล
const foldersToFetch = ["INBOX", "Sent", "Trash"];

const fetchNewEmails = async ({ userId, department }) => {
  const emailAccount = await EmailAccount.findOne({ user: userId });

  if (!emailAccount) {
    const error = new Error("ไม่สามารถซิงค์ข้อมูลได้ เพราะไม่มีข้อมูล IMAP");
    error.code = "NO_IMAP";
    throw error;
  }
  const today = new Date();
  const attachmentsDir = path.join(
    __dirname,
    `../../attachments/${department || "DefaultFolder"}`
  );
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
    console.log(`✅ Created 'attachments' directory at ${attachmentsDir}`);
  }

  const since = new Date(today);
  since.setDate(today.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const before = tomorrow
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");

  const sinceFormatted = since
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");

  console.log(`Fetching emails from: ${sinceFormatted} to ${before}`);
  const { email, password, host, port, tls } = emailAccount;
  const imap = new Imap({
    user: email,
    password: password,
    host: host,
    port: port || 993,
    tls: tls || true,
    timeout: 30000,
    tlsOptions: { rejectUnauthorized: false },
  });

  imap.once("ready", async function () {
    // ดึงข้อมูลจากแต่ละโฟลเดอร์
    for (const folder of foldersToFetch) {
      console.log(`📂 Fetching folder: ${folder}`);

      await new Promise((resolve, reject) => {
        imap.openBox(folder, true, async function (err, box) {
          if (err) {
            console.error(`❌ Cannot open folder ${folder}:`, err.message);
            return resolve();
          }

          // ค้นหาผลลัพธ์จากวันที่ที่กำหนด
          imap.search(
            [
              ["SINCE", since],
              ["BEFORE", before],
            ],
            async function (err, results) {
              if (err || !results || results.length === 0) {
                console.log(`📭 No emails in ${folder}`);
                return resolve();
              }

              const latest = results.slice(-1000);
              const batchSize = 100;

              // ดึงข้อมูลทีละ batch
              for (let i = 0; i < latest.length; i += batchSize) {
                const batch = latest.slice(i, i + batchSize);

                console.log(
                  `📦 Folder ${folder}: Fetching batch ${i / batchSize + 1}`
                );
                const f = imap.fetch(batch, { bodies: "", struct: true });

                await new Promise((res, rej) => {
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
                          const trimmedEmail =
                            parsed.from?.text.match(/<([^>]+)>/);
                          const email = trimmedEmail
                            ? trimmedEmail[1]
                            : parsed.from?.text || "";

                          if (!messageId) {
                            console.warn("⚠️ No messageId, skipping.");
                            return;
                          }

                          const exists = await EmailModel.findOne({
                            messageId,
                          });
                          if (exists) {
                            console.log(`⚠️ Duplicate: ${messageId}`);
                            return;
                          }

                          const emailData = {
                            user: userId,
                            messageId,
                            folder,
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

                              const subfolder = filename.includes(
                                "messageImage"
                              )
                                ? "footer"
                                : filename.toLowerCase().endsWith(".pdf")
                                ? "pdf"
                                : "";

                              const fullFolderPath = path.join(
                                attachmentsDir,
                                folderName,
                                subfolder
                              );
                              const filePath = path
                                .join(folderName, subfolder, filename)
                                .replace(/\\/g, "/");

                              // ✅ Ensure folder exists
                              if (!fs.existsSync(fullFolderPath)) {
                                fs.mkdirSync(fullFolderPath, {
                                  recursive: true,
                                });
                              }

                              // ✅ Save the file
                              const relativePath = path
                                .join(
                                  department,
                                  folderName,
                                  subfolder,
                                  filename
                                )
                                .replace(/\\/g, "/");

                              // ✅ Save the attachment to the disk
                              fs.writeFileSync(
                                path.join(fullFolderPath, filename),
                                att.content
                              );

                              return {
                                filename,
                                contentType: att.contentType,
                                contentDisposition: att.contentDisposition,
                                url: `/attachments/${relativePath}`,
                              };
                            }),
                          };

                          const savedEmail = await EmailModel.create(emailData);
                          console.log("✅ Saved:", savedEmail._id);
                        } catch (err) {
                          console.error("❌ Parsing error:", err.message);
                        }
                      });
                    });
                  });

                  f.once("end", () => {
                    console.log(
                      `✅ Folder ${folder} - Batch ${i / batchSize + 1} done.`
                    );
                    res();
                  });

                  f.once("error", (err) => {
                    console.error("❌ Fetch error:", err);
                    rej(err);
                  });
                });
              }

              resolve();
            }
          );
        });
      });
    }

    imap.end();
  });

  imap.once("error", function (err) {
    console.error("❌ IMAP Error:", err);
  });

  imap.once("end", function () {
    console.log("✅ Done fetching all folders.");
  });

  imap.connect();
};

module.exports = fetchNewEmails;
