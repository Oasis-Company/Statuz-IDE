/**
 * Statuz IDE — GitHub Pages
 * Swiss Style · Black & White · Minimalist
 *
 * Interactive effects: animated stat counters, scroll-triggered
 * manifesto stagger, smooth nav, and intersection observer for
 * status bars.
 */
(function () {
  'use strict';

  /* ============================================================
   * Animated Stat Counter
   * ============================================================ */
  var statNumbers = document.querySelectorAll('.stat-number');
  var statsAnimated = false;

  function animateStats() {
    if (statsAnimated) return;
    statsAnimated = true;

    statNumbers.forEach(function (el) {
      var target = parseInt(el.textContent, 10);
      if (isNaN(target) || target === 0) return;
      var duration = 1200;
      var startTime = performance.now();

      el.textContent = '0';

      function step(now) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = Math.round(eased * target);
        el.textContent = current;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target;
        }
      }

      requestAnimationFrame(step);
    });
  }

  /* ============================================================
   * Manifesto Stagger Animation
   * ============================================================ */
  var manifestoStatements = document.querySelectorAll('.manifesto-statement');

  function animateManifesto() {
    manifestoStatements.forEach(function (el, i) {
      setTimeout(function () {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 150 * (i + 1));
    });
  }

  // Prepare manifesto statements for animation
  manifestoStatements.forEach(function (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  /* ============================================================
   * Intersection Observer Master
   * ============================================================ */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          // Stats bar animation
          if (entry.target.id === 'stats' && !statsAnimated) {
            animateStats();
          }

          // Manifesto stagger
          if (entry.target.id === 'manifesto' && manifestoStatements.length) {
            animateManifesto();
          }

          // Phase progress bars
          var bars = entry.target.querySelectorAll('.phase-bar-fill');
          bars.forEach(function (bar) {
            var width = bar.getAttribute('data-width') || bar.style.width || '0%';
            bar.style.width = '0%';
            bar.offsetWidth; // Force reflow
            bar.style.width = width;
          });
        });
      },
      { threshold: 0.2 }
    );

    // Observe sections
    var observeIds = ['stats', 'manifesto', 'status'];
    observeIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    // Also observe phase bars directly (backward compat)
    document.querySelectorAll('.phase-bar-fill').forEach(function (bar) {
      if (!bar.getAttribute('data-width')) {
        bar.setAttribute('data-width', bar.style.width || '0%');
      }
      bar.style.width = '0%';
      observer.observe(bar.parentElement.parentElement);
    });
  } else {
    // Fallback: show all animations immediately
    animateStats();
    animateManifesto();
    document.querySelectorAll('.phase-bar-fill').forEach(function (bar) {
      var width = bar.getAttribute('data-width') || bar.style.width || '0%';
      bar.style.width = width;
    });
  }

  /* ============================================================
   * Smooth scroll for anchor links
   * ============================================================ */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ============================================================
   * External link handling: open in new tab with security
   * ============================================================ */
  document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
    link.setAttribute('rel', 'noopener noreferrer');
  });

  /* ============================================================
   * Keyboard navigation: skip to content
   * ============================================================ */
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

  /* ============================================================
   * Console welcome message
   * ============================================================ */
  console.log('%c STATUZ IDE ', 'background:#000;color:#fff;font-size:20px;font-weight:bold;padding:4px 12px;');
  console.log('%c Topology-Aware Development Environment', 'font-size:14px;color:#666;');
  console.log('%c The text era is over. The topology era has begun.', 'font-size:12px;color:#999;');
  console.log('%c https://github.com/Oasis-Company/Statuz-IDE', 'font-size:12px;color:#999;');
})();