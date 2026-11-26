/* Halibubv — главная (основа: вариант 1 «Тёмный кинематограф»).
   Всё работает без библиотек: если GSAP/Lenis не загрузились, страница просто без анимаций. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = function () { return window.innerWidth <= 768; };
  var hasGsap = typeof window.gsap !== "undefined";
  var hasST = hasGsap && typeof window.ScrollTrigger !== "undefined";
  var gsap = window.gsap;

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- works ---------- */
  var grid = document.getElementById("works-grid");
  if (grid) {
    var html = "";
    (window.WORKS || []).forEach(function (w) {
      html +=
        '<a class="work" data-reveal href="' + esc(w.link) + '">' +
          '<div class="thumb"><span class="sheen" aria-hidden="true"></span><img src="' + esc(w.image) + '" alt="' + esc(w.title) + ': ' + esc(w.kind) + '" loading="lazy" width="1440" height="900"></div>' +
          '<div class="body">' +
            '<div class="kind">' + esc(w.kind) + '</div>' +
            '<h3>' + esc(w.title) + '</h3>' +
            '<p>' + esc(w.text) + '</p>' +
            '<ul class="chips">' + (w.stack || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul>' +
            '<span class="more">Подробнее <i aria-hidden="true">→</i></span>' +
          '</div>' +
        '</a>';
    });
    html +=
      '<a class="work soon" data-reveal href="#contacts">' +
        '<span class="plus" aria-hidden="true">+</span>' +
        '<h3>Здесь может быть ваш сайт</h3>' +
        '<p>Беру новые заказы. <span class="more">Написать мне <i aria-hidden="true">→</i></span></p>' +
      '</a>';
    grid.innerHTML = html;
  }

  /* ---------- nav state ---------- */
  var nav = document.querySelector(".nav");
  function onScroll() { if (nav) nav.classList.toggle("scrolled", window.scrollY > 20); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Lenis smooth scroll ---------- */
  var lenis = null;
  if (!reduced && typeof window.Lenis !== "undefined") {
    try {
      lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
      if (hasST) {
        lenis.on("scroll", window.ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
      } else {
        var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
    } catch (e) { lenis = null; }
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    var id = a.getAttribute("href");
    var target = id === "#top" || id === "#" ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: target === 0 ? 0 : -70 });
    if (target !== 0 && history.replaceState) history.replaceState(null, "", id);
  });

  /* ---------- hero intro ---------- */
  function splitTitle(el) {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    function walk(node, parent) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span");
            w.className = "w"; w.setAttribute("aria-hidden", "true");
            Array.prototype.forEach.call(part, function (ch) {
              var c = document.createElement("span");
              c.className = "c"; c.textContent = ch; w.appendChild(c);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    }
    walk(el);
  }

  var title = document.querySelector(".hero-title");
  if (hasGsap && !reduced && title) {
    splitTitle(title);
    root.classList.add("anim-ready");
    var tl = gsap.timeline({ delay: 0.15 });
    tl.from(".nav", { y: -30, opacity: 0, duration: 0.9, ease: "power3.out" }, 0)
      .from(".hero-title .c", { yPercent: 115, rotate: 6, duration: 1.1, ease: "power4.out", stagger: 0.016 }, 0.05)
      .from(".hero-fade", { y: 24, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 }, 0.55)
      .from(".scroll-line", { opacity: 0, duration: 0.8 }, 1.2);
  } else {
    root.classList.add("anim-ready");
  }

  /* ---------- scroll reveals ---------- */
  if (hasST && !reduced) {
    gsap.registerPlugin(window.ScrollTrigger);
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (n) { return n.hasAttribute("data-reveal"); });
      var i = Math.max(0, sibs.indexOf(el));
      var isCard = el.classList.contains("work") || el.classList.contains("card");
      if (el.classList.contains("work")) {
        // Карточка работы: раскрывается снизу вверх, картинка «приезжает» из лёгкого зума.
        var img = el.querySelector("img");
        var tl2 = gsap.timeline({ delay: (i % 2) * 0.12, scrollTrigger: { trigger: el, start: "top 88%", once: true } });
        tl2.from(el, { clipPath: "inset(18% 0% 0% 0% round 22px)", y: 40, opacity: 0, duration: 1.1, ease: "power3.out", clearProps: "clipPath,transform,opacity" });
        if (img) tl2.from(img, { scale: 1.18, duration: 1.6, ease: "power3.out", clearProps: "transform" }, 0);
        return;
      }
      gsap.from(el, {
        y: isCard ? 70 : 40, opacity: 0, duration: 1.1, ease: "power3.out",
        delay: (i % 4) * 0.09,
        clearProps: isCard ? "opacity" : "transform,opacity",
        scrollTrigger: { trigger: el, start: "top 90%", once: true }
      });
    });
    gsap.to(".hero-in", {
      yPercent: 18, opacity: 0.25, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
    window.addEventListener("load", function () { window.ScrollTrigger.refresh(); });
  }

  /* ---------- терминал в «Обо мне»: строки появляются по очереди ---------- */
  var term = document.querySelector(".term");
  if (term) {
    term.querySelectorAll(".term-body li").forEach(function (li, i) { li.style.transitionDelay = (0.25 + i * 0.28) + "s"; });
    if ("IntersectionObserver" in window && !reduced) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { term.classList.add("on"); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(term);
    } else { term.classList.add("on"); }
  }

  /* ---------- «Как работаю»: линия заполняется при прокрутке ---------- */
  var steps = document.querySelector(".steps");
  if (steps && hasST && !reduced) {
    gsap.to(steps, { "--p": 1, ease: "none", scrollTrigger: { trigger: steps, start: "top 80%", end: "bottom 55%", scrub: 0.6 } });
  } else if (steps) { steps.style.setProperty("--p", 1); }

  /* ---------- hero particle field ---------- */
  var canvas = document.getElementById("particles");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var hero = canvas.parentNode;
    var W = 0, H = 0, dpr = 1, pts = [], linkDist = 120;
    var mouse = { x: -9999, y: -9999, on: false };
    var running = false, inView = true, rafId = 0;

    var resize = function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var mobile = isMobile();
      var n = Math.round((W * H) / (mobile ? 7000 : 4600));
      n = mobile ? Math.max(50, Math.min(n, 110)) : Math.max(140, Math.min(n, 320));
      linkDist = mobile ? 90 : 125;
      pts = [];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, s = 0.08 + Math.random() * 0.22;
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          bx: Math.cos(a) * s, by: Math.sin(a) * s, vx: 0, vy: 0,
          r: 0.6 + Math.random() * 1.6,
          warm: Math.random() < 0.18,
          a: 0.35 + Math.random() * 0.55
        });
      }
      draw();
    };

    var step = function () {
      var R = 150, R2 = R * R;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (mouse.on) {
          var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            var d = Math.sqrt(d2), f = (1 - d / R) * 0.9;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
          }
        }
        p.vx *= 0.92; p.vy *= 0.92;
        p.x += p.bx + p.vx; p.y += p.by + p.vy;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }
    };

    var draw = function () {
      ctx.clearRect(0, 0, W, H);
      var L2 = linkDist * linkDist;
      ctx.lineWidth = 0.6;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < L2) {
            var al = (1 - d2 / L2) * 0.16;
            ctx.strokeStyle = (p.warm || q.warm) ? "rgba(255,150,80," + al.toFixed(3) + ")" : "rgba(230,225,215," + (al * 0.8).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      for (var k = 0; k < pts.length; k++) {
        var o = pts[k];
        ctx.fillStyle = o.warm ? "rgba(255,150,80," + o.a + ")" : "rgba(241,237,230," + (o.a * 0.8) + ")";
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
      }
    };

    var frame = function () {
      if (!running) return;
      step(); draw();
      rafId = requestAnimationFrame(frame);
    };
    var update = function () {
      var should = !reduced && inView && !document.hidden;
      if (should && !running) { running = true; rafId = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; cancelAnimationFrame(rafId); }
    };

    resize();
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (Math.abs(hero.clientWidth - W) > 2 || Math.abs(hero.clientHeight - H) > 120) resize(); }, 150);
    });
    document.addEventListener("visibilitychange", update);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; update(); }).observe(hero);
    }
    if (!reduced) {
      window.addEventListener("mousemove", function (e) {
        var r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
        mouse.on = mouse.y > -50 && mouse.y < r.height + 50;
      }, { passive: true });
      hero.addEventListener("mouseleave", function () { mouse.on = false; });
    }
    update();
  }
})();
