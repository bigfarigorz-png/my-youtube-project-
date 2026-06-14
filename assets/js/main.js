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
})();
