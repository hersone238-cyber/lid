const CATEGORIES = [
  { id: "nails", name: "Ногти" },
  { id: "hair", name: "Волосы" },
  { id: "brows", name: "Брови и ресницы" },
];

// price: [мастер, топ-мастер]
const SERVICES = [
  { id: "mani", cat: "nails", name: "Маникюр с покрытием гель-лаком", min: 120, price: [1800, 2300] },
  { id: "mani-clean", cat: "nails", name: "Маникюр без покрытия", min: 60, price: [900, 1200] },
  { id: "extension", cat: "nails", name: "Наращивание ногтей", min: 180, price: [2800, 3500] },
  { id: "pedi", cat: "nails", name: "Педикюр с покрытием", min: 120, price: [2200, 2700] },
  { id: "cut-w", cat: "hair", name: "Женская стрижка", min: 60, price: [1200, 1700] },
  { id: "color", cat: "hair", name: "Окрашивание в один тон", min: 150, price: [3500, 4500] },
  { id: "airtouch", cat: "hair", name: "Сложное окрашивание", min: 300, price: [7500, 9500] },
  { id: "brows", cat: "brows", name: "Коррекция и окрашивание бровей", min: 45, price: [900, 1200] },
  { id: "lami", cat: "brows", name: "Ламинирование ресниц", min: 75, price: [1800, 2200] },
  { id: "lashes", cat: "brows", name: "Наращивание ресниц, классика", min: 120, price: [2300, 2800] },
];

const MASTERS = [
  { name: "Алина Вершинина", cat: "nails", top: true },
  { name: "Ксения Малых", cat: "nails", top: false },
  { name: "Юлия Кротова", cat: "hair", top: true },
  { name: "Ольга Пестова", cat: "hair", top: false },
  { name: "Дарья Смирнова", cat: "brows", top: false },
];

const TIMES = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30"];
const STORAGE_KEY = "pion_requests";
const ANY = "Любой свободный мастер";

const rub = (n) => `${n.toLocaleString("ru-RU")} ₽`;
const duration = (m) => (m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ""}`);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

const form = document.getElementById("bookingForm");
const steps = [...form.querySelectorAll(".step")];
const marks = [...form.querySelectorAll(".progress span")];
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const errorEl = document.getElementById("formError");
const masterSelect = document.getElementById("masterSelect");
let current = 1;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
}

function choice(name, value, label, hint, disabled) {
  const input = el("input", { type: "radio", name, value });
  if (disabled) input.disabled = true;
  const span = el("span", { text: label });
  if (hint) span.append(el("small", { text: hint }));
  return el("label", { class: "choice" }, [input, span]);
}

function bookService(id) {
  form.querySelector(`input[name=service][value="${id}"]`).checked = true;
  form.hidden = false;
  document.getElementById("done").hidden = true;
  renderMasters();
  goTo(2);
  document.getElementById("booking").scrollIntoView();
}

function renderPrices(cat) {
  const rows = document.getElementById("priceRows");
  rows.replaceChildren();
  for (const s of SERVICES.filter((x) => x.cat === cat)) {
    const name = el("div", { class: "row__name", text: s.name });
    name.append(el("small", { text: duration(s.min) }));
    const btn = el("button", { type: "button", class: "row__book", text: "Записаться →" });
    btn.addEventListener("click", () => bookService(s.id));
    rows.append(el("div", { class: "row" }, [
      name,
      el("span", { class: "row__price", text: rub(s.price[0]) }),
      el("span", { class: "row__price", text: rub(s.price[1]) }),
      btn,
    ]));
  }
  for (const t of document.querySelectorAll(".tab")) t.setAttribute("aria-selected", t.dataset.cat === cat);
}

function renderTabs() {
  const tabs = document.getElementById("tabs");
  for (const c of CATEGORIES) {
    const t = el("button", { type: "button", class: "tab", role: "tab", "data-cat": c.id, text: c.name });
    t.addEventListener("click", () => renderPrices(c.id));
    tabs.append(t);
  }
  renderPrices(CATEGORIES[0].id);
}

function renderServiceChoices() {
  const box = document.getElementById("serviceChoices");
  for (const s of SERVICES) box.append(choice("service", s.id, s.name, `${duration(s.min)} · от ${rub(s.price[0])}`));
}

function renderMasters() {
  const service = SERVICES.find((s) => s.id === form.service.value);
  masterSelect.replaceChildren(el("option", { text: ANY }));
  for (const m of MASTERS.filter((x) => !service || x.cat === service.cat)) {
    const price = service ? ` — ${rub(service.price[m.top ? 1 : 0])}` : "";
    masterSelect.append(el("option", { value: m.name, text: `${m.name}${m.top ? " (топ)" : ""}${price}` }));
  }
  renderTimes();
}

function renderDays() {
  const days = document.getElementById("days");
  const fmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric" });
  const date = new Date();
  for (let i = 0; i < 6; i++) {
    const [wd, day] = fmt.format(date).split(", ");
    const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : wd;
    days.append(choice("day", ymd(date), label, i < 2 ? `${date.getDate()}` : day || ""));
    date.setDate(date.getDate() + 1);
  }
  days.addEventListener("change", renderTimes);
}

function renderTimes() {
  const times = document.getElementById("times");
  times.replaceChildren();
  const day = form.day ? form.day.value : "";
  if (!day) {
    times.append(el("p", { class: "sub", text: "Сначала выберите день" }));
    return;
  }
  const isToday = day === ymd(new Date());
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const seedBase = day.charCodeAt(9) + masterSelect.selectedIndex * 3;
  TIMES.forEach((t, i) => {
    const [h, m] = t.split(":").map(Number);
    const busy = (seedBase + i * 7) % 4 === 0 || (isToday && h * 60 + m <= nowMin);
    times.append(choice("time", t, t, "", busy));
  });
}

function goTo(n) {
  current = n;
  steps.forEach((s) => s.classList.toggle("is-active", +s.dataset.step === n));
  marks.forEach((m) => m.classList.toggle("is-on", +m.dataset.step <= n));
  prevBtn.hidden = n === 1;
  nextBtn.textContent = n === 3 ? "Записаться" : "Далее";
  errorEl.textContent = "";
}

function validate(n) {
  if (n === 1 && !form.service.value) return "Выберите услугу";
  if (n === 2 && !(form.day && form.day.value)) return "Выберите день";
  if (n === 2 && !(form.time && form.time.value)) return "Выберите время";
  if (n === 3) {
    if (!form.name.value.trim()) return "Укажите имя";
    if (form.phone.value.replace(/\D/g, "").length < 11) return "Укажите телефон полностью";
    if (!form.agree.checked) return "Нужно согласие на обработку данных";
  }
  return "";
}

function formatPhone(value) {
  let d = value.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
  let out = "+7";
  if (p[0]) out += ` (${p[0]}`;
  if (p[0].length === 3) out += ")";
  if (p[1]) out += ` ${p[1]}`;
  if (p[2]) out += `-${p[2]}`;
  if (p[3]) out += `-${p[3]}`;
  return out;
}

function loadRequests() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}

function submit() {
  const service = SERVICES.find((s) => s.id === form.service.value);
  const master = MASTERS.find((m) => m.name === masterSelect.value);
  const request = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    service: service.name,
    price: rub(service.price[master && master.top ? 1 : 0]),
    duration: duration(service.min),
    master: master ? master.name : ANY,
    day: form.day.value,
    time: form.time.value,
    name: form.name.value.trim(),
    phone: form.phone.value,
    comment: form.comment.value.trim(),
    status: "new",
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([request, ...loadRequests()])); } catch {}

  const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(parseYmd(request.day));
  const who = master ? `к мастеру ${master.name.split(" ")[0]}` : "";
  document.getElementById("doneText").textContent =
    `${request.name}, вы записаны на «${request.service}» ${who} ${dayLabel} в ${request.time}. Подтверждение придёт на ${request.phone}.`.replace(/\s+/g, " ");
  form.hidden = true;
  document.getElementById("done").hidden = false;
}

nextBtn.addEventListener("click", () => {
  const err = validate(current);
  if (err) { errorEl.textContent = err; return; }
  if (current === 1) renderMasters();
  if (current < 3) goTo(current + 1);
  else submit();
});
prevBtn.addEventListener("click", () => goTo(current - 1));
masterSelect.addEventListener("change", renderTimes);
form.phone.addEventListener("input", (e) => { e.target.value = formatPhone(e.target.value); });
form.addEventListener("change", () => { errorEl.textContent = ""; });

document.getElementById("todayDate").textContent =
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date());

renderTabs();
renderServiceChoices();
renderDays();
renderMasters();
