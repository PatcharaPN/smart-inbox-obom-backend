// const Imap = require("imap");
// const inspect = require("util").inspect;

// const getInbox = () => {
//   const imap = new Imap({
//     user: "salessupport@obomgauge.com",
//     password: "yzkH#x!yJ3",
//     host: "asia.hostneverdie.com",
//     port: 993,
//     tls: true,
//     tlsOptions: { rejectUnauthorized: false },
//   });

//   imap.once("ready", function () {
//     imap.getBoxes(function (err, boxes) {
//       if (err) {
//         console.error(err);
//         return;
//       }
//       console.log(inspect(boxes, false, 8));
//     });
//   });

//   imap.once("error", function (err) {
//     console.log(err);
//   });

//   imap.connect();
// };
// module.exports = getInbox();
