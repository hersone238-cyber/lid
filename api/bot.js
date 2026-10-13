// Вебхук бота заявок: кнопка «✋ Беру» под заявкой.
// Подключение: один раз открыть https://stepan-sites.vercel.app/api/bot в браузере.
const { createHash } = require('node:crypto');

const token = process.env.BOT_TOKEN;
// Секрет вебхука выводим из токена, чтобы не заводить ещё одну переменную.
const secret = () => createHash('sha256').update('wh:' + token).digest('hex').slice(0, 32);

const tg = (method, params) => fetch(`https://api.telegram.org/bot${token}/${method}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(params),
}).then((r) => r.json()).catch(() => ({ ok: false }));

module.exports = async function handler(req, res) {
  if (!token) return res.status(500).send('Бот не настроен');

  if (req.method === 'GET') {
    const url = `https://${req.headers['x-forwarded-host'] || req.headers.host}/api/bot`;
    const info = await tg('getWebhookInfo', {});
    const current = info.ok ? info.result.url : '';
    // Не перехватываем бота, если он уже подключён к другому сайту.
    if (current && current !== url) return res.status(409).send(`Бот уже подключён к ${current}. Ничего не менял.`);
    const hook = await tg('setWebhook', { url, secret_token: secret(), allowed_updates: ['callback_query'] });
    return res.status(200).send(hook.ok ? `Готово. Бот подключён к ${url}` : `Ошибка: ${hook.description}`);
  }

  if (req.headers['x-telegram-bot-api-secret-token'] !== secret()) return res.status(403).end();
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const q = body.callback_query;
  if (!q || !q.message) return res.status(200).end();

  const rows = (q.message.reply_markup && q.message.reply_markup.inline_keyboard) || [];
  const writeRow = rows.find((r) => r[0] && r[0].url);

  if (q.data === 'taken') {
    await tg('answerCallbackQuery', { callback_query_id: q.id, text: rows[0] ? rows[0][0].text : 'Заявку уже взяли' });
    return res.status(200).end();
  }

  if (q.data && q.data.startsWith('t|')) {
    const who = q.from.first_name || q.from.username || 'кто-то';
    const copies = q.data.slice(2).split(';').map((m) => m.split(':'));
    if (!copies.some(([c, m]) => +c === q.message.chat.id && +m === q.message.message_id)) {
      copies.push([String(q.message.chat.id), String(q.message.message_id)]);
    }
    await Promise.all(copies.map(([chat_id, message_id]) => {
      const mine = +chat_id === q.message.chat.id;
      const keyboard = [[{ text: mine ? '✅ Ты взял' : `✅ Взял ${who}`, callback_data: 'taken' }]];
      if (mine && writeRow) keyboard.push(writeRow);
      return tg('editMessageReplyMarkup', { chat_id, message_id: +message_id, reply_markup: { inline_keyboard: keyboard } });
    }));
    await tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Заявка твоя' });
  }
  return res.status(200).end();
};
