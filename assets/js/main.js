/* ADONIS CO — interactions
   Kept intentionally small: a sticky header state, a mobile menu,
   scroll-reveal, and a quote form that composes an email. No dependencies. */
(function () {
  "use strict";

  /* Sticky header: solid once the hero is scrolled past a touch */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile navigation */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* Scroll reveal */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* Current year */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  /* Quote form -> compose an email to the sales inbox.
     A static site can't send mail itself; this opens the visitor's mail
     client pre-filled. Swap the action for Formspree/Getform for a true
     inbox-less submission (see README). */
  var form = document.querySelector("[data-quote-form]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = (data.get("name") || "").toString().trim();
      var company = (data.get("company") || "").toString().trim();
      var material = (data.get("material") || "").toString().trim();
      var message = (data.get("message") || "").toString().trim();
      var email = (data.get("email") || "").toString().trim();
      var to = form.getAttribute("data-to") || "sales@adonisco.am";
      var subject = "Quote request — " + (material || "Materials") + (company ? " — " + company : "");
      var body =
        "Name: " + name + "\n" +
        "Company: " + company + "\n" +
        "Reply email: " + email + "\n" +
        "Material of interest: " + material + "\n\n" +
        message + "\n";
      window.location.href =
        "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      var ok = form.querySelector("[data-form-status]");
      if (ok) ok.hidden = false;
    });
  }

  /* Lightbox for catalogue galleries: any container with [data-lightbox].
     Each child <a href="full.jpg"> opens full-size with prev/next/keyboard. */
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
        '<button class="lb__btn lb__prev" data-lb-prev aria-label="Previous page">‹</button>' +
        '<figure class="lb__stage"><img class="lb__img" alt=""><figcaption class="lb__cap"></figcaption></figure>' +
        '<button class="lb__btn lb__next" data-lb-next aria-label="Next page">›</button>';
      document.body.appendChild(overlay);
      imgEl = overlay.querySelector(".lb__img");
      capEl = overlay.querySelector(".lb__cap");
      overlay.addEventListener("click", function (e) {
        if (e.target.hasAttribute("data-lb-close")) close();
        else if (e.target.hasAttribute("data-lb-prev")) go(-1);
        else if (e.target.hasAttribute("data-lb-next")) go(1);
      });
    }
    function preload(i) { if (items[i]) { var im = new Image(); im.src = items[i].src; } }
    function show() {
      var it = items[idx];
      imgEl.src = it.src; imgEl.alt = it.alt;
      capEl.textContent = (idx + 1) + " / " + items.length;
      preload(idx + 1); preload(idx - 1);
    }
    function go(d) { idx = (idx + d + items.length) % items.length; show(); }
    function open(list, i) {
      items = list; idx = i;
      if (!overlay) build();
      show();
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function close() {
      if (!overlay) return;
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
    document.addEventListener("keydown", function (e) {
      if (!overlay || !overlay.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    });
    grids.forEach(function (grid) {
      var anchors = [].slice.call(grid.querySelectorAll("a"));
      var list = anchors.map(function (a) {
        var im = a.querySelector("img");
        return { src: a.getAttribute("href"), alt: im ? im.alt : "" };
      });
      anchors.forEach(function (a, i) {
        a.addEventListener("click", function (e) { e.preventDefault(); open(list, i); });
      });
    });
    var sx = 0;
    document.addEventListener("touchstart", function (e) {
      if (overlay && overlay.classList.contains("open")) sx = e.touches[0].clientX;
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!overlay || !overlay.classList.contains("open")) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();
})();
