/* ============================================================
   BAHAREH HAJIZADEH — interactions
   Preloader, custom cursor, Lenis smooth scroll, GSAP scroll
   effects, project filters, project modal, mobile menu.
   Lenis + GSAP are CDN-loaded; all features degrade gracefully
   if they fail or if prefers-reduced-motion is set.
   ============================================================ */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ----------------------------------------------------------
     Preloader: count 0 → 100 while assets load, then slide away
     ---------------------------------------------------------- */
  const preloader = document.getElementById("preloader");
  const counter = document.getElementById("preloaderCounter");

  function finishPreloader() {
    if (!preloader || preloader.classList.contains("is-done")) return;
    counter.textContent = "100";
    preloader.classList.add("is-done");
    setTimeout(() => preloader.remove(), 1000);
  }

  if (preloader) {
    let progress = 0;
    const tick = setInterval(() => {
      progress = Math.min(progress + Math.random() * 14, 90);
      counter.textContent = String(Math.floor(progress));
      if (progress >= 90) clearInterval(tick);
    }, 110);

    window.addEventListener("load", () => {
      clearInterval(tick);
      finishPreloader();
    });
    setTimeout(finishPreloader, 4000);
  }

  /* ----------------------------------------------------------
     Custom cursor (pointer devices only)
     ---------------------------------------------------------- */
  const cursor = document.getElementById("cursor");
  const cursorDot = document.getElementById("cursorDot");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (cursor && cursorDot && finePointer && !prefersReducedMotion) {
    let mouseX = -100, mouseY = -100;
    let ringX = -100, ringY = -100;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    });

    (function followLoop() {
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;
      cursor.style.left = ringX + "px";
      cursor.style.top = ringY + "px";
      requestAnimationFrame(followLoop);
    })();

    document.addEventListener("mouseleave", () => cursor.classList.add("is-hidden"));
    document.addEventListener("mouseenter", () => cursor.classList.remove("is-hidden"));

    document.addEventListener("mouseover", (e) => {
      const labelled = e.target.closest("[data-cursor-label]");
      const interactive = e.target.closest("[data-cursor], a, button");
      if (labelled) {
        cursor.classList.add("is-label");
        cursor.textContent = labelled.dataset.cursorLabel;
      } else if (interactive) {
        cursor.classList.add("is-hover");
      }
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest("[data-cursor-label]")) {
        cursor.classList.remove("is-label");
        cursor.textContent = "";
      }
      if (e.target.closest("[data-cursor], a, button")) {
        cursor.classList.remove("is-hover");
      }
    });
  }

  /* ----------------------------------------------------------
     Lenis smooth scroll + GSAP scroll-driven effects
     All gated: only when libs are present AND motion is allowed.
     Degrades to native scroll + inline parallax if either fails.
     ---------------------------------------------------------- */
  let lenis = null;
  const header = document.getElementById("header");

  const useSmoothScroll =
    !prefersReducedMotion &&
    typeof Lenis !== "undefined" &&
    typeof gsap !== "undefined" &&
    typeof ScrollTrigger !== "undefined";

  if (useSmoothScroll) {
    lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    gsap.registerPlugin(ScrollTrigger);

    // Wire Lenis RAF into GSAP ticker (single RAF loop)
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Drive header .is-scrolled from Lenis scroll position
    lenis.on("scroll", ({ scroll }) => {
      if (header) header.classList.toggle("is-scrolled", scroll > 40);
    });

    // Hero image parallax scrub (reverses on scroll-up)
    const heroMedia = document.getElementById("heroMedia");
    if (heroMedia) {
      gsap.to(heroMedia, {
        yPercent: 20,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }

    // Quote band background parallax
    const quoteMedia = document.querySelector(".quote__media");
    if (quoteMedia) {
      gsap.to(quoteMedia, {
        yPercent: 14,
        ease: "none",
        scrollTrigger: {
          trigger: ".quote",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }

    // Route anchor clicks through Lenis for smooth landing
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (href === "#") return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target, { offset: -80, duration: 1.4 });
        }
      });
    });

  } else {
    // Fallback: native scroll for header state + hero parallax
    const heroMedia = document.getElementById("heroMedia");

    function onScroll() {
      const y = window.scrollY;
      if (header) header.classList.toggle("is-scrolled", y > 40);
      if (heroMedia && !prefersReducedMotion && y < window.innerHeight * 1.2) {
        heroMedia.style.transform = `translateY(${y * 0.22}px)`;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------
     Mobile menu
     ---------------------------------------------------------- */
  const burger = document.getElementById("burger");
  const mobileMenu = document.getElementById("mobileMenu");

  if (burger && mobileMenu) {
    function setMenu(open) {
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      mobileMenu.classList.toggle("is-open", open);
      mobileMenu.setAttribute("aria-hidden", String(!open));
      document.body.classList.toggle("modal-open", open);
      if (lenis) { open ? lenis.stop() : lenis.start(); }
    }

    burger.addEventListener("click", () =>
      setMenu(!mobileMenu.classList.contains("is-open"))
    );
    mobileMenu.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => setMenu(false))
    );
  }

  /* ----------------------------------------------------------
     Reveal on scroll (IntersectionObserver — one-shot entrance)
     ---------------------------------------------------------- */
  const revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const siblings = [...el.parentElement.children].filter(
            (s) => s.classList.contains("reveal") && !s.classList.contains("is-visible")
          );
          el.style.setProperty("--stagger", `${Math.min(siblings.indexOf(el), 5) * 0.08}s`);
          el.classList.add("is-visible");
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ----------------------------------------------------------
     Animated stat counters
     ---------------------------------------------------------- */
  const counters = document.querySelectorAll("[data-count]");

  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    if (prefersReducedMotion) {
      el.textContent = String(target);
      return;
    }
    const duration = 1400;
    const start = performance.now();
    (function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(frame);
    })(start);
  }

  if ("IntersectionObserver" in window) {
    const statsIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCount(entry.target);
          statsIO.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => statsIO.observe(el));
  } else {
    counters.forEach(animateCount);
  }

  /* ----------------------------------------------------------
     Project filters
     ---------------------------------------------------------- */
  const filterButtons = document.querySelectorAll(".filter");
  const projects = document.querySelectorAll(".project");

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const filter = btn.dataset.filter;

      projects.forEach((project) => {
        const show = filter === "all" || project.dataset.category === filter;
        project.classList.toggle("is-filtered", !show);
        if (show) {
          project.classList.remove("is-visible");
          requestAnimationFrame(() =>
            requestAnimationFrame(() => project.classList.add("is-visible"))
          );
        }
      });
    });
  });

  /* ----------------------------------------------------------
     Project modal
     ---------------------------------------------------------- */
  const modal = document.getElementById("modal");
  const modalImg = document.getElementById("modalImg");
  const fields = {
    kicker: document.getElementById("modalKicker"),
    title: document.getElementById("modalTitle"),
    desc: document.getElementById("modalDesc"),
    location: document.getElementById("modalLocation"),
    year: document.getElementById("modalYear"),
    area: document.getElementById("modalArea"),
    role: document.getElementById("modalRole"),
  };
  let lastFocused = null;

  const modalThumbs = document.getElementById("modalThumbs");

  function buildGallery(gallery, title) {
    if (!modalThumbs) return;
    modalThumbs.innerHTML = "";
    modalThumbs.style.display = gallery.length > 1 ? "" : "none";
    if (gallery.length <= 1) return;
    gallery.forEach((src, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "modal__thumb" + (i === 0 ? " is-active" : "");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", `${title} — image ${i + 1} of ${gallery.length}`);
      const im = document.createElement("img");
      im.src = src;
      im.alt = "";
      im.loading = "lazy";
      b.appendChild(im);
      b.addEventListener("click", () => {
        modalImg.src = src;
        modalThumbs.querySelectorAll(".modal__thumb").forEach((t) => t.classList.remove("is-active"));
        b.classList.add("is-active");
      });
      modalThumbs.appendChild(b);
    });
  }

  function openModal(project) {
    const d = project.dataset;
    const img = project.querySelector("img");

    const gallery = (d.gallery ? d.gallery.split(",") : [img.src])
      .map((s) => s.trim())
      .filter(Boolean);
    modalImg.src = gallery[0];
    modalImg.alt = d.title;
    buildGallery(gallery, d.title);
    if (modalThumbs) modalThumbs.scrollLeft = 0;
    fields.kicker.textContent = `${capitalize(d.category)} — ${d.year}`;
    fields.title.textContent = d.title;
    fields.desc.textContent = d.desc;
    fields.location.textContent = d.location;
    fields.year.textContent = d.year;
    fields.area.textContent = d.area;
    fields.role.textContent = d.role;

    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    modal.querySelector(".modal__close").focus();
    if (lenis) lenis.stop();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocused) lastFocused.focus();
    if (lenis) lenis.start();
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  if (modal) {
    projects.forEach((project) => {
      project.addEventListener("click", () => openModal(project));
      project.setAttribute("tabindex", "0");
      project.setAttribute("role", "button");
      project.setAttribute("aria-label", `Open project: ${project.dataset.title}`);
      project.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(project);
        }
      });
    });

    modal.querySelectorAll("[data-close]").forEach((el) =>
      el.addEventListener("click", closeModal)
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    });
  }

  /* ----------------------------------------------------------
     Contact form — AJAX via FormSubmit, falls back to POST
     ---------------------------------------------------------- */
  const form = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector(".contact-form__submit");
      submitBtn.disabled = true;
      formStatus.textContent = "Sending…";

      try {
        const res = await fetch(
          form.action.replace("formsubmit.co/", "formsubmit.co/ajax/"),
          {
            method: "POST",
            headers: { Accept: "application/json" },
            body: new FormData(form),
          }
        );
        if (!res.ok) throw new Error("Request failed");
        form.reset();
        formStatus.textContent = "Thank you — your message is on its way.";
      } catch {
        form.submit();
        return;
      }
      submitBtn.disabled = false;
    });
  }

  /* ----------------------------------------------------------
     Testimonials slider — auto-advances, pauses on hover
     ---------------------------------------------------------- */
  const track = document.getElementById("testiTrack");

  if (track) {
    const slides = track.children.length;
    const nowEl = document.getElementById("testiNow");
    const totalEl = document.getElementById("testiTotal");
    let index = 0;
    let timer = null;

    totalEl.textContent = String(slides).padStart(2, "0");

    function goTo(i) {
      index = (i + slides) % slides;
      track.style.transform = `translateX(-${index * 100}%)`;
      nowEl.textContent = String(index + 1).padStart(2, "0");
    }

    function startAuto() {
      if (prefersReducedMotion) return;
      stopAuto();
      timer = setInterval(() => goTo(index + 1), 6500);
    }
    function stopAuto() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    document.getElementById("testiPrev").addEventListener("click", () => {
      goTo(index - 1);
      startAuto();
    });
    document.getElementById("testiNext").addEventListener("click", () => {
      goTo(index + 1);
      startAuto();
    });

    const testiSection = document.getElementById("clients");
    testiSection.addEventListener("mouseenter", stopAuto);
    testiSection.addEventListener("mouseleave", startAuto);

    startAuto();
  }
})();
