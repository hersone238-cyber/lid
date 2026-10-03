const SERVICES = [
  { id: "consult", icon: "🩺", name: "Консультация", desc: "Осмотр, план лечения и точная цена.", price: "0 ₽" },
  { id: "caries", icon: "🦷", name: "Лечение кариеса", desc: "Пломба светового отверждения, анестезия включена.", price: "от 3 500 ₽" },
  { id: "pain", icon: "⚡", name: "Острая боль", desc: "Примем в день обращения, снимем боль.", price: "от 1 500 ₽" },
  { id: "hygiene", icon: "✨", name: "Чистка зубов", desc: "Ультразвук + Air Flow + полировка.", price: "4 900 ₽" },
  { id: "implant", icon: "🔩", name: "Имплантация", desc: "Импланты с пожизненной гарантией производителя.", price: "от 29 000 ₽" },
  { id: "kids", icon: "🧸", name: "Детский приём", desc: "Спокойно, без страха, с 3 лет.", price: "от 1 200 ₽" },
];

const TIMES = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:00"];
const STORAGE_KEY = "denta_requests";
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

const form = document.getElementById("bookingForm");
const steps = [...form.querySelectorAll(".step")];
const marks = [...form.querySelectorAll(".progress span")];
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const errorEl = document.getElementById("formError");
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

function renderServices() {
  const list = document.getElementById("servicesList");
  const choices = document.getElementById("serviceChoices");
  for (const s of SERVICES) {
    const btn = el("button", { type: "button", text: "Записаться →" });
    btn.addEventListener("click", () => {
      form.querySelector(`input[name=service][value=${s.id}]`).checked = true;
      goTo(1);
      document.getElementById("booking").scrollIntoView();
    });
    list.append(el("article", { class: "service" }, [
      el("div", { class: "service__icon", text: s.icon }),
      el("h3", { text: s.name }),
      el("p", { text: s.desc }),
      el("div", { class: "service__foot" }, [el("span", { class: "service__price", text: s.price }), btn]),
    ]));
    choices.append(choice("service", s.id, s.name, s.price));
  }
}

function renderDays() {
  const days = document.getElementById("days");
  const fmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  const date = new Date();
  let added = 0;
  while (added < 7) {
    if (date.getDay() !== 0) {
      const [wd, ...rest] = fmt.format(date).split(", ");
      const diff = Math.round((parseYmd(ymd(date)) - parseYmd(ymd(new Date()))) / 864e5);
      const label = diff === 0 ? "Сегодня" : diff === 1 ? "Завтра" : wd;
      days.append(choice("day", ymd(date), label, rest.join(" ") || fmt.format(date)));
      added++;
    }
    date.setDate(date.getDate() + 1);
  }
  days.addEventListener("change", renderTimes);
}

function renderTimes() {
  const times = document.getElementById("times");
  times.replaceChildren();
  const day = form.day.value;
  const isToday = day === ymd(new Date());
  const nowHour = new Date().getHours();
  TIMES.forEach((t, i) => {
    const seed = (day.charCodeAt(9) || 0) + i * 7;
    const busy = seed % 5 === 0 || (isToday && parseInt(t, 10) <= nowHour);
    times.append(choice("time", t, t, "", busy));
  });
}

function goTo(n) {
  current = n;
  steps.forEach((s) => s.classList.toggle("is-active", +s.dataset.step === n));
  marks.forEach((m) => m.classList.toggle("is-on", +m.dataset.step <= n));
  prevBtn.hidden = n === 1;
  nextBtn.textContent = n === 3 ? "Отправить заявку" : "Далее";
  errorEl.textContent = "";
}

function validate(n) {
  if (n === 1 && !form.service.value) return "Выберите услугу";
  if (n === 2 && !form.day.value) return "Выберите день";
  if (n === 2 && !form.time.value) return "Выберите время";
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
  const request = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    service: service.name,
    doctor: form.doctor.value,
    day: form.day.value,
    time: form.time.value,
    name: form.name.value.trim(),
    phone: form.phone.value,
    comment: form.comment.value.trim(),
    status: "new",
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([request, ...loadRequests()])); } catch {}

  const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(parseYmd(request.day));
  document.getElementById("doneText").textContent =
    `${request.name}, вы записаны на «${request.service}» ${dayLabel} в ${request.time}. Администратор перезвонит на ${request.phone} в течение 15 минут.`;
  form.hidden = true;
  document.getElementById("done").hidden = false;
}

nextBtn.addEventListener("click", () => {
  const err = validate(current);
  if (err) { errorEl.textContent = err; return; }
  if (current < 3) goTo(current + 1);
  else submit();
});
prevBtn.addEventListener("click", () => goTo(current - 1));
form.phone.addEventListener("input", (e) => { e.target.value = formatPhone(e.target.value); });
form.addEventListener("change", () => { errorEl.textContent = ""; });

renderServices();
renderDays();
renderTimes();
