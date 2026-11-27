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

  /* ---------- Меню: из базы, GET /api/menu ---------- */
  // Тексты меню правит администратор, поэтому перед вставкой в HTML экранируем их.
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const MENU = {};
  let menuMessage = "Загружаем меню…";

  const grid = $("#menuGrid");
  const tabs = $$(".tabs [role=tab]");
  const pill = $(".tab-pill");

  function renderMenu(cat) {
    if (!MENU[cat]) { grid.innerHTML = `<p class="menu-msg">${menuMessage}</p>`; return; }
    // off — позиция в стоп-листе: видна, но заказать нельзя. Кнопку «+» обрабатывает app.js.
    grid.innerHTML = MENU[cat].map((x, k) => `
      <article class="item${x.off ? " off" : ""}" style="animation-delay:${k * 60}ms">
        <div class="item-ic" aria-hidden="true">${ICONS[x.i] || ICONS.cup}</div>
        <div><h3>${esc(x.n)}${x.t.map(t => `<span class="tag${t === "хит" ? " hot" : ""}">${esc(t)}</span>`).join("")}${x.off ? '<span class="tag stop">нет в наличии</span>' : ""}</h3><p>${esc(x.d)}</p></div>
        <div class="price">${x.p} ₽${x.s ? `<small>${esc(x.s)}</small>` : ""}</div>
        <button class="add" type="button" data-add="${x.id}"${x.off ? ' disabled aria-label="Нет в наличии"' : ` aria-label="Добавить «${esc(x.n)}» в заказ"`}>+</button>
      </article>`).join("");
  }
  fetch("/api/menu")
    .then(r => r.ok ? r.json() : Promise.reject(r))
    .then(data => {
      data.categories.forEach(c => {
        MENU[c.code] = c.items.map(x => ({ id: x.id, n: x.name, d: x.description || "", p: x.price, s: x.size || "", i: x.icon, t: x.tags, off: !x.is_available }));
      });
      window.PenkaApp && window.PenkaApp.setMenu(data.categories);
    })
    .catch(() => { menuMessage = "Не удалось загрузить меню: сервер не отвечает. Обновите страницу чуть позже."; })
    .finally(() => renderMenu($(".tabs [aria-selected=true]").dataset.cat));
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

  /* ---------- Часы работы и статус «открыто»: GET /api/hours ---------- */
  // Статус считает сервер по московскому времени, поэтому он верный в любом часовом поясе гостя.
  const short = t => t.replace(/^0/, "");
  function status() {
    fetch("/api/hours")
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        data.days.forEach(x => {
          const td = $(`#hours tr[data-d="${x.weekday}"] td`);
          if (td) td.textContent = x.opens ? `${short(x.opens)} — ${short(x.closes)}` : "выходной";
        });
        $$("#hours tr").forEach(tr => tr.classList.toggle("today", +tr.dataset.d === data.today));
        const open = data.status.open;
        const box = $("#status");
        box.classList.toggle("open", open);
        box.classList.toggle("closed", !open);
        $("#statusText").textContent = data.status.text;
        $("#heroStatus").textContent = data.status.short;
        $(".eyebrow .live-dot").parentElement.classList.toggle("closed", !open);
      })
      .catch(() => { $("#statusText").textContent = "Часы работы не загрузились"; });
  }
  status();
  setInterval(status, 60000);

  /* ---------- Бронь ---------- */
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const WD_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const state = { day: null, time: null, guests: 2 };
  const daysBox = $("#days"), slotsBox = $("#slots");

  // 14 дней вперёд. День считаем по Москве, как сервер (кофейня в Москве).
  const msk = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const days = [];
  for (let k = 0; k < 14; k++) { const x = new Date(msk); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + k); days.push(x); }
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

  daysBox.innerHTML = days.map((x, k) => `<button type="button" class="chip day" data-k="${k}" aria-pressed="false"><small>${k === 0 ? "сегодня" : k === 1 ? "завтра" : WD[x.getDay()]}</small><b>${x.getDate()}</b><small>${MON[x.getMonth()].slice(0, 3)}</small></button>`).join("");

  // Свободное время приходит с сервера: GET /api/slots?date=…&guests=N.
  // Сервер знает, какие столики уже заняты, и сам выберет столик при брони.
  let slotRequest = 0, autoNextDay = true;
  function renderSlots() {
    const request = ++slotRequest;
    const k = state.day;
    $("#slotHint").textContent = "";
    slotsBox.innerHTML = '<p class="slots-msg">Смотрим свободное время…</p>';
    fetch(`/api/slots?date=${iso(days[k])}&guests=${state.guests}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        if (request !== slotRequest) return; // пока ждали, гость выбрал другой день
        let free = 0;
        slotsBox.innerHTML = data.slots.map(s => {
          if (s.free) free++;
          return `<button type="button" class="chip" data-t="${s.time}" aria-pressed="${state.time === s.time}" ${s.free ? "" : `disabled aria-label="${s.time}, занято"`}>${short(s.time)}</button>`;
        }).join("") || `<p class="slots-msg">${data.note || "На этот день мест нет."}</p>`;
        $("#slotHint").textContent = free ? `свободно ${free}` : "на этот день мест нет";
        if (data.note && data.slots.length) slotsBox.insertAdjacentHTML("beforeend", `<p class="slots-msg">${data.note}</p>`);
        if (motionOK) { slotsBox.classList.remove("pop"); void slotsBox.offsetWidth; slotsBox.classList.add("pop"); }
        // Выбранное время на новый день или для нового числа гостей занято — сбрасываем.
        if (state.time && !slotsBox.querySelector(`[data-t="${state.time}"]:not(:disabled)`)) { state.time = null; updTicket(); }
        // Если сегодня свободного времени уже нет — один раз сами открываем завтра.
        if (autoNextDay && k === 0 && !free) pickDay(1);
        autoNextDay = false;
      })
      .catch(() => {
        if (request !== slotRequest) return;
        slotsBox.innerHTML = '<p class="slots-msg">Не удалось загрузить свободное время: сервер не отвечает. Обновите страницу чуть позже.</p>';
      });
  }

  function flash(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }

  function updTicket() {
    const x = days[state.day];
    flash($("#tDay"), `${WD_FULL[x.getDay()][0].toUpperCase() + WD_FULL[x.getDay()].slice(1)}, ${x.getDate()} ${MON[x.getMonth()]}`);
    flash($("#tTime"), state.time ? short(state.time) : "не выбрано");
    flash($("#tGuests"), String(state.guests));
    flash($("#tTable"), "подберём сами");
    $("#gCount").textContent = state.guests;
    $("#gMinus").disabled = state.guests <= 1;
    $("#gPlus").disabled = state.guests >= 8;
    $("#seats").innerHTML = "<i></i>".repeat(state.guests);
  }

  function pickDay(k) {
    state.day = k;
    $$(".day", daysBox).forEach(b => b.setAttribute("aria-pressed", +b.dataset.k === k));
    // если выбранное время на новый день недоступно, renderSlots его сбросит
    renderSlots();
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
  // Число гостей меняет свободное время: столик на шестерых может быть занят, а на двоих — нет.
  $("#gMinus").addEventListener("click", () => { state.guests = Math.max(1, state.guests - 1); updTicket(); renderSlots(); });
  $("#gPlus").addEventListener("click", () => { state.guests = Math.min(8, state.guests + 1); updTicket(); renderSlots(); });

  // Если сегодня свободных слотов уже нет — renderSlots сам откроет завтра
  pickDay(0);

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
    // Отправляем бронь на сервер: POST /api/reservations. Столик подбирает сервер.
    const btn = $("#submitBtn");
    bookErr.hidden = true;
    btn.disabled = true; btn.textContent = "Бронируем…";
    const x = days[state.day];
    fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: iso(x), time: state.time, guests: state.guests, name: nameEl.value.trim(), phone: phone.value, comment: $("#comment").value }),
    })
      .then(r => r.json().catch(() => ({})).then(data => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (!ok) {
          const fields = data.fields || {};
          if (fields.name) bad(nameEl, true);
          if (fields.phone) bad(phone, true);
          showBookError(data.error || "Не удалось забронировать. Попробуйте ещё раз.");
          if (status === 409 || fields.time) renderSlots(); // время успели занять — показываем свежее
          return;
        }
        const r = data.reservation;
        $("#doneText").textContent = `${nameEl.value.trim()}, ждём вас ${x.getDate()} ${MON[x.getMonth()]} в ${short(state.time)}. Гостей: ${state.guests}. Столик № ${r.table_label}, ${r.zone_name}.`;
        flash($("#tTable"), `№ ${r.table_label}, ${r.zone_name}`);
        $("#done").hidden = false;
        $("#again").focus();
      })
      .catch(() => showBookError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз."))
      .finally(() => { btn.disabled = false; btn.textContent = "Забронировать"; });
  });
  // Сообщение об ошибке брони — под кнопкой «Забронировать».
  const bookErr = document.createElement("p");
  bookErr.className = "book-err"; bookErr.hidden = true; bookErr.setAttribute("role", "alert");
  $("#submitBtn").after(bookErr);
  function showBookError(text) { bookErr.textContent = text; bookErr.hidden = false; }
  $("#again").addEventListener("click", () => {
    $("#done").hidden = true;
    form.reset(); state.time = null; state.guests = 2;
    window.PenkaApp && window.PenkaApp.prefill(); // снова подставить имя и телефон вошедшего гостя
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
