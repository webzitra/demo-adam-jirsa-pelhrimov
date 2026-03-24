(function() {
    'use strict';

    // --- Navbar scroll ---
    var navbar = document.querySelector('.navbar');
    var navToggle = document.querySelector('.navbar-toggle');
    var navMenu = document.querySelector('.navbar-mobile');
    var navLinks = document.querySelectorAll('.nav-link');

    function updateNavbar() {
        if (!navbar) return;
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
    window.addEventListener('scroll', updateNavbar, { passive: true });
    updateNavbar();

    // --- Mobile menu ---
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            var isOpen = navMenu.classList.toggle('open');
            navToggle.classList.toggle('active', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        navMenu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                navMenu.classList.remove('open');
                navToggle.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // --- Smooth scroll for anchor links ---
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                // Always close mobile menu if open
                if (navMenu && navMenu.classList.contains('open')) {
                    navMenu.classList.remove('open');
                    if (navToggle) navToggle.classList.remove('active');
                    document.body.style.overflow = '';
                }
                var offset = navbar ? navbar.offsetHeight : 0;
                var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        });
    });

    // --- Animated counters ---
    var counters = document.querySelectorAll('[data-count]');
    var countersAnimated = new Set();

    function animateCounter(el) {
        var target = parseInt(el.getAttribute('data-count'), 10);
        var suffix = el.getAttribute('data-suffix') || '';
        var prefix = el.getAttribute('data-prefix') || '';
        var duration = 2000;
        var start = 0;
        var startTime = null;

        function easeOut(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var current = Math.floor(easeOut(progress) * target);
            el.textContent = prefix + current + suffix;
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = prefix + target + suffix;
            }
        }
        requestAnimationFrame(step);
    }

    // --- Fade-in on scroll (IntersectionObserver) ---
    var fadeEls = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .fade-in-stagger, .scale-in');
    var observerOptions = { threshold: 0.1, rootMargin: '0px 0px -30px 0px' };

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);

                // Trigger counter animation if it has data-count
                if (entry.target.hasAttribute('data-count') && !countersAnimated.has(entry.target)) {
                    countersAnimated.add(entry.target);
                    animateCounter(entry.target);
                }

                // Trigger counters inside this element
                entry.target.querySelectorAll('[data-count]').forEach(function(counter) {
                    if (!countersAnimated.has(counter)) {
                        countersAnimated.add(counter);
                        animateCounter(counter);
                    }
                });
            }
        });
    }, observerOptions);

    fadeEls.forEach(function(el) { observer.observe(el); });
    counters.forEach(function(el) {
        if (!el.classList.contains('fade-in')) {
            observer.observe(el);
        }
    });

    // --- Scroll to top ---
    var scrollBtn = document.querySelector('.scroll-top');
    if (scrollBtn) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 600) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        }, { passive: true });

        scrollBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Cookie banner ---
    var cookieBanner = document.getElementById('cookie-banner');
    var cookieAccept = document.getElementById('cookie-accept');
    var cookieReject = document.getElementById('cookie-reject');

    if (cookieBanner && !localStorage.getItem('cookies-accepted')) {
        setTimeout(function() {
            cookieBanner.removeAttribute('hidden');
            requestAnimationFrame(function() {
                cookieBanner.classList.add('visible');
            });
        }, 1500);
    }

    function hideCookieBanner(value) {
        localStorage.setItem('cookies-accepted', value);
        cookieBanner.classList.remove('visible');
        setTimeout(function() {
            cookieBanner.setAttribute('hidden', '');
        }, 500);
    }

    if (cookieAccept) {
        cookieAccept.addEventListener('click', function() {
            hideCookieBanner('true');
        });
    }
    if (cookieReject) {
        cookieReject.addEventListener('click', function() {
            hideCookieBanner('false');
        });
    }

    // --- Service accordion toggle ---
    var accordionHeaders = document.querySelectorAll('.service-accordion-header');
    accordionHeaders.forEach(function(header) {
        header.addEventListener('click', function() {
            var item = this.closest('.service-accordion-item');
            var body = item.querySelector('.service-accordion-body');
            var isActive = item.classList.contains('active');

            // Close all others
            document.querySelectorAll('.service-accordion-item.active').forEach(function(openItem) {
                if (openItem !== item) {
                    openItem.classList.remove('active');
                    openItem.querySelector('.service-accordion-header').setAttribute('aria-expanded', 'false');
                    var openBody = openItem.querySelector('.service-accordion-body');
                    openBody.style.maxHeight = null;
                }
            });

            // Toggle current
            if (isActive) {
                item.classList.remove('active');
                this.setAttribute('aria-expanded', 'false');
                body.style.maxHeight = null;
            } else {
                item.classList.add('active');
                this.setAttribute('aria-expanded', 'true');
                body.style.maxHeight = body.scrollHeight + 'px';
            }
        });

        // Keyboard support (Enter/Space)
        header.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });

    // Initialize first accordion item
    var firstAccordion = document.querySelector('.service-accordion-item.active .service-accordion-body');
    if (firstAccordion) {
        firstAccordion.style.maxHeight = firstAccordion.scrollHeight + 'px';
    }

    // --- Contact form (demo only) ---
    var form = document.querySelector('.contact-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var btn = form.querySelector('button[type="submit"]');
            if (btn) {
                btn.textContent = '✓ Odesláno!';
                btn.disabled = true;
                btn.style.opacity = '0.7';
            }
            setTimeout(function() {
                form.reset();
                if (btn) {
                    btn.textContent = 'Chci konzultaci zdarma';
                    btn.disabled = false;
                    btn.style.opacity = '';
                }
            }, 3000);
        });
    }

    // --- Privacy modal ---
    var privacyModal = document.getElementById('ochrana-udaju-modal');
    if (privacyModal) {
        // Open via hash links
        document.querySelectorAll('a[href="#ochrana-udaju"]').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                privacyModal.removeAttribute('hidden');
                document.body.style.overflow = 'hidden';
                requestAnimationFrame(function() {
                    privacyModal.classList.add('visible');
                });
            });
        });

        // Close button
        var closeBtn = privacyModal.querySelector('.privacy-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                privacyModal.classList.remove('visible');
                document.body.style.overflow = '';
                setTimeout(function() { privacyModal.setAttribute('hidden', ''); }, 300);
            });
        }

        // Close on backdrop click
        var backdrop = privacyModal.querySelector('.privacy-modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', function() {
                closeBtn.click();
            });
        }

        // Close on Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !privacyModal.hasAttribute('hidden')) {
                closeBtn.click();
            }
        });
    }

    // --- Floating CTA — hide near contact section ---
    var floatingCta = document.querySelector('.floating-cta');
    var contactSection = document.getElementById('kontakt');
    if (floatingCta && contactSection) {
        window.addEventListener('scroll', function() {
            var contactTop = contactSection.getBoundingClientRect().top;
            if (contactTop < window.innerHeight * 1.2) {
                floatingCta.classList.add('hidden');
            } else {
                floatingCta.classList.remove('hidden');
            }
        }, { passive: true });
    }

    // --- Active nav link highlight on scroll ---
    var sections = document.querySelectorAll('section[id]');
    function highlightNav() {
        var scrollPos = window.scrollY + 100;
        sections.forEach(function(section) {
            var top = section.offsetTop;
            var height = section.offsetHeight;
            var id = section.getAttribute('id');
            var link = document.querySelector('.nav-link[href="#' + id + '"]');
            if (link) {
                if (scrollPos >= top && scrollPos < top + height) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            }
        });
    }
    window.addEventListener('scroll', highlightNav, { passive: true });
    highlightNav();

    // --- Testimonials slider ---
    var track = document.getElementById('testimonials-track');
    var dotsContainer = document.getElementById('testimonials-dots');
    var prevBtn = document.querySelector('.testimonials-prev');
    var nextBtn = document.querySelector('.testimonials-next');

    if (track && dotsContainer) {
        var cards = track.querySelectorAll('.testimonial-card');
        var currentSlide = 0;

        function getVisibleCount() {
            if (window.innerWidth <= 640) return 1;
            if (window.innerWidth <= 960) return 2;
            return 3;
        }

        function getTotalSlides() {
            return Math.max(1, cards.length - getVisibleCount() + 1);
        }

        function buildDots() {
            dotsContainer.innerHTML = '';
            var total = getTotalSlides();
            for (var i = 0; i < total; i++) {
                var dot = document.createElement('button');
                dot.className = 'testimonials-dot' + (i === currentSlide ? ' active' : '');
                dot.setAttribute('aria-label', 'Recenze ' + (i + 1));
                dot.dataset.index = i;
                dot.addEventListener('click', function() {
                    goToSlide(parseInt(this.dataset.index));
                });
                dotsContainer.appendChild(dot);
            }
        }

        function goToSlide(index) {
            var total = getTotalSlides();
            currentSlide = Math.max(0, Math.min(index, total - 1));
            var card = cards[0];
            var gap = parseFloat(getComputedStyle(track).gap) || 24;
            var cardWidth = card.offsetWidth + gap;
            track.style.transform = 'translateX(-' + (currentSlide * cardWidth) + 'px)';
            dotsContainer.querySelectorAll('.testimonials-dot').forEach(function(d, i) {
                d.classList.toggle('active', i === currentSlide);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                goToSlide(currentSlide - 1);
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                goToSlide(currentSlide + 1);
            });
        }

        // Touch swipe support
        var touchStartX = 0;
        var touchEndX = 0;
        track.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        track.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            if (touchStartX - touchEndX > 50) goToSlide(currentSlide + 1);
            if (touchEndX - touchStartX > 50) goToSlide(currentSlide - 1);
        }, { passive: true });

        buildDots();
        window.addEventListener('resize', function() {
            buildDots();
            goToSlide(currentSlide);
        });
    }

    // --- Show more transformations ---
    var showMoreBtn = document.getElementById('show-more-transformations');
    var moreTransformations = document.getElementById('more-transformations');
    var showMoreWrap = document.getElementById('show-more-wrap');
    if (showMoreBtn && moreTransformations) {
        showMoreBtn.addEventListener('click', function() {
            moreTransformations.removeAttribute('hidden');
            showMoreWrap.style.display = 'none';
        });
    }

})();
