(function() {
    'use strict';

    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Lišta: po odjetí z úvodu dostane tmavé pozadí ---
    var navbar = document.querySelector('.navbar');
    var navToggle = document.querySelector('.navbar-toggle');
    var navMenu = document.querySelector('.navbar-mobile');

    function updateNavbar() {
        if (!navbar) return;
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }
    window.addEventListener('scroll', updateNavbar, { passive: true });
    updateNavbar();

    // --- Úvodní video: až po načtení stránky (nebrzdí první zobrazení), ne při šetření dat.
    //     Zdroj vybírá <source media>: telefon dostane lehčí verzi, při omezeném pohybu žádnou.
    var heroVideo = document.querySelector('.hero-video');
    var videoToggle = document.querySelector('.hero-video-toggle');
    if (heroVideo) {
        heroVideo.addEventListener('playing', function() {
            heroVideo.classList.add('is-playing');
            if (videoToggle) {
                videoToggle.hidden = false;
                videoToggle.setAttribute('aria-label', 'Zastavit video');
                videoToggle.classList.remove('is-paused');
            }
        });
        heroVideo.addEventListener('pause', function() {
            if (videoToggle) {
                videoToggle.setAttribute('aria-label', 'Spustit video');
                videoToggle.classList.add('is-paused');
            }
        });
        var startHeroVideo = function() {
            if (navigator.connection && navigator.connection.saveData) return;
            heroVideo.preload = 'auto';
            var playing = heroVideo.play();
            if (playing && playing.catch) playing.catch(function() {});
        };
        if (document.readyState === 'complete') startHeroVideo();
        else window.addEventListener('load', startHeroVideo);

        // smyčka delší než 5 s musí jít zastavit (WCAG 2.2.2)
        if (videoToggle) {
            videoToggle.addEventListener('click', function() {
                if (heroVideo.paused) {
                    var p = heroVideo.play();
                    if (p && p.catch) p.catch(function() {});
                } else {
                    heroVideo.pause();
                }
            });
        }
    }

    // --- Mobilní menu ---
    var inertTargets = document.querySelectorAll('main, footer, .floating-cta');

    function setMenu(open, returnFocus) {
        if (!navToggle || !navMenu) return;
        navMenu.classList.toggle('open', open);
        navToggle.classList.toggle('active', open);
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        navToggle.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
        document.body.style.overflow = open ? 'hidden' : '';
        inertTargets.forEach(function(el) {
            if (open) el.setAttribute('inert', '');
            else el.removeAttribute('inert');
        });
        if (open) {
            var first = navMenu.querySelector('a');
            if (first) first.focus();
        } else if (returnFocus) {
            navToggle.focus();
        }
    }

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            setMenu(!navMenu.classList.contains('open'), true);
        });
        navMenu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                setMenu(false, false);
            });
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && navMenu.classList.contains('open')) setMenu(false, true);
        });
        // menu je jen pro úzké obrazovky; po rozšíření okna ho zavři
        window.addEventListener('resize', function() {
            if (window.innerWidth > 900 && navMenu.classList.contains('open')) setMenu(false, false);
        });
    }

    // --- Kotvy: plynulý posun pod lištu a fokus na cíl (klávesnice, čtečky) ---
    function scrollToTarget(target) {
        var offset = navbar ? navbar.offsetHeight : 0;
        var top = target === document.body ? 0 : target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    function preselectService(link) {
        var value = link.getAttribute('data-sluzba');
        var select = document.getElementById('service');
        if (value && select && select.querySelector('option[value="' + value + '"]')) select.value = value;
    }

    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            var href = this.getAttribute('href');
            if (href === '#ochrana-udaju') return; // otevírá modal níže
            var target = href === '#' ? document.body : document.getElementById(href.slice(1));
            if (!target) return;
            e.preventDefault();
            if (navMenu && navMenu.classList.contains('open')) setMenu(false, false);
            preselectService(this);
            scrollToTarget(target);
            if (target !== document.body) {
                if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            }
        });
    });

    // --- Nahoru ---
    var scrollBtn = document.querySelector('.scroll-top');
    if (scrollBtn) {
        window.addEventListener('scroll', function() {
            scrollBtn.classList.toggle('visible', window.scrollY > 600);
        }, { passive: true });
        scrollBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        });
    }

    // --- Cookies ---
    var cookieBanner = document.getElementById('cookie-banner');
    var cookieAccept = document.getElementById('cookie-accept');
    var cookieReject = document.getElementById('cookie-reject');

    function storageGet(key) {
        try { return localStorage.getItem(key); } catch (err) { return null; }
    }

    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch (err) { /* soukromé okno */ }
    }

    if (cookieBanner && !storageGet('cookies-accepted')) {
        setTimeout(function() {
            cookieBanner.removeAttribute('hidden');
            void cookieBanner.offsetHeight; // ať se vyjetí opravdu animuje
            cookieBanner.classList.add('visible');
        }, 1500);
    }

    function hideCookieBanner(value) {
        storageSet('cookies-accepted', value);
        cookieBanner.classList.remove('visible');
        setTimeout(function() {
            cookieBanner.setAttribute('hidden', '');
        }, 350);
    }

    if (cookieAccept) cookieAccept.addEventListener('click', function() { hideCookieBanner('true'); });
    if (cookieReject) cookieReject.addEventListener('click', function() { hideCookieBanner('false'); });

    // --- Akordeon (služby, časté dotazy): otevřený vždy jen jeden ---
    function closeAccordion(item) {
        var header = item.querySelector('.service-accordion-header');
        var body = item.querySelector('.service-accordion-body');
        body.style.maxHeight = body.scrollHeight + 'px';
        void body.offsetHeight;
        body.style.maxHeight = '0px';
        item.classList.remove('active');
        header.setAttribute('aria-expanded', 'false');
    }

    function openAccordion(item) {
        var header = item.querySelector('.service-accordion-header');
        var body = item.querySelector('.service-accordion-body');
        item.classList.add('active');
        header.setAttribute('aria-expanded', 'true');
        body.style.maxHeight = body.scrollHeight + 'px';
        // po dojetí bez stropu, ať se vejde i obrázek, který se načte později
        var done = function(e) {
            if (e && e.propertyName !== 'max-height') return;
            body.removeEventListener('transitionend', done);
            if (item.classList.contains('active')) body.style.maxHeight = 'none';
        };
        body.addEventListener('transitionend', done);
        if (reducedMotion) done();
    }

    document.querySelectorAll('.service-accordion-header').forEach(function(header) {
        header.addEventListener('click', function() {
            var item = this.closest('.service-accordion-item');
            var wasOpen = item.classList.contains('active');
            document.querySelectorAll('.service-accordion-item.active').forEach(function(openItem) {
                if (openItem !== item) closeAccordion(openItem);
            });
            if (wasOpen) closeAccordion(item);
            else openAccordion(item);
        });
    });

    // --- Kontaktní formulář (WZ-LEADS: poptávka se uloží u WebZítra a přijde Adamovi e-mailem) ---
    var LEADS_URL = 'https://webzitra.cz/api/client-leads';
    var LEAD_LABELS = { name: 'Jméno', phone: 'Telefon', email: 'email', service: 'Mám zájem o', goal: 'Cíl', message: 'Zpráva' };
    var form = document.querySelector('.contact-form');

    function fieldError(field, message) {
        var errId = field.id + '-chyba';
        var err = document.getElementById(errId);
        if (message) {
            if (!err) {
                err = document.createElement('p');
                err.className = 'field-error';
                err.id = errId;
                field.insertAdjacentElement('afterend', err);
            }
            err.textContent = message;
            field.setAttribute('aria-invalid', 'true');
            field.setAttribute('aria-describedby', errId);
        } else {
            if (err) err.remove();
            field.removeAttribute('aria-invalid');
            field.removeAttribute('aria-describedby');
        }
    }

    function validate(field) {
        var value = field.value.trim();
        if (field.name === 'name' && !value) return 'Napiš prosím své jméno.';
        if (field.name === 'email') {
            if (!value) return 'Napiš prosím e-mail, ať ti můžu odpovědět.';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Tenhle e-mail nevypadá úplně správně.';
        }
        if (field.name === 'phone' && !value) return 'Napiš prosím telefon.';
        return '';
    }

    if (form) {
        var status = form.querySelector('.form-status');
        var checked = ['name', 'email', 'phone']
            .map(function(n) { return form.querySelector('[name="' + n + '"]'); })
            .filter(Boolean);

        // chyba zmizí, jakmile ji člověk opraví
        checked.forEach(function(field) {
            field.addEventListener('input', function() {
                if (field.getAttribute('aria-invalid') === 'true' && !validate(field)) fieldError(field, '');
            });
            field.addEventListener('blur', function() {
                if (field.getAttribute('aria-invalid') === 'true') fieldError(field, validate(field));
            });
        });

        // stavový řádek je v DOM pořád (role="status"), aby ho čtečka ohlásila
        function showStatus(text, kind) {
            if (!status) return;
            status.textContent = text;
            status.className = 'form-status' + (kind ? ' is-' + kind : '');
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            // Validace (stejná pravidla jako dřív: jméno, e-mail, telefon)
            var firstInvalid = null;
            checked.forEach(function(field) {
                var message = validate(field);
                fieldError(field, message);
                if (message && !firstInvalid) firstInvalid = field;
            });
            if (firstInvalid) {
                firstInvalid.focus();
                return;
            }

            var btn = form.querySelector('button[type="submit"]');
            var originalText = btn ? btn.textContent : '';
            if (btn) {
                btn.textContent = 'Odesílám…';
                btn.disabled = true;
            }
            showStatus('', '');
            // email zůstává pod klíčem "email" — podle něj se nastaví odpověď přímo zájemci
            var payload = { siteId: 'adam-jirsa', page: location.pathname };
            form.querySelectorAll('input, select, textarea').forEach(function(field) {
                if (!field.name || !field.value.trim()) return;
                var value = field.tagName === 'SELECT' ? field.options[field.selectedIndex].text : field.value;
                payload[LEAD_LABELS[field.name] || field.name] = value.trim().substring(0, 500);
            });
            fetch(LEADS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(function(response) {
                return response.json().then(function(data) {
                    if (!response.ok || !data.success) throw new Error(data.error || 'Chyba při odesílání');
                });
            }).then(function() {
                form.reset();
                showStatus('Díky, poptávka odešla. Ozvu se ti do 24 hodin.', 'ok');
                if (btn) {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            }).catch(function() {
                showStatus('Odeslání se nepovedlo. Zkus to prosím znovu, nebo zavolej na 731 613 480.', 'error');
                if (btn) {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            });
        });
    }

    // --- Ochrana osobních údajů (modal) ---
    var privacyModal = document.getElementById('ochrana-udaju-modal');
    if (privacyModal) {
        var closeBtn = privacyModal.querySelector('.privacy-modal-close');
        var opener = null;

        var openModal = function(e) {
            e.preventDefault();
            opener = e.currentTarget;
            privacyModal.removeAttribute('hidden');
            document.body.style.overflow = 'hidden';
            void privacyModal.offsetHeight;
            privacyModal.classList.add('visible');
            closeBtn.focus();
        };

        var closeModal = function() {
            privacyModal.classList.remove('visible');
            document.body.style.overflow = '';
            setTimeout(function() { privacyModal.setAttribute('hidden', ''); }, 220);
            if (opener) opener.focus();
        };

        document.querySelectorAll('a[href="#ochrana-udaju"]').forEach(function(link) {
            link.addEventListener('click', openModal);
        });
        closeBtn.addEventListener('click', closeModal);
        var backdrop = privacyModal.querySelector('.privacy-modal-backdrop');
        if (backdrop) backdrop.addEventListener('click', closeModal);

        document.addEventListener('keydown', function(e) {
            if (privacyModal.hasAttribute('hidden')) return;
            if (e.key === 'Escape') {
                closeModal();
                return;
            }
            // fokus zůstává v okně
            if (e.key === 'Tab') {
                var content = privacyModal.querySelector('.privacy-modal-content');
                var focusables = content.querySelectorAll('button, a[href]');
                var first = focusables[0];
                var last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }

    // --- Plovoucí CTA (telefon): schované v úvodu (tam je stejné tlačítko) a u formuláře ---
    var floatingCta = document.querySelector('.floating-cta');
    var heroButtons = document.querySelector('.hero-buttons');
    var contactSection = document.getElementById('kontakt') || document.getElementById('cta');
    if (floatingCta && contactSection) {
        var updateFloating = function() {
            var inHero = heroButtons && heroButtons.getBoundingClientRect().bottom > 0;
            var nearForm = contactSection.getBoundingClientRect().top < window.innerHeight * 1.1;
            floatingCta.classList.toggle('hidden', inHero || nearForm);
        };
        window.addEventListener('scroll', updateFloating, { passive: true });
        window.addEventListener('resize', updateFloating);
        updateFloating();
    }

    // --- Zvýraznění sekce v liště ---
    var sections = document.querySelectorAll('section[id]');
    function highlightNav() {
        var scrollPos = window.scrollY + 100;
        sections.forEach(function(section) {
            var link = document.querySelector('.navbar-links .nav-link[href="#' + section.id + '"]');
            if (!link) return;
            var active = scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight;
            link.classList.toggle('active', active);
        });
    }
    window.addEventListener('scroll', highlightNav, { passive: true });
    highlightNav();

    // --- Pás proměn na telefonu: jde posouvat i z klávesnice ---
    var strips = document.querySelectorAll('.transformations-grid');
    function updateStrips() {
        strips.forEach(function(strip) {
            var scrollable = strip.scrollWidth > strip.clientWidth + 1;
            if (scrollable) {
                strip.setAttribute('tabindex', '0');
                strip.setAttribute('role', 'region');
                strip.setAttribute('aria-label', 'Proměny klientů, posuň do strany');
            } else {
                strip.removeAttribute('tabindex');
                strip.removeAttribute('role');
                strip.removeAttribute('aria-label');
            }
        });
    }
    updateStrips();
    window.addEventListener('resize', updateStrips);

    // --- Další proměny (online stránka) ---
    var showMoreBtn = document.getElementById('show-more-transformations');
    var moreTransformations = document.getElementById('more-transformations');
    var showMoreWrap = document.getElementById('show-more-wrap');
    if (showMoreBtn && moreTransformations) {
        showMoreBtn.addEventListener('click', function() {
            moreTransformations.removeAttribute('hidden');
            showMoreBtn.setAttribute('aria-expanded', 'true');
            if (showMoreWrap) showMoreWrap.hidden = true;
            updateStrips();
            if (!moreTransformations.hasAttribute('tabindex')) moreTransformations.setAttribute('tabindex', '-1');
            moreTransformations.focus({ preventScroll: true });
        });
    }

})();
