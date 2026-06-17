/* ADONIS CO — Veronzo tile catalogue: filtering + detail drawer + enquiry.
   Reuses the stone-catalogue CSS classes. No inline handlers (CSP-safe). */
(function () {
  "use strict";
  var TILES = window.VERONZO || [];
  var grid = document.querySelector("[data-tile-grid]");
  if (!grid) return;
  var bar = document.querySelector("[data-tile-bar]");
  var countEl = document.querySelector("[data-tile-count]");
  var searchEl = document.querySelector("[data-tile-search]");
  var sortEl = document.querySelector("[data-tile-sort]");

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function area(f) { var m = /(\d+)\D+(\d+)/.exec(f); return m ? (+m[1] * +m[2]) : 0; }

  var FACETS = [
    { key: "look",   label: "Look",   get: function (s) { return [s.look]; } },
    { key: "colour", label: "Colour", get: function (s) { return [s.colour]; } },
    { key: "format", label: "Format", get: function (s) { return [s.format]; } }
  ];
  var filters = { look: new Set(), colour: new Set(), format: new Set() };
  var search = "", sort = "featured";

  function cardHTML(s) {
    return '<article class="scard reveal" data-slug="' + s.slug + '" tabindex="0" role="button" aria-label="' + esc(s.name) + ' — open details">' +
      '<div class="scard__media"><img loading="lazy" src="' + s.tex + '" alt="' + esc(s.name) + ' porcelain texture">' +
        '<span class="scard__type">' + esc(s.look) + " look</span>" +
      "</div>" +
      '<div class="scard__body">' +
        '<h3 class="scard__name">' + esc(s.name) + "</h3>" +
        '<p class="scard__tag">' + esc(s.blurb) + "</p>" +
        '<div class="scard__meta"><span class="scard__fin">' + esc(s.colour) + " · " + esc(s.finish) + '</span><span class="scard__fmt">' + esc(s.format) + "</span></div>" +
      "</div></article>";
  }
  function passes(s) {
    for (var i = 0; i < FACETS.length; i++) {
      var f = FACETS[i], sel = filters[f.key];
      if (!sel.size) continue;
      if (!f.get(s).some(function (v) { return sel.has(v); })) return false;
    }
    if (search) {
      var hay = (s.name + " " + s.look + " " + s.colour + " " + s.format + " " + s.blurb).toLowerCase();
      if (hay.indexOf(search) < 0) return false;
    }
    return true;
  }
  function sorted(list) {
    var a = list.slice();
    if (sort === "az") a.sort(function (x, y) { return x.name.localeCompare(y.name); });
    else if (sort === "format") a.sort(function (x, y) { return area(y.format) - area(x.format); });
    return a;
  }
  function render() {
    var list = sorted(TILES.filter(passes));
    grid.innerHTML = list.length ? list.map(cardHTML).join("") :
      '<p class="stone-empty">No tiles match those filters. <button class="linkbtn" data-tclear>Clear filters</button></p>';
    if (countEl) countEl.textContent = list.length + (list.length === 1 ? " design" : " designs");
    requestAnimationFrame(function () { grid.querySelectorAll(".reveal").forEach(function (el, i) { setTimeout(function () { el.classList.add("in"); }, Math.min(i, 8) * 40); }); });
  }
  function buildBar() {
    if (!bar) return;
    var html = "";
    FACETS.forEach(function (f) {
      var set = {}; TILES.forEach(function (s) { f.get(s).forEach(function (v) { set[v] = 1; }); });
      html += '<div class="facet"><span class="facet__label">' + f.label + '</span><div class="facet__chips">';
      Object.keys(set).forEach(function (v) { html += '<button class="chipf" data-facet="' + f.key + '" data-val="' + esc(v) + '">' + esc(v) + "</button>"; });
      html += "</div></div>";
    });
    bar.innerHTML = html;
  }

  /* ---- detail drawer ---- */
  var modal;
  function buildModal() {
    modal = document.createElement("div");
    modal.className = "sheet";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = '<div class="sheet__backdrop" data-tclose></div><div class="sheet__panel" role="dialog" aria-modal="true" aria-label="Tile details"><button class="sheet__x" data-tclose aria-label="Close">×</button><div class="sheet__scroll" data-tbody></div></div>';
    document.body.appendChild(modal);
  }
  function chips(arr, cls) { return '<div class="chips">' + arr.map(function (c) { return '<span class="chip ' + (cls || "") + '">' + esc(c) + "</span>"; }).join("") + "</div>"; }
  function detailHTML(s) {
    var outdoor = (s.look === "Stone" || /20/.test(s.thickness));
    var useFor = ["Floors", "Walls", "Kitchens", "Bathrooms", "Commercial"];
    if (outdoor) useFor.push("Outdoors");
    var specs = { Code: s.code, Format: s.format + " cm", Finish: s.finish, Thickness: s.thickness, Body: "Porcelain", Look: s.look + " look", Colour: s.colour };
    var rows = Object.keys(specs).map(function (k) { return specs[k] ? '<div class="spec2__row"><span class="spec2__k">' + k + '</span><span class="spec2__v">' + esc(specs[k]) + "</span></div>" : ""; }).join("");
    return '<div class="sheet__media"><img src="' + s.tex + '" alt="' + esc(s.name) + ' porcelain texture"></div>' +
      '<div class="sheet__head"><span class="eyebrow">Veronzo · ' + esc(s.look) + " look</span>" +
        '<h2 class="h2">' + esc(s.name) + "</h2>" +
        '<p class="sheet__tag">' + esc(s.blurb) + "</p>" +
        '<span class="acidtag acidtag--ok">Porcelain — resists acid, scratches, heat &amp; frost</span></div>' +
      '<figure class="sheet__scene"><img loading="lazy" src="' + s.scene + '" alt="' + esc(s.name) + ' in a project"><figcaption>Seen in a project</figcaption></figure>' +
      '<section class="sheet__block"><h4 class="sheet__h">Specification</h4><div class="spec2">' + rows + "</div></section>" +
      '<section class="sheet__block"><h4 class="sheet__h">Resists</h4>' + chips(["Acid", "Scratches", "Heat", "Frost", "Water"], "chip--ok") + "</section>" +
      '<section class="sheet__block"><h4 class="sheet__h">Suitable for</h4>' + chips(useFor) + "</section>" +
      '<section class="sheet__block sheet__uses"><h4 class="sheet__h">Best used for</h4><p>' + esc(s.uses) + "</p></section>" +
      '<div class="sheet__actions">' +
        '<button class="btn btn--amber" data-tadd="' + s.slug + '">' + (inCart(s.slug) ? "✓ In your enquiry" : "Add to enquiry") + "</button>" +
        '<a class="btn btn--ghost" href="' + mailtoFor(s) + '">Request this tile</a>' +
      "</div>";
  }
  function mailtoFor(s) {
    var subj = "Veronzo tile enquiry — " + s.name + " (" + s.code + ")";
    var body = "I'd like to enquire about the Veronzo " + s.name + " porcelain.\n\nCode: " + s.code + "\nFormat: " + s.format + " cm\nFinish: " + s.finish + "\n\nApprox area (m2):\nDelivery to (city):\n\nName:\nPhone / WhatsApp:";
    return "mailto:info@adonisco.am?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
  }
  function openSheet(slug) {
    var s = TILES.filter(function (x) { return x.slug === slug; })[0]; if (!s) return;
    if (!modal) buildModal();
    var body = modal.querySelector("[data-tbody]"); body.innerHTML = detailHTML(s); body.scrollTop = 0;
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
  }
  function closeSheet() { if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; } }

  /* ---- enquiry tray ---- */
  function getCart() { try { return JSON.parse(localStorage.getItem("adonis_tiles") || "[]"); } catch (e) { return []; } }
  function setCart(a) { localStorage.setItem("adonis_tiles", JSON.stringify(a)); paintTray(); }
  function inCart(slug) { return getCart().indexOf(slug) >= 0; }
  function toggleCart(slug) { var a = getCart(), i = a.indexOf(slug); if (i >= 0) a.splice(i, 1); else a.push(slug); setCart(a); }
  var tray;
  function buildTray() {
    tray = document.createElement("div"); tray.className = "tray";
    tray.innerHTML = '<button class="tray__fab" data-ttoggle aria-label="Open enquiry list"><span class="tray__count">0</span> Enquiry</button>' +
      '<div class="tray__panel" hidden><h4>Your tile enquiry</h4><div class="tray__items" data-titems></div><a class="btn btn--amber tray__send" data-tsend href="#">Send enquiry →</a></div>';
    document.body.appendChild(tray);
  }
  function paintTray() {
    if (!tray) buildTray();
    var a = getCart();
    tray.querySelector(".tray__count").textContent = a.length;
    tray.classList.toggle("has", a.length > 0);
    tray.querySelector("[data-titems]").innerHTML = a.length ? a.map(function (slug) {
      var s = TILES.filter(function (x) { return x.slug === slug; })[0];
      return s ? '<div class="tray__row"><span>' + esc(s.name) + '</span><button class="tray__rm" data-trm="' + slug + '" aria-label="Remove">×</button></div>' : "";
    }).join("") : '<p class="tray__empty">No tiles yet. Tap “Add to enquiry” on any design.</p>';
    var names = a.map(function (slug) { var s = TILES.filter(function (x) { return x.slug === slug; })[0]; return s ? s.name + " (" + s.code + ")" : ""; }).filter(Boolean);
    var body = "I'd like a quote on these Veronzo tiles, delivered to Yerevan:\n\n• " + names.join("\n• ") + "\n\nApprox area each (m2):\nName:\nPhone / WhatsApp:";
    tray.querySelector("[data-tsend]").setAttribute("href", names.length ? "mailto:info@adonisco.am?subject=" + encodeURIComponent("Veronzo enquiry — " + names.length + " designs") + "&body=" + encodeURIComponent(body) : "#");
    if (modal && modal.classList.contains("open")) modal.querySelectorAll("[data-tadd]").forEach(function (b) {
      var i = inCart(b.getAttribute("data-tadd")); b.textContent = i ? "✓ In your enquiry" : "Add to enquiry"; b.classList.toggle("is-in", i);
    });
  }

  /* ---- events ---- */
  bar && bar.addEventListener("click", function (e) {
    var b = e.target.closest(".chipf"); if (!b) return;
    var set = filters[b.getAttribute("data-facet")], v = b.getAttribute("data-val");
    if (set.has(v)) set.delete(v); else set.add(v); b.classList.toggle("on"); render();
  });
  grid.addEventListener("click", function (e) {
    if (e.target.closest("[data-tclear]")) { clearAll(); return; }
    var c = e.target.closest(".scard"); if (c) openSheet(c.getAttribute("data-slug"));
  });
  grid.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("scard")) { e.preventDefault(); openSheet(e.target.getAttribute("data-slug")); }
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-tclose]")) closeSheet();
    var add = e.target.closest("[data-tadd]"); if (add) toggleCart(add.getAttribute("data-tadd"));
    if (e.target.closest("[data-ttoggle]")) { var p = tray.querySelector(".tray__panel"); p.hidden = !p.hidden; }
    var rm = e.target.closest("[data-trm]"); if (rm) toggleCart(rm.getAttribute("data-trm"));
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  searchEl && searchEl.addEventListener("input", function () { search = this.value.trim().toLowerCase(); render(); });
  sortEl && sortEl.addEventListener("change", function () { sort = this.value; render(); });
  function clearAll() {
    Object.keys(filters).forEach(function (k) { filters[k].clear(); });
    if (bar) bar.querySelectorAll(".chipf.on").forEach(function (b) { b.classList.remove("on"); });
    if (searchEl) searchEl.value = ""; search = ""; render();
  }

  buildBar(); paintTray(); render();
})();
