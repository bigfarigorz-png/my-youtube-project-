/* ADONIS CO — stone catalogue: filtering, detail view, enquiry tray.
   No dependencies, no inline handlers (CSP-safe: script-src 'self'). */
(function () {
  "use strict";
  var STONES = window.STONES || [];
  var grid = document.querySelector("[data-stone-grid]");
  if (!grid) return;

  var bar = document.querySelector("[data-filter-bar]");
  var countEl = document.querySelector("[data-stone-count]");
  var searchEl = document.querySelector("[data-stone-search]");
  var sortEl = document.querySelector("[data-stone-sort]");

  var USE_KEYS = ["Kitchen", "Bathroom", "Flooring", "Walls", "Outdoor", "High-traffic"];
  var SUIT_LABELS = ["Not advised", "With care", "Good", "Ideal"];
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var FACETS = [
    { key: "type",   label: "Material", get: function (s) { return [s.type]; } },
    { key: "colour", label: "Colour",   get: function (s) { return [cap(s.colour)]; } },
    { key: "finish", label: "Finish",   get: function (s) { return s.finishes; } },
    { key: "use",    label: "Good for", values: ["Kitchen", "Bathroom", "Flooring", "Walls", "Outdoor"], match: function (s, v) { return s.suit[v] >= 2; } }
  ];
  var filters = { type: new Set(), colour: new Set(), finish: new Set(), use: new Set() };
  var search = "", sort = "featured";

  /* ---------- small renderers ---------- */
  function dots(score) {
    var h = '<span class="dots" aria-hidden="true">';
    for (var i = 0; i < 3; i++) h += '<i class="dot' + (i < score ? " on" : "") + '"></i>';
    return h + "</span>";
  }
  function stars(n) {
    var h = '<span class="stars" aria-label="Value ' + n + ' of 5">';
    for (var i = 0; i < 5; i++) h += '<i class="star' + (i < n ? " on" : "") + '">★</i>';
    return h + "</span>";
  }

  /* ---------- cards ---------- */
  function cardHTML(s) {
    return '<article class="scard reveal" data-slug="' + s.slug + '" tabindex="0" role="button" aria-label="' + esc(s.name) + ' — open details">' +
      '<div class="scard__media"><img loading="lazy" src="' + s.card + '" alt="' + esc(s.name) + ' slab">' +
        '<span class="scard__type">' + esc(s.type) + '</span>' +
        (s.acid === "resistant" ? '<span class="scard__badge">Acid &amp; heat proof</span>' : "") +
      "</div>" +
      '<div class="scard__body">' +
        '<h3 class="scard__name">' + esc(s.name) + "</h3>" +
        '<p class="scard__tag">' + esc(s.tagline) + "</p>" +
        '<div class="scard__meta"><span class="scard__fin">' + esc(s.finishes.join(" · ")) + "</span>" + stars(s.value) + "</div>" +
      "</div></article>";
  }

  function passes(s) {
    for (var i = 0; i < FACETS.length; i++) {
      var f = FACETS[i], sel = filters[f.key];
      if (!sel.size) continue;
      var ok;
      if (f.match) { ok = false; sel.forEach(function (v) { if (f.match(s, v)) ok = true; }); }
      else { var vals = f.get(s); ok = vals.some(function (v) { return sel.has(v); }); }
      if (!ok) return false;
    }
    if (search) {
      var hay = (s.name + " " + s.type + " " + s.colours.join(" ") + " " + s.tagline).toLowerCase();
      if (hay.indexOf(search) < 0) return false;
    }
    return true;
  }
  function sorted(list) {
    var a = list.slice();
    if (sort === "durable") a.sort(function (x, y) { return score(y) - score(x); });
    else if (sort === "value-desc") a.sort(function (x, y) { return y.value - x.value; });
    else if (sort === "value-asc") a.sort(function (x, y) { return x.value - y.value; });
    else if (sort === "az") a.sort(function (x, y) { return x.name.localeCompare(y.name); });
    return a;
    function score(s) { return s.suit.Kitchen + s.suit["High-traffic"] + (s.acid === "resistant" ? 3 : 0); }
  }
  function render() {
    var list = sorted(STONES.filter(passes));
    grid.innerHTML = list.length ? list.map(cardHTML).join("") :
      '<p class="stone-empty">No slabs match those filters. <button class="linkbtn" data-clear>Clear filters</button></p>';
    if (countEl) countEl.textContent = list.length + (list.length === 1 ? " stone" : " stones");
    requestAnimationFrame(function () { grid.querySelectorAll(".reveal").forEach(function (el, i) { setTimeout(function () { el.classList.add("in"); }, Math.min(i, 8) * 40); }); });
  }

  /* ---------- filter bar ---------- */
  function buildBar() {
    if (!bar) return;
    var html = "";
    FACETS.forEach(function (f) {
      var values = f.values;
      if (!values) {
        var set = {};
        STONES.forEach(function (s) { f.get(s).forEach(function (v) { set[v] = 1; }); });
        values = Object.keys(set);
      }
      html += '<div class="facet"><span class="facet__label">' + f.label + "</span><div class=\"facet__chips\">";
      values.forEach(function (v) {
        html += '<button class="chipf" data-facet="' + f.key + '" data-val="' + esc(v) + '">' + esc(v) + "</button>";
      });
      html += "</div></div>";
    });
    bar.innerHTML = html;
  }

  /* ---------- detail modal ---------- */
  var modal;
  function buildModal() {
    modal = document.createElement("div");
    modal.className = "sheet";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = '<div class="sheet__backdrop" data-close></div><div class="sheet__panel" role="dialog" aria-modal="true" aria-label="Stone details"><button class="sheet__x" data-close aria-label="Close">×</button><div class="sheet__scroll" data-sheet-body></div></div>';
    document.body.appendChild(modal);
  }
  function specRows(s) {
    return Object.keys(s.specs).map(function (k) {
      return '<div class="spec2__row"><span class="spec2__k">' + esc(k) + '</span><span class="spec2__v">' + esc(s.specs[k]) + "</span></div>";
    }).join("");
  }
  function suitRows(s) {
    return USE_KEYS.map(function (k) {
      var v = s.suit[k];
      return '<div class="suit__row"><span class="suit__k">' + esc(k) + "</span>" + dots(v) + '<span class="suit__lab">' + SUIT_LABELS[v] + "</span></div>";
    }).join("");
  }
  function inEnquiry(slug) { return getCart().indexOf(slug) >= 0; }
  function detailHTML(s) {
    var acidNote = s.acid === "resistant"
      ? '<span class="acidtag acidtag--ok">Acid &amp; heat resistant — kitchen-safe</span>'
      : '<span class="acidtag acidtag--warn">Acid-sensitive — etches with citrus &amp; wine</span>';
    return '<div class="sheet__media"><img src="' + s.full + '" alt="' + esc(s.name) + ' slab"></div>' +
      '<div class="sheet__head"><span class="eyebrow">' + esc(s.type) + " · " + esc(s.origin) + '</span>' +
        '<h2 class="h2">' + esc(s.name) + "</h2>" +
        '<p class="sheet__tag">' + esc(s.tagline) + "</p>" +
        '<div class="sheet__rate">' + stars(s.value) + '<span class="sheet__ratelab">Value &amp; prestige</span></div>' +
        "<p class=\"sheet__story\">" + esc(s.story) + "</p>" + acidNote + "</div>" +
      '<div class="sheet__cols">' +
        '<section class="sheet__block"><h4 class="sheet__h">Specification</h4><div class="spec2">' + specRows(s) + "</div></section>" +
        '<section class="sheet__block"><h4 class="sheet__h">Where you can use it</h4><div class="suit">' + suitRows(s) + "</div></section>" +
      "</div>" +
      '<section class="sheet__block"><h4 class="sheet__h">Care &amp; advice</h4><ul class="carelist">' + s.care.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></section>" +
      '<section class="sheet__block sheet__uses"><h4 class="sheet__h">Best used for</h4><p>' + esc(s.uses) + "</p></section>" +
      '<div class="sheet__actions">' +
        '<button class="btn btn--amber" data-add="' + s.slug + '">' + (inEnquiry(s.slug) ? "✓ In your enquiry" : "Add to enquiry") + "</button>" +
        '<a class="btn btn--ghost" href="' + mailtoFor(s) + '">Request this slab</a>' +
      "</div>";
  }
  function mailtoFor(s) {
    var subj = "Slab enquiry — " + s.name;
    var body = "I'd like to enquire about " + s.name + " (" + s.type + ").\n\nApprox quantity (m² or slabs):\nFinish:\nDelivery to (city):\n\nName:\nPhone / WhatsApp:";
    return "mailto:info@adonisco.am?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
  }
  function openSheet(slug) {
    var s = STONES.filter(function (x) { return x.slug === slug; })[0];
    if (!s) return;
    if (!modal) buildModal();
    modal.querySelector("[data-sheet-body]").innerHTML = detailHTML(s);
    modal.querySelector("[data-sheet-body]").scrollTop = 0;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /* ---------- enquiry tray (localStorage) ---------- */
  function getCart() { try { return JSON.parse(localStorage.getItem("adonis_enquiry") || "[]"); } catch (e) { return []; } }
  function setCart(a) { localStorage.setItem("adonis_enquiry", JSON.stringify(a)); paintTray(); }
  function toggleCart(slug) {
    var a = getCart(), i = a.indexOf(slug);
    if (i >= 0) a.splice(i, 1); else a.push(slug);
    setCart(a);
  }
  var tray, trayPanel;
  function buildTray() {
    tray = document.createElement("div");
    tray.className = "tray";
    tray.innerHTML = '<button class="tray__fab" data-tray-toggle aria-label="Open enquiry list"><span class="tray__count">0</span> Enquiry</button>' +
      '<div class="tray__panel" hidden><h4>Your enquiry</h4><div class="tray__items" data-tray-items></div>' +
      '<a class="btn btn--amber tray__send" data-tray-send href="#">Send enquiry →</a></div>';
    document.body.appendChild(tray);
    trayPanel = tray.querySelector(".tray__panel");
  }
  function paintTray() {
    if (!tray) buildTray();
    var a = getCart();
    tray.querySelector(".tray__count").textContent = a.length;
    tray.classList.toggle("has", a.length > 0);
    var items = a.map(function (slug) {
      var s = STONES.filter(function (x) { return x.slug === slug; })[0];
      return s ? '<div class="tray__row"><span>' + esc(s.name) + '</span><button class="tray__rm" data-rm="' + slug + '" aria-label="Remove">×</button></div>' : "";
    }).join("");
    tray.querySelector("[data-tray-items]").innerHTML = items || '<p class="tray__empty">No slabs yet. Tap “Add to enquiry” on any stone.</p>';
    var names = a.map(function (slug) { var s = STONES.filter(function (x) { return x.slug === slug; })[0]; return s ? s.name : ""; }).filter(Boolean);
    var body = "I'd like a quote on these slabs, delivered to Yerevan:\n\n• " + names.join("\n• ") + "\n\nApprox quantity each:\nName:\nPhone / WhatsApp:";
    tray.querySelector("[data-tray-send]").setAttribute("href", names.length ? "mailto:info@adonisco.am?subject=" + encodeURIComponent("Slab enquiry — " + names.length + " stones") + "&body=" + encodeURIComponent(body) : "#");
    // refresh any open modal button label
    if (modal && modal.classList.contains("open")) {
      modal.querySelectorAll("[data-add]").forEach(function (b) {
        var inIt = inEnquiry(b.getAttribute("data-add"));
        b.textContent = inIt ? "✓ In your enquiry" : "Add to enquiry";
        b.classList.toggle("is-in", inIt);
      });
    }
  }

  /* ---------- events (delegated) ---------- */
  bar && bar.addEventListener("click", function (e) {
    var b = e.target.closest(".chipf"); if (!b) return;
    var set = filters[b.getAttribute("data-facet")], v = b.getAttribute("data-val");
    if (set.has(v)) set.delete(v); else set.add(v);
    b.classList.toggle("on");
    render();
  });
  grid.addEventListener("click", function (e) {
    if (e.target.closest("[data-clear]")) { clearAll(); return; }
    var c = e.target.closest(".scard"); if (c) openSheet(c.getAttribute("data-slug"));
  });
  grid.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("scard")) { e.preventDefault(); openSheet(e.target.getAttribute("data-slug")); }
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) closeSheet();
    var add = e.target.closest("[data-add]"); if (add) { toggleCart(add.getAttribute("data-add")); }
    var tog = e.target.closest("[data-tray-toggle]"); if (tog) { trayPanel.hidden = !trayPanel.hidden; }
    var rm = e.target.closest("[data-rm]"); if (rm) { toggleCart(rm.getAttribute("data-rm")); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  searchEl && searchEl.addEventListener("input", function () { search = this.value.trim().toLowerCase(); render(); });
  sortEl && sortEl.addEventListener("change", function () { sort = this.value; render(); });
  function clearAll() {
    Object.keys(filters).forEach(function (k) { filters[k].clear(); });
    if (bar) bar.querySelectorAll(".chipf.on").forEach(function (b) { b.classList.remove("on"); });
    if (searchEl) searchEl.value = ""; search = "";
    render();
  }

  /* ---------- go ---------- */
  buildBar();
  paintTray();
  render();
})();
