/* ADONIS CO — cinematic interactions & motion.
   Base interactions always run. The GSAP + Lenis motion layer only engages
   when the libraries are present and the visitor hasn't asked for reduced
   motion — so the page is fully usable (and visible) with JS or motion off.
   No inline handlers; CSP-safe (script-src 'self'). */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  var lenis = null;

  /* ====================================================================
     BASE INTERACTIONS (always)
     ==================================================================== */

  /* Sticky header state */
  var header = document.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("scrolled", window.scrollY > 30); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  function closeMenu() {
    if (!links) return;
    links.classList.remove("open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (lenis) lenis.start(); else document.body.style.overflow = "";
  }
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { if (lenis) lenis.stop(); else document.body.style.overflow = "hidden"; }
      else closeMenu();
    });
    links.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  }

  /* Current year */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  /* Quote form -> compose an email (a static site can't post mail itself) */
  var form = document.querySelector("[data-quote-form]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form), g = function (k) { return (d.get(k) || "").toString().trim(); };
      var to = form.getAttribute("data-to") || "info@adonisco.am";
      var subject = "Quote request — " + (g("material") || "Materials") + (g("company") ? " — " + g("company") : "");
      var body = "Name: " + g("name") + "\nCompany: " + g("company") + "\nReply email: " + g("email") +
        "\nMaterial of interest: " + g("material") + "\n\n" + g("message") + "\n";
      window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      var ok = form.querySelector("[data-form-status]");
      if (ok) ok.hidden = false;
    });
  }

  /* ---- Scroll reveals (.reveal) for inner pages -------------------------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if ("IntersectionObserver" in window) {
      var revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
      reveals.forEach(function (el) { revealIO.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add("in"); });
    }
  }

  /* ---- Lightbox for [data-lightbox] galleries (ceramics page) ------------ */
  (function () {
    var grids = document.querySelectorAll("[data-lightbox]");
    if (!grids.length) return;
    var overlay = null, imgEl, capEl, items = [], idx = 0;
    function build() {
      overlay = document.createElement("div");
      overlay.className = "lb";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML =
        '<div class="lb__backdrop" data-lb-close></div>' +
        '<button class="lb__btn lb__close" data-lb-close aria-label="Close">×</button>' +
        '<button class="lb__btn lb__prev" data-lb-prev aria-label="Previous">‹</button>' +
        '<figure class="lb__stage"><img class="lb__img" alt=""><figcaption class="lb__cap"></figcaption></figure>' +
        '<button class="lb__btn lb__next" data-lb-next aria-label="Next">›</button>';
      document.body.appendChild(overlay);
      imgEl = overlay.querySelector(".lb__img");
      capEl = overlay.querySelector(".lb__cap");
      overlay.addEventListener("click", function (e) {
        if (e.target.hasAttribute("data-lb-close")) lbClose();
        else if (e.target.hasAttribute("data-lb-prev")) lbGo(-1);
        else if (e.target.hasAttribute("data-lb-next")) lbGo(1);
      });
    }
    function lbPreload(i) { if (items[i]) { var im = new Image(); im.src = items[i].src; } }
    function lbShow() {
      var it = items[idx];
      imgEl.src = it.src; imgEl.alt = it.alt;
      capEl.textContent = (idx + 1) + " / " + items.length;
      lbPreload(idx + 1); lbPreload(idx - 1);
    }
    function lbGo(d) { idx = (idx + d + items.length) % items.length; lbShow(); }
    function lbOpen(list, i) {
      items = list; idx = i;
      if (!overlay) build();
      lbShow();
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      if (lenis) lenis.stop(); else document.body.style.overflow = "hidden";
    }
    function lbClose() {
      if (!overlay) return;
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      if (lenis) lenis.start(); else document.body.style.overflow = "";
    }
    document.addEventListener("keydown", function (e) {
      if (!overlay || !overlay.classList.contains("open")) return;
      if (e.key === "Escape") lbClose();
      else if (e.key === "ArrowLeft") lbGo(-1);
      else if (e.key === "ArrowRight") lbGo(1);
    });
    grids.forEach(function (grid) {
      var anchors = [].slice.call(grid.querySelectorAll("a"));
      var list = anchors.map(function (a) { var im = a.querySelector("img"); return { src: a.getAttribute("href"), alt: im ? im.alt : "" }; });
      anchors.forEach(function (a, i) { a.addEventListener("click", function (e) { e.preventDefault(); lbOpen(list, i); }); });
    });
    var sx = 0;
    document.addEventListener("touchstart", function (e) { if (overlay && overlay.classList.contains("open")) sx = e.touches[0].clientX; }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!overlay || !overlay.classList.contains("open")) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) lbGo(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  /* ====================================================================
     MOTION LAYER (only when safe)
     ==================================================================== */
  if (!hasGSAP || reduceMQ.matches) {
    // No motion: anchor links fall back to native smooth scroll (CSS).
    return;
  }

  root.classList.add("anim-ready");
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  var DESKTOP = window.matchMedia("(min-width: 760px)").matches;
  var FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---- Lenis inertia scroll, synced to GSAP's ticker ---- */
  if (window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.08,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    /* In-page anchors ride Lenis */
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      a.addEventListener("click", function (e) {
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        closeMenu();
        lenis.scrollTo(target, { offset: -70, duration: 1.2 });
      });
    });
  }

  /* ---- Hero load sequence ---- */
  var hero = document.querySelector(".hero");
  if (hero) {
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(".hero__media img", { scale: 1.18 }, { scale: 1.12, duration: 1.8, ease: "power2.out" }, 0)
      .fromTo(hero, { "--bloom": 0 }, { "--bloom": 0.85, duration: 2.0, ease: "power2.out" }, 0.1)
      .fromTo(".hero .line > span", { yPercent: 115 }, { yPercent: 0, duration: 1.15, stagger: 0.1 }, 0.35)
      .fromTo(".hero__route", { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.8 }, 0.5)
      .fromTo(".hero__sub", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9 }, 0.7)
      .fromTo(".hero__cta > *", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 0.85)
      .fromTo(".hero__foot", { opacity: 0 }, { opacity: 1, duration: 0.9 }, 1.0);
  }

  /* ---- Scroll reveals: batch [data-anim] with stagger ---- */
  ScrollTrigger.batch("[data-anim]", {
    start: "top 86%",
    once: true,
    onEnter: function (els) {
      els.forEach(function (el, i) {
        var kind = el.getAttribute("data-anim");
        var from = { opacity: 0 };
        if (kind === "scale") { from.scale = 1.06; }
        else { from.y = 36; }
        gsap.fromTo(el, from, {
          opacity: 1, y: 0, scale: 1, duration: 0.95, ease: "expo.out",
          delay: Math.min(i, 5) * 0.07,
          onComplete: function () { el.style.willChange = "auto"; }
        });
      });
    }
  });

  /* ---- Veins of light draw themselves ---- */
  gsap.utils.toArray(".vein").forEach(function (v) {
    gsap.fromTo(v, { "--vein": "0%" }, {
      "--vein": "100%", ease: "none",
      scrollTrigger: { trigger: v, start: "top 92%", end: "top 55%", scrub: 0.6 }
    });
  });

  /* ---- Stat counters ---- */
  gsap.utils.toArray("[data-count]").forEach(function (el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var node = el.firstChild;            // the number text node ("0"); any <i> suffix stays put
    var obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: target, duration: 1.6, ease: "power2.out",
          onUpdate: function () { node.nodeValue = Math.round(obj.v) + ""; },
          onComplete: function () { node.nodeValue = target + ""; }
        });
      }
    });
  });

  /* ---- Onyx feature: light sweeps across the slab on scroll ---- */
  var fm = document.querySelector(".feature__media");
  if (fm) {
    gsap.fromTo(fm, { "--sweep": "-45%" }, {
      "--sweep": "145%", ease: "none",
      scrollTrigger: { trigger: fm, start: "top 80%", end: "bottom 30%", scrub: 0.8 }
    });
  }

  /* ---- Subtle parallax on stone imagery (desktop only).
         GSAP owns a constant scale so the translate never exposes an edge.
         Collection cards are left to their CSS hover-zoom (no transform clash). ---- */
  if (DESKTOP) {
    if (hero) {
      gsap.to(".hero__media img", {
        yPercent: 8, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
      });
    }
    gsap.utils.toArray(".feature__media img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, {
        yPercent: 6, scale: 1.12, ease: "none",
        scrollTrigger: { trigger: img.closest(".feature__media"), start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }

  /* ---- Seamless ticker marquee ---- */
  var track = document.querySelector(".ticker__track");
  if (track) {
    var loop = gsap.to(track, { xPercent: -50, ease: "none", duration: 28, repeat: -1 });
    var tk = document.querySelector(".ticker");
    if (tk) {
      tk.addEventListener("mouseenter", function () { gsap.to(loop, { timeScale: 0, duration: 0.4 }); });
      tk.addEventListener("mouseleave", function () { gsap.to(loop, { timeScale: 1, duration: 0.4 }); });
    }
  }

  /* ---- Magnetic primary buttons (fine pointers only) ---- */
  if (FINE) {
    document.querySelectorAll(".btn--amber").forEach(function (btn) {
      var rect;
      btn.addEventListener("pointerenter", function () { rect = btn.getBoundingClientRect(); });
      btn.addEventListener("pointermove", function (e) {
        if (!rect) rect = btn.getBoundingClientRect();
        var mx = e.clientX - rect.left - rect.width / 2;
        var my = e.clientY - rect.top - rect.height / 2;
        gsap.to(btn, { x: mx * 0.25, y: my * 0.35, duration: 0.5, ease: "power3.out" });
      });
      btn.addEventListener("pointerleave", function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ---- Keep triggers honest after fonts/images settle ---- */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function () { ScrollTrigger.refresh(); }); }

  /* If the visitor flips on reduced-motion mid-session, bail cleanly */
  reduceMQ.addEventListener && reduceMQ.addEventListener("change", function (e) {
    if (e.matches) {
      ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
      if (lenis) lenis.destroy();
      gsap.globalTimeline.clear();
      gsap.set("[data-anim], .hero .line > span, .hero__sub, .hero__cta > *, .hero__foot, .hero__route",
        { clearProps: "all", opacity: 1, y: 0, scale: 1, yPercent: 0 });
      root.classList.remove("anim-ready");
    }
  });
})();
