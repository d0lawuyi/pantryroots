/* PantryRoots welcome — slide deck behaviour. Vanilla, no dependencies. */
(function () {
  "use strict";

  /*
   * Optional photographs, keyed by dish id (matches data-dish in the markup).
   * Only add a photo after checking its Wikimedia Commons "File:" page for the
   * dish, the author and a reuse licence (CC0, public domain, CC BY, CC BY-SA).
   * Each entry is shown over the dish illustration and credited in the footer.
   * If it fails to load, the illustration stays. Example shape:
   *
   * "party-jollof": {
   *   dish: "Jollof rice",
   *   file: "Example.jpg",                     // Commons file name
   *   thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/{w}px-Example.jpg",
   *   author: "Name",
   *   license: "CC BY-SA 4.0",
   *   licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/"
   * }
   */
  var PHOTOS = {};

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var dots = Array.prototype.slice.call(document.querySelectorAll(".dots a"));
  var current = 0;

  /* ── Media: fallbacks and optional photos ───────────────── */
  function markBroken(img) {
    var media = img.closest(".media");
    if (media) media.classList.add("is-broken");
  }
  document.querySelectorAll(".media__plate").forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) markBroken(img);
    img.addEventListener("error", function () { markBroken(img); });
  });

  document.querySelectorAll(".phone__screen img, .qr img").forEach(function (img) {
    var box = img.parentElement;
    function broken() { box.classList.add("is-broken"); }
    if (img.complete && img.naturalWidth === 0) broken();
    img.addEventListener("error", broken);
  });

  var credited = {};
  var creditList = document.querySelector(".credits");
  document.querySelectorAll(".media[data-dish]").forEach(function (media) {
    var p = PHOTOS[media.getAttribute("data-dish")];
    if (!p || !p.thumb) return;
    var big = media.classList.contains("hero__slide");
    var widths = big ? [960, 1600, 2400] : [400, 800];
    var img = document.createElement("img");
    img.className = "media__photo";
    img.alt = p.dish;
    img.decoding = "async";
    if (!(big && media.classList.contains("is-on"))) img.loading = "lazy";
    img.src = p.thumb.replace("{w}", widths[1]);
    img.srcset = widths.map(function (w) { return p.thumb.replace("{w}", w) + " " + w + "w"; }).join(", ");
    img.sizes = big ? "100vw" : "(min-width: 900px) 16vw, 33vw";
    img.addEventListener("load", function () { media.classList.add("has-photo"); });
    img.addEventListener("error", function () { img.remove(); media.classList.remove("has-photo"); });
    media.insertBefore(img, media.firstChild);

    if (creditList && !credited[p.file]) {
      credited[p.file] = true;
      var li = document.createElement("li");
      var page = "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(p.file.replace(/ /g, "_"));
      li.innerHTML = "";
      li.appendChild(document.createTextNode(p.dish + ", photo by " + p.author + ", "));
      var lic = document.createElement("a"); lic.href = p.licenseUrl; lic.textContent = p.license; lic.rel = "license noopener"; lic.target = "_blank";
      li.appendChild(lic);
      li.appendChild(document.createTextNode(", "));
      var src = document.createElement("a"); src.href = page; src.textContent = "Wikimedia Commons"; src.rel = "noopener"; src.target = "_blank";
      li.appendChild(src);
      creditList.appendChild(li);
      creditList.hidden = false;
    }
  });

  /* ── Navigation ─────────────────────────────────────────── */
  function behavior() { return reduceMotion.matches ? "auto" : "smooth"; }

  function goTo(index) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    slides[index].scrollIntoView({ behavior: behavior(), block: "start" });
  }

  function setCurrent(index) {
    current = index;
    dots.forEach(function (d, i) {
      if (i === index) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
  }

  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function (e) {
      e.preventDefault();
      goTo(i);
      history.replaceState(null, "", "#" + slides[i].id);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var target = document.getElementById(a.getAttribute("data-goto"));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: behavior(), block: "start" });
      var focusable = target.querySelector("h1, h2");
      if (focusable) { focusable.setAttribute("tabindex", "-1"); focusable.focus({ preventScroll: true }); }
    });
  });

  function atFooter() {
    var foot = document.querySelector(".foot");
    return foot && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
  }

  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    var key = e.key;
    var next = key === "ArrowDown" || key === "PageDown" || (key === " " && !e.shiftKey);
    var prev = key === "ArrowUp" || key === "PageUp" || (key === " " && e.shiftKey);
    // Let Space press buttons and links as usual.
    if (key === " " && (tag === "BUTTON" || tag === "A")) return;
    if (next) {
      e.preventDefault();
      if (current === slides.length - 1) {
        document.querySelector(".foot").scrollIntoView({ behavior: behavior(), block: "end" });
      } else goTo(current + 1);
    } else if (prev) {
      e.preventDefault();
      if (atFooter() && current === slides.length - 1) goTo(slides.length - 1);
      else goTo(current - 1);
    } else if (key === "Home") { e.preventDefault(); goTo(0); }
    else if (key === "End") { e.preventDefault(); goTo(slides.length - 1); }
  });

  /* ── Active slide: dots + entrance ──────────────────────── */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var i = slides.indexOf(entry.target);
        if (entry.isIntersecting) {
          entry.target.classList.add("is-active");
          setCurrent(i);
          if (i === 0) resumeHero(); else pauseHero(true);
        }
      });
    }, { threshold: 0.55 });
    slides.forEach(function (s) { io.observe(s); });
  } else {
    slides.forEach(function (s) { s.classList.add("is-active"); });
  }
  // Show the first slide immediately even before the observer fires.
  var start = Math.max(0, slides.findIndex(function (s) { return "#" + s.id === location.hash; }));
  slides[start].classList.add("is-active");
  setCurrent(start);

  /* ── Hero carousel ──────────────────────────────────────── */
  var hero = document.querySelector(".hero");
  var frames = Array.prototype.slice.call(document.querySelectorAll(".hero__slide"));
  var now = document.querySelector(".hero__now");
  var pauseBtn = document.querySelector(".hero__pause");
  var frame = 0;
  var timer = null;
  var userPaused = false;
  var hovering = false;
  var offscreen = false;
  var INTERVAL = 5000;

  function show(n) {
    frames[frame].classList.remove("is-on");
    frame = (n + frames.length) % frames.length;
    var f = frames[frame];
    // Restart the slow zoom on the incoming dish.
    var art = f.querySelectorAll(".media__plate, .media__photo");
    art.forEach(function (el) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
    f.classList.add("is-on");
    var plate = f.querySelector(".media__plate");
    if (plate && plate.loading === "lazy") plate.loading = "eager";
    if (now) now.textContent = f.getAttribute("data-label");
  }

  function canRun() { return !userPaused && !hovering && !offscreen && !document.hidden; }

  function tick() { show(frame + 1); }

  function sync() {
    var run = canRun();
    hero.classList.toggle("is-paused", !run);
    if (run && !timer) timer = setInterval(tick, INTERVAL);
    if (!run && timer) { clearInterval(timer); timer = null; }
  }
  function pauseHero(isOff) { offscreen = !!isOff; sync(); }
  function resumeHero() { offscreen = false; sync(); }

  // Warm the next frames so the crossfade never shows a blank plate.
  frames.forEach(function (f) { var p = f.querySelector(".media__plate"); if (p) p.loading = "eager"; });

  hero.addEventListener("mouseenter", function () { hovering = true; sync(); });
  hero.addEventListener("mouseleave", function () { hovering = false; sync(); });
  hero.addEventListener("focusin", function () { hovering = true; sync(); });
  hero.addEventListener("focusout", function (e) { if (!hero.contains(e.relatedTarget)) { hovering = false; sync(); } });
  document.addEventListener("visibilitychange", sync);
  if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", sync);

  if (pauseBtn) {
    pauseBtn.addEventListener("click", function () {
      userPaused = !userPaused;
      pauseBtn.setAttribute("aria-pressed", String(userPaused));
      pauseBtn.setAttribute("aria-label", userPaused ? "Play the dishes" : "Pause the dishes");
      sync();
    });
    if (reduceMotion.matches) {
      userPaused = true;
      pauseBtn.setAttribute("aria-pressed", "true");
      pauseBtn.setAttribute("aria-label", "Play the dishes");
    }
  }
  sync();
})();
