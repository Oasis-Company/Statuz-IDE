/**
 * Statuz IDE — GitHub Pages
 * Swiss Style · Black & White · Minimalist
 *
 * Minimal interactivity: smooth scroll, intersection observer for
 * status bar animations, and mobile navigation support.
 */

(function () {
  'use strict';

  /* ----------------------------------------------------------
   * Smooth scroll for anchor links
   * ---------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ----------------------------------------------------------
   * Intersection Observer: animate phase progress bars when
   * they enter the viewport
   * ---------------------------------------------------------- */
  var phaseBars = document.querySelectorAll('.phase-bar-fill');

  if ('IntersectionObserver' in window && phaseBars.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var bar = entry.target;
            var width = bar.getAttribute('data-width') || bar.style.width || '0%';
            bar.style.width = '0%';
            // Force reflow
            bar.offsetWidth;
            bar.style.width = width;
            observer.unobserve(bar);
          }
        });
      },
      { threshold: 0.3 }
    );

    phaseBars.forEach(function (bar) {
      // Store original width
      if (!bar.getAttribute('data-width')) {
        bar.setAttribute('data-width', bar.style.width || '0%');
      }
      bar.style.width = '0%';
      observer.observe(bar);
    });
  } else {
    // Fallback: show all bars immediately
    phaseBars.forEach(function (bar) {
      var width = bar.getAttribute('data-width') || bar.style.width || '0%';
      bar.style.width = width;
    });
  }

  /* ----------------------------------------------------------
   * External link handling: open in new tab with security
   * ---------------------------------------------------------- */
  document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
    link.setAttribute('rel', 'noopener noreferrer');
  });

  /* ----------------------------------------------------------
   * Keyboard navigation: skip to content
   * ---------------------------------------------------------- */
  var skipLink = document.createElement('a');
  skipLink.href = '#core-idea';
  skipLink.className = 'sr-only';
  skipLink.textContent = 'Skip to main content';
  skipLink.addEventListener('focus', function () {
    this.classList.remove('sr-only');
    this.style.cssText =
      'position:fixed;top:8px;left:8px;z-index:9999;padding:8px 16px;' +
      'background:#000;color:#fff;font-size:14px;text-decoration:none;';
  });
  skipLink.addEventListener('blur', function () {
    this.classList.add('sr-only');
    this.style.cssText = '';
  });
  document.body.prepend(skipLink);

  /* ----------------------------------------------------------
   * Console welcome message
   * ---------------------------------------------------------- */
  console.log('%c STATUZ IDE ', 'background:#000;color:#fff;font-size:20px;font-weight:bold;padding:4px 12px;');
  console.log('%c Topology-Aware Development Environment', 'font-size:14px;color:#666;');
  console.log('%c https://github.com/Oasis-Company/Statuz-IDE', 'font-size:12px;color:#999;');
})();