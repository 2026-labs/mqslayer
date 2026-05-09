// ════════════════════════════════════════════════
//  🤖 MOSQUITO SLAYER — Telegram Leaderboard Bot
//  Deploy gratis di: render.com / railway.app
//
//  ENV VARS yang perlu di-set:
//    BOT_TOKEN               → dari @BotFather
//    FIREBASE_PROJECT_ID     → project ID firebase
//    FIREBASE_SERVICE_ACCOUNT → JSON service account (satu baris, string)
// ════════════════════════════════════════════════

const TelegramBot = require('node-telegram-bot-api');
const admin       = require('firebase-admin');

// ── Firebase Admin init ──────────────────────────
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch(e) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT bukan JSON valid.');
  process.exit(1);
}

admin.initializeApp({
  credential:  admin.credential.cert(serviceAccount),
  projectId:   process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

// ── Bot init ─────────────────────────────────────
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log('🦟 Mosquito Slayer Bot nyala...');

// ── Helper: format nama user ─────────────────────
function displayName(doc) {
  // Kalau ada username pakai @username
  if (doc.username) return `@${doc.username}`;
  // Kalau ga ada, pakai first_name + 4 digit terakhir user_id
  const shortId = String(doc.user_id ?? '????').slice(-4);
  return `${doc.first_name ?? 'Player'} (#${shortId})`;
}

// ── /top — leaderboard top 20 ────────────────────
bot.onText(/\/top(@\w+)?$/, async (msg) => {
  try {
    const snap = await db.collection('scores')
      .orderBy('score', 'desc')
      .limit(20)
      .get();

    if (snap.empty) {
      return bot.sendMessage(msg.chat.id, '📭 Empty!');
    }

    const medals = ['🥇', '🥈', '🥉'];
    const rows   = [];

    snap.forEach((docSnap, i) => {
      const d    = docSnap.data();
      const rank = medals[i] ?? `${i + 1}.`;
      const name = displayName({ ...d, user_id: docSnap.id });
      rows.push(`${rank} ${name} — *${d.score.toLocaleString('id-ID')}*`);
    });

    const text = [
      '🏆 *TOP 20 — MOSQUITO SLAYER*',
      '━━━━━━━━━━━━━━━━━━',
      ...rows,
      '',
      '`/myscore` — score',
    ].join('\n');

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });

  } catch(e) {
    console.error('top error:', e);
    bot.sendMessage(msg.chat.id, '❌ fail.');
  }
});

// ── /myscore — skor personal ─────────────────────
bot.onText(/\/myscore(@\w+)?$/, async (msg) => {
  const userId = String(msg.from.id);

  try {
    const snap = await db.collection('scores')
      .orderBy('score', 'desc')
      .get();

    let rank     = null;
    let userData = null;
    let pos      = 0;

    snap.forEach(docSnap => {
      pos++;
      if (docSnap.id === userId) {
        rank     = pos;
        userData = docSnap.data();
      }
    });

    if (!userData) {
      return bot.sendMessage(msg.chat.id,
        `😴 *${msg.from.first_name}*, no data!\nPlay first 🦟`,
        { parse_mode: 'Markdown' }
      );
    }

    const name = displayName({ ...userData, user_id: userId });
    const medals = ['', '🥇', '🥈', '🥉'];
    const medal  = medals[rank] ?? '';

    bot.sendMessage(msg.chat.id,
      `🦟 *your score*\n\n` +
      `👤 ${name}\n` +
      `🏅 Rank: *#${rank}* ${medal}\n` +
      `🎯 Best Score: *${userData.score.toLocaleString('id-ID')}*`,
      { parse_mode: 'Markdown' }
    );

  } catch(e) {
    console.error('myscore error:', e);
    bot.sendMessage(msg.chat.id, '❌ Fail.');
  }
});

// ── /help ─────────────────────────────────────────
bot.onText(/\/start|\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🦟 *MOSQUITO SLAYER BOT*\n\n` +
    `commands:\n` +
    `/top — leaderboard top 20\n` +
    `/myscore — your rank\n\n` +
    `nice play, have fun!`,
    { parse_mode: 'Markdown' }
  );
});

// ── Keep-alive buat Render free tier ─────────────
//  Render matiin service kalau ga ada request 15 menit,
//  jadi kita pake express biar ada endpoint yang bisa di-ping.
const express = require('express');
const app     = express();

app.get('/', (_, res) => res.send('🦟 bot online'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`🌐 HTTP keep-alive aktif di port ${process.env.PORT || 3000}`);
});
