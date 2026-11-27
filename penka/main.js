(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const motionOK = !matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Иконки для меню ---------- */
  const ICONS = {
    cup: '<svg viewBox="0 0 40 40" fill="none" stroke="#5a3a2a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16h20v6a10 10 0 0 1-20 0z" fill="#e0a458"/><path d="M28 18h2.5a3.5 3.5 0 0 1 0 7H27"/><path d="M14 11c-1-2 1-3 0-5M20 11c-1-2 1-3 0-5"/><path d="M6 34h26"/></svg>',
    glass: '<svg viewBox="0 0 40 40" fill="none" stroke="#5a3a2a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 8h18l-2.5 26h-13z"/><path d="M12.2 18h15.6l-1.5 16h-12.6z" fill="#c8663b" stroke="none"/><path d="M24 4l-3 14"/></svg>',
    tea: '<svg viewBox="0 0 40 40" fill="none" stroke="#5a3a2a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15h22v5a11 11 0 0 1-22 0z" fill="#8a9a6b"/><path d="M29 17h2a3.5 3.5 0 0 1 0 7h-3"/><path d="M18 15V8h5v4"/></svg>',
    plate: '<svg viewBox="0 0 40 40" fill="none" stroke="#5a3a2a" stroke-width="2.4" stroke-linecap="round"><ellipse cx="20" cy="26" rx="15" ry="6"/><circle cx="16" cy="22" r="5" fill="#e0a458"/><circle cx="24" cy="21" r="4.5" fill="#f2c48a"/></svg>',
    egg: '<svg viewBox="0 0 40 40" fill="none" stroke="#5a3a2a" stroke-width="2.4" stroke-linecap="round"><path d="M8 22c0-8 5-12 12-12s12 4 12 12-5 10-12 10S8 30 8 22z" fill="#fffaf3"/><circle cx="20" cy="22" r="5" fill="#e0a458"/></svg>',
    croissant: '<svg viewBox="0 0 40 40" fill="none" stroke="#5a3a2a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 26c4-12 26-12 30 0-4 3-8 2-10 0-2 3-8 3-10 0-2 2-6 3-10 0z" fill="#e0a458"/><path d="M15 26l2-9M25 26l-2-9"/></svg>',
    bun: '<svg viewBox="0 0 40 40" fill="none" stroke="#5a3a2a" stroke-width="2.4" stroke-linecap="round"><circle cx="20" cy="21" r="12" fill="#d89a5e"/><path d="M20 21m-3 0a3 3 0 1 1 6 0 6 6 0 1 1-12 0 9 9 0 1 1 18 0"/></svg>',
    bread: '<svg viewBox="0 0 40 40" fill="none" stroke="#5a3a2a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 24c0-8 6-13 14-13s14 5 14 13c0 4-3 6-14 6S6 28 6 24z" fill="#c8894e"/><path d="M14 17l3 4M20 15l3 4M26 17l3 4"/></svg>',
  };

  /* ---------- Меню (вымышленное) ---------- */
  const MENU = {
    coffee: [
      { n: "Эспрессо", d: "Двойной шот, плотный и с карамельным послевкусием", p: "160", s: "30 мл", i: "cup" },
      { n: "Капучино", d: "Шелковистая пенка, рисуем сердечко бесплатно", p: "220", s: "250 мл", i: "cup", t: "хит" },
      { n: "Флэт уайт", d: "Двойной эспрессо и немного молока, вкус кофе на первом месте", p: "240", s: "200 мл", i: "cup" },
      { n: "Раф с лавандой", d: "Сливки, ваниль и лаванда из Крыма", p: "290", s: "300 мл", i: "cup", t: "хит" },
      { n: "Фильтр дня", d: "Спросите бариста, какое зерно сегодня в воронке", p: "200", s: "300 мл", i: "glass" },
      { n: "Айс-латте", d: "На вашем молоке, можно с сиропом солёной карамели", p: "260", s: "350 мл", i: "glass" },
    ],
    other: [
      { n: "Какао на овсяном", d: "Густое, с маршмеллоу сверху", p: "240", s: "300 мл", i: "cup", t: "веган" },
      { n: "Матча-латте", d: "Японский чай и молоко, мягко и бодро", p: "280", s: "300 мл", i: "tea" },
      { n: "Облепиховый чай", d: "С мёдом и апельсином, согревает в любую погоду", p: "260", s: "400 мл", i: "tea" },
      { n: "Лимонад «Мята-лайм»", d: "Делаем сами, без готовых сиропов", p: "230", s: "400 мл", i: "glass", t: "веган" },
    ],
    breakfast: [
      { n: "Сырники", d: "Со сметаной и ягодным соусом. Подаём до 12:00", p: "390", s: "3 шт", i: "plate", t: "хит" },
      { n: "Яйцо бенедикт", d: "Бриошь, шпинат, голландский соус", p: "450", s: "", i: "egg" },
      { n: "Овсянка на кокосовом", d: "С бананом, орехами и солёной карамелью", p: "320", s: "", i: "plate", t: "веган" },
      { n: "Тост с авокадо", d: "Хлеб на закваске, яйцо пашот, кунжут", p: "420", s: "", i: "bread" },
    ],
    bakery: [
      { n: "Круассан", d: "Масляный, хрустит так, что слышно на соседнем столике", p: "170", s: "", i: "croissant", t: "хит" },
      { n: "Улитка с корицей", d: "С глазурью из сливочного сыра", p: "190", s: "", i: "bun" },
      { n: "Хлеб на закваске", d: "Целая буханка с собой, выпекаем каждое утро", p: "280", s: "", i: "bread" },
      { n: "Миндальный круассан", d: "С франжипаном и лепестками миндаля", p: "230", s: "", i: "croissant" },
    ],
  };

  const grid = $("#menuGrid");
  const tabs = $$(".tabs [role=tab]");
  const pill = $(".tab-pill");

  function renderMenu(cat) {
    grid.innerHTML = MENU[cat].map((x, k) => `
      <article class="item" style="animation-delay:${k * 60}ms">
        <div class="item-ic" aria-hidden="true">${ICONS[x.i]}</div>
        <div><h3>${x.n}${x.t ? `<span class="tag${x.t === "хит" ? " hot" : ""}">${x.t}</span>` : ""}</h3><p>${x.d}</p></div>
        <div class="price">${x.p} ₽${x.s ? `<small>${x.s}</small>` : ""}</div>
      </article>`).join("");
  }
  function movePill(btn) {
    pill.style.width = btn.offsetWidth + "px";
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  }
  function selectTab(btn, focus) {
    tabs.forEach(t => { const on = t === btn; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; });
    movePill(btn);
    renderMenu(btn.dataset.cat);
    if (focus) btn.focus();
  }
  tabs.forEach((t, k) => {
    t.addEventListener("click", () => selectTab(t));
    t.addEventListener("keydown", e => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); selectTab(tabs[(k + d + tabs.length) % tabs.length], true); }
    });
  });
  selectTab(tabs[0]);
  addEventListener("resize", () => movePill($(".tabs [aria-selected=true]")));
  document.fonts && document.fonts.ready.then(() => movePill($(".tabs [aria-selected=true]")));

  /* ---------- Часы работы и статус «открыто» ---------- */
  const HOURS = { 0: [9, 20], 1: [8, 21], 2: [8, 21], 3: [8, 21], 4: [8, 21], 5: [8, 23], 6: [9, 23] };
  function status() {
    const now = new Date();
    const d = now.getDay();
    const h = now.getHours() + now.getMinutes() / 60;
    const [o, c] = HOURS[d];
    $$("#hours tr").forEach(tr => tr.classList.toggle("today", +tr.dataset.d === d));
    const box = $("#status");
    const open = h >= o && h < c;
    box.classList.toggle("open", open);
    box.classList.toggle("closed", !open);
    const next = HOURS[(d + 1) % 7][0];
    $("#statusText").textContent = open ? `Сейчас открыто, до ${c}:00` : h < o ? `Сейчас закрыто, откроемся в ${o}:00` : `Сейчас закрыто, завтра с ${next}:00`;
    $("#heroStatus").textContent = open ? `Открыто до ${c}:00` : h < o ? `Откроемся в ${o}:00` : `Завтра с ${next}:00`;
    $(".eyebrow .live-dot").parentElement.classList.toggle("closed", !open);
  }
  status();
  setInterval(status, 60000);

  /* ---------- Бронь ---------- */
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const WD_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const state = { day: null, time: null, guests: 2 };
  const daysBox = $("#days"), slotsBox = $("#slots");

  // «Занятость» псевдослучайная, но одинаковая для одного и того же дня
  const busy = (date, slot) => ((date.getDate() * 7 + slot * 13) % 9) < 2;

  const days = [];
  for (let k = 0; k < 10; k++) { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + k); days.push(x); }

  daysBox.innerHTML = days.map((x, k) => `<button type="button" class="chip day" data-k="${k}" aria-pressed="false"><small>${k === 0 ? "сегодня" : k === 1 ? "завтра" : WD[x.getDay()]}</small><b>${x.getDate()}</b><small>${MON[x.getMonth()].slice(0, 3)}</small></button>`).join("");

  function renderSlots() {
    const x = days[state.day];
    const [o, c] = HOURS[x.getDay()];
    const now = new Date();
    const isToday = state.day === 0;
    let html = "", free = 0;
    for (let t = o * 2 + 2; t <= c * 2 - 3; t++) { // с часу после открытия до полутора часов до закрытия
      const hh = Math.floor(t / 2), mm = t % 2 ? "30" : "00";
      const past = isToday && (hh + (t % 2) / 2) <= now.getHours() + now.getMinutes() / 60 + 0.5;
      const dis = past || busy(x, t);
      if (!dis) free++;
      const label = `${hh}:${mm}`;
      html += `<button type="button" class="chip" data-t="${label}" aria-pressed="${state.time === label}" ${dis ? `disabled aria-label="${label}, занято"` : ""}>${label}</button>`;
    }
    slotsBox.innerHTML = html || "";
    $("#slotHint").textContent = free ? `свободно ${free}` : "на этот день мест нет";
    if (motionOK) { slotsBox.classList.remove("pop"); void slotsBox.offsetWidth; slotsBox.classList.add("pop"); }
  }

  function flash(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }

  function updTicket() {
    const x = days[state.day];
    flash($("#tDay"), `${WD_FULL[x.getDay()][0].toUpperCase() + WD_FULL[x.getDay()].slice(1)}, ${x.getDate()} ${MON[x.getMonth()]}`);
    flash($("#tTime"), state.time || "не выбрано");
    flash($("#tGuests"), String(state.guests));
    flash($("#tTable"), state.guests <= 2 ? "у окна" : state.guests <= 4 ? "на диване" : "большой стол");
    $("#gCount").textContent = state.guests;
    $("#gMinus").disabled = state.guests <= 1;
    $("#gPlus").disabled = state.guests >= 8;
    $("#seats").innerHTML = "<i></i>".repeat(state.guests);
  }

  function pickDay(k) {
    state.day = k;
    $$(".day", daysBox).forEach(b => b.setAttribute("aria-pressed", +b.dataset.k === k));
    // если выбранное время на новый день недоступно — сбрасываем
    renderSlots();
    const same = state.time && slotsBox.querySelector(`[data-t="${state.time}"]:not(:disabled)`);
    if (!same) state.time = null;
    $$(".chip", slotsBox).forEach(b => b.setAttribute("aria-pressed", b.dataset.t === state.time));
    updTicket();
  }

  daysBox.addEventListener("click", e => { const b = e.target.closest(".day"); if (b) pickDay(+b.dataset.k); });
  slotsBox.addEventListener("click", e => {
    const b = e.target.closest(".chip:not(:disabled)"); if (!b) return;
    state.time = b.dataset.t;
    $$(".chip", slotsBox).forEach(c => c.setAttribute("aria-pressed", c === b));
    $("#slotErr").hidden = true;
    updTicket();
  });
  $("#gMinus").addEventListener("click", () => { state.guests = Math.max(1, state.guests - 1); updTicket(); });
  $("#gPlus").addEventListener("click", () => { state.guests = Math.min(8, state.guests + 1); updTicket(); });

  // Если сегодня свободных слотов уже нет — сразу открываем завтра
  pickDay(0);
  if (!slotsBox.querySelector(".chip:not(:disabled)")) pickDay(1);

  // Маска телефона +7 (___) ___-__-__
  const phone = $("#phone");
  phone.addEventListener("input", () => {
    let d = phone.value.replace(/\D/g, "");
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (!d.startsWith("7")) d = "7" + d;
    d = d.slice(0, 11);
    const p = d.slice(1);
    let out = "+7";
    if (p.length) out += " (" + p.slice(0, 3);
    if (p.length >= 3) out += ")";
    if (p.length > 3) out += " " + p.slice(3, 6);
    if (p.length > 6) out += "-" + p.slice(6, 8);
    if (p.length > 8) out += "-" + p.slice(8, 10);
    phone.value = d.length > 1 ? out : "";
  });

  const form = $("#bookForm");
  const nameEl = $("#name");
  [nameEl, phone].forEach(el => el.addEventListener("input", () => el.closest(".field").classList.remove("bad")));

  form.addEventListener("submit", e => {
    e.preventDefault();
    let ok = true;
    const bad = (el, cond) => { el.closest(".field").classList.toggle("bad", cond); if (cond) ok = false; };
    bad(nameEl, nameEl.value.trim().length < 2);
    bad(phone, phone.value.replace(/\D/g, "").length !== 11);
    if (!state.time) { $("#slotErr").hidden = false; ok = false; }
    if (!ok) {
      const first = !state.time ? slotsBox : form.querySelector(".bad input");
      if (first) {
        if (window.__lenis) window.__lenis.scrollTo(first.getBoundingClientRect().top + window.scrollY - innerHeight / 3, { duration: 1 });
        else first.scrollIntoView({ behavior: motionOK ? "smooth" : "auto", block: "center" });
      }
      return;
    }
    const btn = $("#submitBtn");
    btn.disabled = true; btn.textContent = "Бронируем…";
    setTimeout(() => {
      const x = days[state.day];
      $("#doneText").textContent = `${nameEl.value.trim()}, ждём вас ${x.getDate()} ${MON[x.getMonth()]} в ${state.time}. Гостей: ${state.guests}.`;
      $("#done").hidden = false;
      $("#again").focus();
      btn.disabled = false; btn.textContent = "Забронировать";
    }, 700);
  });
  $("#again").addEventListener("click", () => {
    $("#done").hidden = true;
    form.reset(); state.time = null; state.guests = 2;
    pickDay(state.day);
  });

  /* ---------- Прокрутка: шапка, прогресс, активный пункт ---------- */
  const head = $(".head"), bar = $(".progress span");
  const cup = $(".cup"), beans = $$(".bean");
  const navLinks = $$(".nav a");
  let ticking = false;
  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    head.classList.toggle("scrolled", y > 10);
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (motionOK && !window.gsap && y < innerHeight * 1.2) {
      cup.style.transform = `translateY(${y * 0.12}px) rotate(${y * -0.02}deg)`;
      beans.forEach((b, k) => { b.style.translate = `0 ${y * (0.18 + k * 0.09) * (k % 2 ? -1 : 1)}px`; });
    }
    ticking = false;
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const secs = navLinks.map(a => $(a.getAttribute("href")));
  const sectionObs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  secs.forEach(s => s && sectionObs.observe(s));

  /* ---------- Появление блоков ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal, .about-card, .map").forEach(el => io.observe(el));

  /* ---------- GSAP + Lenis: плавный скролл и анимации ---------- */
  if (!window.gsap || !motionOK) return;
  const { gsap, ScrollTrigger, SplitText } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  document.documentElement.classList.add("gs");

  // Плавная прокрутка (Lenis), синхронно с ScrollTrigger
  if (window.Lenis) {
    const lenis = new Lenis({ lerp: 0.11 });
    window.__lenis = lenis;
    // Якорные ссылки ведём сами, чтобы учесть липкую шапку
    document.addEventListener("click", e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      const target = id === "#top" ? 0 : id.length > 1 && document.querySelector(id);
      if (target === null || target === false) return;
      e.preventDefault();
      const y = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY - 76;
      lenis.scrollTo(y, { duration: 1.4 });
      if (id === "#main") $("#main").focus({ preventScroll: true });
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Заголовок первого экрана: буквы выезжают по одной
  document.fonts.ready.then(() => {
    const split = new SplitText($$(".hero-title .line > span"), { type: "words,chars", charsClass: "ch" });
    gsap.from(split.chars, { yPercent: 115, rotate: 8, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.022, delay: 0.1 });

    // Заголовки секций: слова поднимаются из-под маски при появлении
    $$("h2.split").forEach(h => {
      const sp = new SplitText(h, { type: "lines,words", mask: "lines" });
      gsap.from(sp.words, {
        yPercent: 110, duration: 0.9, ease: "expo.out", stagger: 0.04,
        scrollTrigger: { trigger: h, start: "top 88%" },
      });
    });

    // Большое «Пенка» в подвале собирается из букв
    const bigSplit = new SplitText(".logo-big", { type: "chars" });
    gsap.from(bigSplit.chars, {
      yPercent: 60, opacity: 0, rotate: () => gsap.utils.random(-25, 25), ease: "back.out(2)", stagger: 0.05, duration: 0.8,
      scrollTrigger: { trigger: ".foot", start: "top 95%" },
    });
    ScrollTrigger.refresh();
  });

  // Чашка, солнце и зёрна: параллакс, привязанный к прокрутке
  const heroST = { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 };
  gsap.to(".cup", { yPercent: 14, rotate: -6, ease: "none", scrollTrigger: heroST });
  gsap.to(".sun", { scale: 0.86, ease: "none", scrollTrigger: heroST });
  $$(".bean").forEach((b, k) => {
    const dir = k % 2 ? -1 : 1;
    gsap.to(b, { y: dir * (80 + k * 40), rotate: dir * 120, ease: "none", scrollTrigger: heroST });
  });

  // Путь зерна: на широком экране секция закрепляется и едет вбок
  gsap.matchMedia().add("(min-width: 961px)", () => {
    const pTrack = $(".process-track");
    const dist = () => pTrack.scrollWidth - innerWidth;
    const tween = gsap.to(pTrack, {
      x: () => -dist(), ease: "none",
      scrollTrigger: { trigger: ".process", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    $$(".step").forEach(st => {
      gsap.from(st.querySelector(".step-photo"), {
        scale: 0.85, rotate: -4, opacity: 0, ease: "back.out(1.4)", duration: 0.8,
        scrollTrigger: { trigger: st, containerAnimation: tween, start: "left 80%" },
      });
    });
  });
})();
