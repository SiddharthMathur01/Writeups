/* Siddharth's CTF Writeups — interaction layer
   Kept deliberately small: scroll reveals, counting stats, button ripple. */

(function () {
  "use strict";

  function initRevealOnScroll() {
    var targets = document.querySelectorAll(".ctf-reveal-on-scroll");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    var duration = 1200;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }
    window.requestAnimationFrame(step);
  }

  function initStatCounters() {
    var stats = document.querySelectorAll("[data-count]");
    if (!stats.length) return;

    if (!("IntersectionObserver" in window)) {
      stats.forEach(countUp);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            countUp(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    stats.forEach(function (el) { observer.observe(el); });
  }

  function initButtonRipple() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".ctf-btn");
      if (!btn) return;

      var rect = btn.getBoundingClientRect();
      var ripple = document.createElement("span");
      var size = Math.max(rect.width, rect.height);

      ripple.className = "ctf-btn__ripple";
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
      ripple.style.top = (e.clientY - rect.top - size / 2) + "px";

      btn.appendChild(ripple);
      window.setTimeout(function () { ripple.remove(); }, 650);
    });
  }

  function init() {
    initRevealOnScroll();
    initStatCounters();
    initButtonRipple();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // MkDocs Material instant-navigation support
  if (window.document$) {
    window.document$.subscribe(init);
  }
})();
