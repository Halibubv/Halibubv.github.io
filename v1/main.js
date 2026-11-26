/* Halibubv — вариант 1 «Тёмный кинематограф».
   Всё работает без библиотек: если GSAP/Lenis не загрузились, страница просто без анимаций. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
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
        '<a class="work" data-reveal data-tilt href="../' + esc(w.link) + '">' +
          '<span class="glare" aria-hidden="true"></span>' +
          '<div class="thumb"><img src="../' + esc(w.image) + '" alt="' + esc(w.title) + ': ' + esc(w.kind) + '" loading="lazy" width="1440" height="900"></div>' +
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

  /* ---------- 3D tilt on work cards ---------- */
  if (finePointer && !reduced) {
    document.querySelectorAll("[data-tilt]").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        if (isMobile()) return;
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;
        var y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
        card.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
        var rx = (0.5 - y) * 10, ry = (x - 0.5) * 12;
        if (hasGsap) gsap.to(card, { rotateX: rx, rotateY: ry, transformPerspective: 1000, duration: 0.6, ease: "power3.out", overwrite: "auto" });
        else card.style.transform = "perspective(1000px) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
      });
      card.addEventListener("mouseleave", function () {
        if (hasGsap) gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.9, ease: "elastic.out(1, .6)", overwrite: "auto" });
        else card.style.transform = "";
      });
    });
  }

  /* ---------- custom cursor ---------- */
  var cursor = document.querySelector(".cursor");
  if (cursor && finePointer && !reduced && !isMobile()) {
    root.classList.add("has-cursor");
    var ring = cursor.querySelector(".cursor-ring");
    var dot = cursor.querySelector(".cursor-dot");
    var mx = window.innerWidth / 2, my = window.innerHeight / 2, rx2 = mx, ry2 = my;
    cursor.classList.add("hidden");
    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      cursor.classList.remove("hidden");
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
    }, { passive: true });
    document.addEventListener("mouseleave", function () { cursor.classList.add("hidden"); });
    document.addEventListener("mouseover", function (e) {
      cursor.classList.toggle("hover", !!(e.target.closest && e.target.closest("a, button, [data-cursor]")));
    });
    (function loop() {
      rx2 += (mx - rx2) * 0.16; ry2 += (my - ry2) * 0.16;
      ring.style.transform = "translate3d(" + rx2.toFixed(2) + "px," + ry2.toFixed(2) + "px,0)";
      requestAnimationFrame(loop);
    })();
    window.addEventListener("resize", function () {
      if (isMobile()) { root.classList.remove("has-cursor"); } else { root.classList.add("has-cursor"); }
    });
  }

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
