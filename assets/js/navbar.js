/* Siddharth's CTF Writeups — primary navigation drawer
   Vanilla JS: open/close, Escape to close, outside click to close,
   basic focus handling, and the "Writeups" accordion section. */

(function () {
  "use strict";

  var drawer, backdrop, openBtn, closeBtn, accordionBtn, submenu, lastFocused;

  function getEls() {
    drawer = document.getElementById("ctf-drawer");
    backdrop = document.querySelector("[data-ctf-drawer-backdrop]");
    openBtn = document.querySelector("[data-ctf-drawer-open]");
    closeBtn = document.querySelector("[data-ctf-drawer-close]");
    accordionBtn = document.querySelector("[data-ctf-drawer-accordion]");
    submenu = accordionBtn
      ? document.getElementById(accordionBtn.getAttribute("aria-controls"))
      : null;
  }

  function openDrawer() {
    if (!drawer) return;
    lastFocused = document.activeElement;

    drawer.hidden = false;
    backdrop.hidden = false;

    // Allow the browser to paint the unhidden state before animating in.
    requestAnimationFrame(function () {
      drawer.classList.add("is-open");
      backdrop.classList.add("is-open");
    });

    openBtn && openBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("ctf-no-scroll");

    var firstLink = drawer.querySelector("a, button");
    if (firstLink) firstLink.focus();

    document.addEventListener("keydown", onKeydown);
  }

  function closeDrawer() {
    if (!drawer || drawer.hidden) return;

    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    openBtn && openBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("ctf-no-scroll");
    document.removeEventListener("keydown", onKeydown);

    window.setTimeout(function () {
      drawer.hidden = true;
      backdrop.hidden = true;
    }, 260);

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      closeDrawer();
      return;
    }

    // Minimal focus trap: keep Tab cycling within the drawer while open.
    if (e.key === "Tab" && drawer && drawer.classList.contains("is-open")) {
      var focusable = drawer.querySelectorAll(
        "a[href], button:not([disabled])"
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function toggleAccordion() {
    if (!accordionBtn || !submenu) return;
    var expanded = accordionBtn.getAttribute("aria-expanded") === "true";
    accordionBtn.setAttribute("aria-expanded", String(!expanded));
    submenu.hidden = expanded;
  }

  function init() {
    getEls();
    if (!drawer) return;
    if (drawer.dataset.ctfBound === "true") return;
    drawer.dataset.ctfBound = "true";

    openBtn && openBtn.addEventListener("click", openDrawer);
    closeBtn && closeBtn.addEventListener("click", closeDrawer);
    backdrop && backdrop.addEventListener("click", closeDrawer);
    accordionBtn && accordionBtn.addEventListener("click", toggleAccordion);

    // Close when a nav link inside the drawer is followed (same-page anchors
    // included) so the drawer doesn't stay open after navigation on SPA-like
    // instant loading.
    drawer.addEventListener("click", function (e) {
      var link = e.target.closest("a");
      if (link) closeDrawer();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // MkDocs Material instant-navigation support: re-bind after page swaps.
  if (window.document$) {
    window.document$.subscribe(init);
  }
})();
