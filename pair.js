const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega"); // MEGA upload function

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get("/", async (req, res) => {
  let num = req.query.number;

  async function RobinPair() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    try {
      let RobinPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
      });

      if (!RobinPairWeb.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, "");
        const code = await RobinPairWeb.requestPairingCode(num);
        if (!res.headersSent) {
          await res.send({ code });
        }
      }

      RobinPairWeb.ev.on("creds.update", saveCreds);
      RobinPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === "open") {
          try {
            console.log("🔌 Connected to WhatsApp!");

            await delay(5000); // Give time for connection

            const auth_path = "./session/";
            const user_jid = jidNormalizedUser(RobinPairWeb.user.id);
            const mega_url = await upload(
              fs.createReadStream(auth_path + "creds.json"),
              `session_${Date.now()}.json`
            );
            const string_session = mega_url.replace("https://mega.nz/file/", "");

            const full_caption = `*𓃭ᙘᒪàᑤҚ ᙎᓎᒪᖴ☯︎ [『d』『a』『r』『k』 WA BOT] ᗰᗩᗪᗴ ᗷY ՏᕼᗩՏᕼIKᗩ*\n\n*╔════════•●•════════╗*\n*${string_session}*\n*╚════════•●•════════╝*\n\n*𓆩𝐓𝐡𝐢𝐬 𝐢𝐬 𝐲𝐨𝐮𝐫 𝐒𝐞𝐬𝐬𝐢𝐨𝐧 𝐈𝐃𓆪 — ꧁༺Copy this and paste into config.js༻꧂*`;

            const warning = "☠ *Sharing the code is strictly prohibited.* ☠";
            const welcome = "🌟 *Welcome to the Dark Wolf WhatsApp Bot!* 🌟\n\nYou are now successfully paired. Feel free to explore and enjoy using commands.\n\n⚠️ For help, type: *.help*";

            // Send welcome message
            await RobinPairWeb.sendMessage(user_jid, { text: welcome });

            // Send session ID as caption to image (DIRECT IMAGE LINK from raw.githubusercontent.com)
            await RobinPairWeb.sendMessage(user_jid, {
              image: {
                url: "https://raw.githubusercontent.com/shashika2008/-K-O-/main/InShot_20250726_080955126.jpg",
              },
              caption: full_caption,
            });

            // Send raw session ID
            await RobinPairWeb.sendMessage(user_jid, { text: string_session });

            // Send warning
            await RobinPairWeb.sendMessage(user_jid, { text: warning });

          } catch (err) {
            console.error("❌ Error sending messages:", err);
            exec("pm2 restart prabath");
          }

          await delay(3000); // Allow some time before cleanup
          removeFile("./session");
          process.exit(0);
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          await delay(10000);
          RobinPair();
        }
      });
    } catch (err) {
      exec("pm2 restart Robin-md");
      console.log("🔁 Service restarted due to error.");
      RobinPair();
      removeFile("./session");
      if (!res.headersSent) {
        await res.send({ code: "Service Unavailable" });
      }
    }
  }

  await RobinPair();
});

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err);
  exec("pm2 restart Robin");
});

module.exports = router;
;
