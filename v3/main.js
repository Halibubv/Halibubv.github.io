(function () {
  "use strict";

  var root = document.documentElement;

  // 1. Работы из общего списка ../works.js (пути в нём от корня сайта)
  var track = document.getElementById("works-track");
  var esc = function (t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  };
  var fromRoot = function (p) {
    p = String(p || "");
    return /^(https?:)?\/\//.test(p) || p.charAt(0) === "/" || p.charAt(0) === "#" ? p : "../" + p;
  };

  (window.WORKS || []).forEach(function (w, i) {
    var a = document.createElement("a");
    a.className = "panel work";
    a.href = fromRoot(w.link);
    a.innerHTML =
      '<div class="shot"><img src="' + esc(fromRoot(w.image)) + '" alt="' + esc(w.title) + ': ' + esc(w.kind) + '" width="1440" height="900" loading="' + (i === 0 ? "eager" : "lazy") + '"></div>' +
      '<div class="work-meta">' +
        '<span class="work-kind">' + String(i + 1).padStart(2, "0") + ' — ' + esc(w.kind) + '</span>' +
        '<h3>' + esc(w.title) + '</h3>' +
        '<div><p class="work-text">' + esc(w.text) + '</p>' +
        '<ul class="chips">' + (w.stack || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul>' +
        '<span class="more"><span class="u">Подробнее</span> →</span></div>' +
      '</div>';
    track.appendChild(a);
  });

  var soon = document.createElement("a");
  soon.className = "panel soon";
  soon.href = "#contacts";
  soon.innerHTML =
    '<span class="soon-k">Беру новые заказы</span>' +
    '<h3>Здесь может быть ваш сайт</h3>' +
    '<span class="soon-cta"><span class="u">Написать мне</span> →</span>';
  track.appendChild(soon);

  // 2. Движение: только если библиотеки загрузились и нет prefers-reduced-motion
  if (!root.classList.contains("anim")) return;

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);

  // Плавный скролл Lenis, связанный со ScrollTrigger
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on("scroll", ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // Якорные ссылки через Lenis (с учётом высоты шапки)
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    var el = id.length > 1 ? document.querySelector(id) : null;
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: id === "#main" ? -200 : -60 });
    else el.scrollIntoView({ behavior: "smooth" });
    if (history.replaceState) history.replaceState(null, "", id);
  });

  // Заголовок: слова выезжают снизу
  gsap.fromTo("h1 .w > *", { y: 0, yPercent: 105 }, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.07, delay: 0.15 });
  gsap.fromTo(".hero .fade", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.12, delay: 0.7 });

  // Появление блоков секций
  gsap.utils.toArray(".rise").forEach(function (el) {
    gsap.fromTo(el, { opacity: 0, y: 40 }, {
      opacity: 1, y: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true }
    });
  });

  // Бегущая строка ускоряется от скорости прокрутки
  var mq = document.querySelector(".marquee-track");
  if (mq && lenis) {
    var anims = mq.getAnimations ? mq.getAnimations() : [];
    lenis.on("scroll", function (l) {
      var v = Math.min(Math.abs(l.velocity || 0), 40);
      anims.forEach(function (an) { an.playbackRate = 1 + v / 8; });
    });
  }

  // Шторка для скриншотов
  function curtain(shot, st) {
    var img = shot.querySelector("img");
    var tl = gsap.timeline({ scrollTrigger: st });
    tl.fromTo(shot, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.3, ease: "expo.inOut" })
      .fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.6, ease: "expo.out" }, 0.15);
  }

  // Горизонтальная лента «Работ» только на десктопе
  var mm = gsap.matchMedia();
  mm.add("(min-width: 769px) and (prefers-reduced-motion: no-preference)", function () {
    root.classList.add("is-h");
    var section = document.getElementById("works");
    var pin = section.querySelector(".works-pin");
    var bar = section.querySelector(".works-progress span");
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };

    var tween = gsap.to(track, {
      x: function () { return -dist(); },
      ease: "none",
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: function () { return "+=" + dist(); },
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: function (self) { if (bar) gsap.set(bar, { scaleX: self.progress }); }
      }
    });

    section.querySelectorAll(".shot").forEach(function (shot) {
      var startsVisible = shot.getBoundingClientRect().left - track.getBoundingClientRect().left < window.innerWidth * 0.85;
      curtain(shot, startsVisible
        ? { trigger: pin, start: "top 55%", once: true }
        : { trigger: shot, containerAnimation: tween, start: "left 85%", once: true });
    });

    // Лёгкий параллакс заголовков панелей
    section.querySelectorAll(".work h3, .soon h3").forEach(function (h) {
      gsap.fromTo(h, { xPercent: 12 }, { xPercent: 0, ease: "none",
        scrollTrigger: { trigger: h, containerAnimation: tween, start: "left right", end: "left 30%", scrub: true } });
    });

    return function () { root.classList.remove("is-h"); gsap.set(track, { clearProps: "transform" }); };
  });

  mm.add("(max-width: 768px) and (prefers-reduced-motion: no-preference)", function () {
    document.querySelectorAll("#works .shot").forEach(function (shot) {
      curtain(shot, { trigger: shot, start: "top 85%", once: true });
    });
  });

  // Пересчитать после загрузки шрифтов и картинок
  window.addEventListener("load", function () { ST.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
})();
