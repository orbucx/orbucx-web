/* Orbucx — script.js */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Sticky nav shadow */
  var nav = document.getElementById("nav");
  var onScroll = function () {
    nav.classList.toggle("scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile hamburger */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  toggle.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", function (e) {
    if (e.target.tagName === "A" && !e.target.classList.contains("nav-dropdown-toggle")) {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  /* Mobile dropdown toggle */
  var dropdownToggles = document.querySelectorAll(".nav-dropdown-toggle");
  dropdownToggles.forEach(function (dt) {
    dt.addEventListener("click", function (e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        var parent = dt.closest(".nav-dropdown");
        parent.classList.toggle("open");
        // Close other dropdowns
        document.querySelectorAll(".nav-dropdown").forEach(function (other) {
          if (other !== parent) other.classList.remove("open");
        });
      }
    });
  });

  /* Scroll reveal */
  var revealEls = document.querySelectorAll(".reveal");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* Stat counters */
  function animateCounter(el) {
    var target = parseFloat(el.dataset.target);
    var decimals = (el.dataset.target.split(".")[1] || "").length;
    if (prefersReduced) { el.textContent = el.dataset.target; return; }
    var duration = 1600;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = el.dataset.target;
    }
    requestAnimationFrame(step);
  }

  var counters = document.querySelectorAll(".counter");
  if ("IntersectionObserver" in window && !prefersReduced) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.dataset.target; });
  }

  /* FAQ: close others when one opens */
  var faqs = document.querySelectorAll(".faq-item");
  faqs.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) {
        faqs.forEach(function (other) {
          if (other !== d) other.open = false;
        });
      }
    });
  });

  /* Footer year */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* Blog Carousel */
  var carousel = document.querySelector(".blog-carousel");
  var btnLeft = document.querySelector(".carousel-btn-left");
  var btnRight = document.querySelector(".carousel-btn-right");
  if (carousel && btnLeft && btnRight) {
    var scrollAmount = 320;
    btnLeft.addEventListener("click", function () {
      carousel.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });
    btnRight.addEventListener("click", function () {
      carousel.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
  }
})();
