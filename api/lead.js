// Заявка с портфолио → сообщение в Telegram-бот.
// Переменные окружения в Vercel: BOT_TOKEN (от @BotFather), LEAD_CHAT_IDS (id чатов через запятую).

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const limited = require('./_limit');
const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  // Поле-ловушка для ботов: человек его не видит и не заполняет.
  if (body.website) return res.status(200).json({ ok: true });
  if (limited(req, 5)) return res.status(429).json({ error: 'Слишком много отправок, попробуйте позже' });

  const name = clean(body.name, 80);
  const contact = clean(body.contact, 80);
  const biz = clean(body.biz, 200);
  const about = clean(body.about, 1000);
  const example = clean(body.example, 300);
  const need = Array.isArray(body.need) ? body.need.map((n) => clean(n, 60)).filter(Boolean).slice(0, 10) : [];
  const estimate = clean(body.estimate, 120);

  if (!name) return res.status(400).json({ error: 'Укажите имя' });
  if (!contact) return res.status(400).json({ error: 'Укажите Telegram или телефон' });
  if (!biz) return res.status(400).json({ error: 'Укажите название или ссылку на бизнес' });
  if (body.consent !== true) return res.status(400).json({ error: 'Нужно согласие с политикой' });

  const token = process.env.BOT_TOKEN;
  const chats = String(process.env.LEAD_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !chats.length) return res.status(500).json({ error: 'Бот не настроен' });

  const digits = contact.replace(/\D/g, '');
  const user = contact.match(/^@?([A-Za-z0-9_]{4,32})$/);
  const contactHtml = digits.length >= 10 && !user
    ? `<a href="tel:+${digits.replace(/^8/, '7')}">${esc(contact)}</a>`
    : user ? `<a href="https://t.me/${user[1]}">@${esc(user[1])}</a>` : esc(contact);

  // Сортировка: считаем признаки мусорной заявки и ставим метку в заголовок.
  const flags = [];
  const link = /(https?:\/\/|www\.|t\.me\/|\.(ru|com|xyz|top)\b)/i;
  if (!user && digits.length < 10) flags.push('контакт не похож на @ник или телефон');
  if (link.test(name)) flags.push('ссылка в имени');
  if (/^(нет|нету|-|\.|нет\(|нету\()$/i.test(biz) || biz.replace(/\s/g, '').length < 3) flags.push('нет данных о бизнесе');
  if (/\d/.test(name) || !/[а-яё]/i.test(name)) flags.push('странное имя');
  if (about.replace(/\s/g, '').length < 15) flags.push('почти ничего о бизнесе');
  if ((about.match(/https?:\/\//g) || []).length > 1) flags.push('много ссылок');
  if (/(крипт|казино|ставк|заработ|инвест|18\+|интим|seo-?продвиж|раскрутк)/i.test(name + ' ' + about)) flags.push('спам-слова');
  const label = flags.length >= 2 ? '🔴 Похоже на спам' : flags.length ? '🟡 Проверить' : '🟢 Заявка';

  const text =
    `📩 <b>${label}</b>\n\n` +
    `👤 ${esc(name)}\n📞 ${contactHtml}\n🏪 ${esc(biz)}` +
    (need.length ? `\n🛠 ${need.map(esc).join(', ')}` : '') +
    (estimate ? `\n💰 ${esc(estimate)}` : '') +
    (example ? `\n🔗 Пример: ${esc(example)}` : '') +
    (about ? `\n\n💬 ${esc(about)}` : '') +
    (flags.length ? `\n\n⚠️ ${flags.map(esc).join(', ')}` : '');

  const tg = (method, params) => fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then((r) => r.json()).catch(() => ({ ok: false }));

  const results = await Promise.all(chats.map((chat_id) =>
    tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true })
  ));
  const sent = results.filter((r) => r.ok).map((r) => `${r.result.chat.id}:${r.result.message_id}`);

  // Кнопки «Беру» и «Написать». В callback_data — все копии заявки, чтобы api/bot.js отметил её у всех.
  if (sent.length) {
    let data = 't|' + sent[0];
    for (const m of sent.slice(1)) if ((data + ';' + m).length <= 64) data += ';' + m;
    const write = user ? `https://t.me/${user[1]}`
      : digits.length >= 10 ? `https://t.me/+${digits.replace(/^8/, '7')}` : null;
    const keyboard = [[{ text: '✋ Беру', callback_data: data }]];
    if (write) keyboard.push([{ text: '✉️ Написать', url: write }]);
    await Promise.all(sent.map((m) => {
      const [chat_id, message_id] = m.split(':');
      return tg('editMessageReplyMarkup', { chat_id, message_id: +message_id, reply_markup: { inline_keyboard: keyboard } });
    }));
  }

  if (!sent.length) return res.status(502).json({ error: 'Не получилось отправить' });
  return res.status(200).json({ ok: true });
};
