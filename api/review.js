// Отзыв с портфолио → сообщение в Telegram-бот. На сайт отзыв попадает только после ручной проверки.
// Переменные окружения в Vercel те же, что у api/lead.js: BOT_TOKEN и LEAD_CHAT_IDS.

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const limited = require('./_limit');
const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  // Поле-ловушка для ботов: человек его не видит и не заполняет.
  if (body.website) return res.status(200).json({ ok: true });
  if (limited(req, 3)) return res.status(429).json({ error: 'Слишком много отправок, попробуйте позже' });

  const name = clean(body.name, 60);
  const role = clean(body.role, 80);
  const text = clean(body.text, 800);
  const rating = Math.round(Number(body.rating));

  if (!name) return res.status(400).json({ error: 'Укажите имя' });
  if (text.replace(/\s/g, '').length < 10) return res.status(400).json({ error: 'Напишите отзыв' });
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Поставьте оценку' });
  if (body.consent !== true) return res.status(400).json({ error: 'Нужно согласие на обработку данных' });
  if (body.publish !== true) return res.status(400).json({ error: 'Нужно согласие на публикацию' });

  const token = process.env.BOT_TOKEN;
  const chats = String(process.env.LEAD_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !chats.length) return res.status(500).json({ error: 'Бот не настроен' });

  const flags = [];
  if (/(https?:\/\/|www\.|t\.me\/)/i.test(name + ' ' + role + ' ' + text)) flags.push('ссылка в тексте');
  if (/\d/.test(name)) flags.push('цифры в имени');
  if (/(крипт|казино|ставк|заработ|инвест|18\+|интим|seo-?продвиж|раскрутк)/i.test(name + ' ' + text)) flags.push('спам-слова');
  const label = flags.length ? '🟡 Проверить' : '🟢 Новый отзыв';

  const msg =
    `📝 <b>${label}</b>\n\n` +
    `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} ${rating}/5\n` +
    `👤 ${esc(name)}${role ? `, ${esc(role)}` : ''}\n\n` +
    `💬 ${esc(text)}\n\n` +
    `✅ Согласие на обработку данных и на публикацию отмечено` +
    (flags.length ? `\n⚠️ ${flags.map(esc).join(', ')}` : '');

  const results = await Promise.all(chats.map((chat_id) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: msg, parse_mode: 'HTML', disable_web_page_preview: true }),
    }).then((r) => r.json()).catch(() => ({ ok: false }))
  ));

  if (!results.some((r) => r.ok)) return res.status(502).json({ error: 'Не получилось отправить' });
  return res.status(200).json({ ok: true });
};
