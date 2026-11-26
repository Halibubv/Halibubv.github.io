(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  function esc(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML.replace(/"/g, "&quot;");
  }
  // Paths in works.js are relative to the site root; this page lives in /v2/.
  function fromRoot(p) {
    p = String(p || "");
    if (/^([a-z]+:|\/\/|\/|#)/i.test(p)) return p;
    return "../" + p;
  }

  /* ---------- Works ---------- */
  var soon = document.getElementById("works-soon");
  if (soon && Array.isArray(window.WORKS)) {
    window.WORKS.forEach(function (w) {
      var a = document.createElement("a");
      a.className = "tile work";
      a.href = fromRoot(w.link);
      var stack = Array.isArray(w.stack) ? w.stack : [];
      a.innerHTML =
        (w.image ? '<div class="thumb"><img src="' + esc(fromRoot(w.image)) + '" alt="' + esc("Скриншот проекта " + w.title) + '" loading="lazy" decoding="async"></div>' : "") +
        '<div class="body">' +
          '<div class="kind">' + esc(w.kind) + "</div>" +
          "<h3>" + esc(w.title) + "</h3>" +
          "<p>" + esc(w.text) + "</p>" +
          (stack.length ? '<ul class="chips" aria-label="Технологии">' + stack.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") +
          '<span class="more">Подробнее →</span>' +
        "</div>";
      soon.parentNode.insertBefore(a, soon);
    });
  }

  /* ---------- Spotlight on work cards ---------- */
  document.querySelectorAll(".work").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  if (reduced) return; // final numbers, no magnet, no reveal

  /* ---------- Reveal with stagger ---------- */
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tile"));
  if (hasIO) {
    root.classList.add("js-reveal");
    var revealIO = new IntersectionObserver(function (entries) {
      var batch = entries.filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return tiles.indexOf(a.target) - tiles.indexOf(b.target); });
      batch.forEach(function (e, i) {
        var el = e.target;
        el.style.setProperty("--d", (i * 90) + "ms");
        el.classList.add("in");
        revealIO.unobserve(el);
        // drop the delay afterwards so hover transitions are instant
        setTimeout(function () { el.classList.add("revealed"); }, 900 + i * 90);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    tiles.forEach(function (t) { revealIO.observe(t); });
    // Safety net: never leave content hidden.
    setTimeout(function () { tiles.forEach(function (t) { t.classList.add("in", "revealed"); }); }, 6000);
  }

  /* ---------- Odometer prices ---------- */
  var nums = Array.prototype.slice.call(document.querySelectorAll(".price .num"));
  var reels = [];
  nums.forEach(function (num, n) {
    var text = num.textContent;
    var html = '<span class="sr">' + esc(text) + '</span><span class="drum" aria-hidden="true">';
    var digitIndex = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (/\d/.test(ch)) {
        var cells = "";
        for (var k = 0; k < 20; k++) cells += "<span>" + (k % 10) + "</span>";
        html += '<span class="odo-d"><span class="odo-reel" data-to="' + (10 + Number(ch)) + '" data-i="' + (digitIndex++) + '" data-n="' + n + '">' + cells + "</span></span>";
      } else {
        html += '<span class="odo-sep"></span>';
      }
    }
    num.innerHTML = html + "</span>";
  });
  reels = Array.prototype.slice.call(document.querySelectorAll(".odo-reel"));

  function spin() {
    reels.forEach(function (r) {
      var to = Number(r.getAttribute("data-to"));
      var i = Number(r.getAttribute("data-i"));
      var n = Number(r.getAttribute("data-n"));
      r.style.transition = "transform " + (1.3 + i * 0.18) + "s cubic-bezier(.16,.84,.24,1) " + (n * 0.15 + 0.2) + "s";
      r.style.transform = "translateY(" + (-to * 1.1) + "em)";
    });
  }
  var services = document.getElementById("services");
  if (hasIO && services) {
    var odoIO = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { spin(); odoIO.disconnect(); }
    }, { threshold: 0.3 });
    odoIO.observe(services);
  } else {
    spin();
  }

  /* ---------- Magnetic buttons ---------- */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var wide = window.matchMedia("(min-width: 769px)");
  var magnets = Array.prototype.slice.call(document.querySelectorAll(".magnet"));
  var px = -1e4, py = -1e4, raf = 0;

  function applyMagnets() {
    raf = 0;
    var on = fine.matches && wide.matches;
    magnets.forEach(function (m) {
      var r = m.getBoundingClientRect();
      // use the un-transformed centre
      var tx = parseFloat(m.dataset.tx || 0), ty = parseFloat(m.dataset.ty || 0);
      var cx = r.left + r.width / 2 - tx, cy = r.top + r.height / 2 - ty;
      var dx = px - cx, dy = py - cy;
      var reach = Math.max(r.width, r.height) / 2 + 70;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var nx = 0, ny = 0;
      if (on && dist < reach) {
        var pull = 0.32 * (1 - dist / reach * 0.4);
        nx = Math.max(-14, Math.min(14, dx * pull));
        ny = Math.max(-10, Math.min(10, dy * pull));
      }
      if (nx !== tx || ny !== ty) {
        m.dataset.tx = nx; m.dataset.ty = ny;
        m.classList.toggle("is-pulled", nx !== 0 || ny !== 0);
        m.style.transform = (nx || ny) ? "translate(" + nx.toFixed(1) + "px," + ny.toFixed(1) + "px)" : "";
      }
    });
  }
  function queue() { if (!raf) raf = requestAnimationFrame(applyMagnets); }
  window.addEventListener("pointermove", function (e) { px = e.clientX; py = e.clientY; queue(); }, { passive: true });
  document.addEventListener("pointerleave", function () { px = py = -1e4; queue(); });
  window.addEventListener("scroll", queue, { passive: true });
})();
