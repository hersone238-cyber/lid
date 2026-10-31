// Ограничение частоты запросов с одного IP. Память живёт, пока жив экземпляр функции,
// поэтому это защита от массовой отправки подряд, а не точный счётчик.
const hits = new Map();

module.exports = function limited(req, max = 5, windowMs = 10 * 60 * 1000) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
};
