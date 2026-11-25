/* =========================================================
   CHENCHEN WANG — INTERFACE BEHAVIOUR
   ========================================================= */

(() => {
  'use strict';

  const body = document.body;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------------------------------------------------------
     Boot sequence
     --------------------------------------------------------- */

  const boot = document.getElementById('boot');
  const bootBar = document.getElementById('boot-bar');
  const bootPercent = document.getElementById('boot-percent');
  let bootFinished = false;
  let pageLoaded = false;
  let progressTimer = null;

  if (reduceMotion) {
    finishBoot();
  } else {
    const bootStart = performance.now();
    progressTimer = window.setInterval(() => {
      const elapsed = performance.now() - bootStart;
      const artificial = Math.min(94, (elapsed / 1500) * 88);
      const target = pageLoaded ? 100 : artificial;
      if (bootBar) bootBar.style.transform = `scaleX(${target / 100})`;
      if (bootPercent) bootPercent.textContent = String(Math.round(target)).padStart(3, '0');
      if (target >= 100) {
        window.clearInterval(progressTimer);
        window.setTimeout(finishBoot, 380);
      }
    }, 40);

    window.addEventListener('load', () => {
      pageLoaded = true;
    }, { once: true });

    // The page should never be held hostage by a slow asset.
    window.setTimeout(finishBoot, 3600);
  }

  function finishBoot() {
    if (bootFinished) return;
    bootFinished = true;
    if (progressTimer) window.clearInterval(progressTimer);
    if (bootBar) bootBar.style.transform = 'scaleX(1)';
    if (bootPercent) bootPercent.textContent = '100';
    window.setTimeout(() => {
      boot?.classList.add('is-hidden');
      body.classList.remove('is-loading');
      body.classList.add('is-ready');
      window.setTimeout(() => {
        if (boot) boot.style.display = 'none';
      }, 950);
    }, reduceMotion ? 0 : 420);
  }

  /* ---------------------------------------------------------
     Live clocks
     --------------------------------------------------------- */

  const headerTime = document.getElementById('header-time');
  const contactTime = document.getElementById('contact-time');

  function shanghaiTime(includeSeconds = true) {
    const options = {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    if (includeSeconds) options.second = '2-digit';
    return new Intl.DateTimeFormat('en-GB', options).format(new Date());
  }

  function updateClock() {
    const time = shanghaiTime();
    if (headerTime) headerTime.textContent = time;
    if (contactTime) contactTime.textContent = time;
  }

  updateClock();
  window.setInterval(updateClock, 1000);

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------
     Header / scroll progress / active nav
     --------------------------------------------------------- */

  const header = document.getElementById('site-header');
  const progressBar = document.getElementById('scroll-progress-bar');
  const navLinks = [...document.querySelectorAll('[data-nav]')];
  const sections = [...document.querySelectorAll('main section[id]')];
  let scrollTick = false;

  function updateScrollUI() {
    scrollTick = false;
    const scrollY = window.scrollY || window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle('is-scrolled', scrollY > 24);
    if (progressBar) {
      const completion = docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0;
      progressBar.style.transform = `scaleX(${completion})`;
    }

    let active = '';
    const marker = window.innerHeight * 0.38;
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom > marker) active = section.id;
    });

    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.nav === active);
      if (link.dataset.nav === active) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    // A scroll-based safety net for very fast jumps: the IntersectionObserver
    // handles the choreography, this catches anything skipped during a hard jump.
    if (!reduceMotion) {
      const viewportMarker = window.innerHeight * 0.94;
      document.querySelectorAll('.reveal:not(.is-visible)').forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.top < viewportMarker && rect.bottom > -40) {
          item.classList.add('is-visible');
        }
      });
    }
  }

  window.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = true;
    window.requestAnimationFrame(updateScrollUI);
  }, { passive: true });
  window.addEventListener('resize', updateScrollUI, { passive: true });
  updateScrollUI();

  /* ---------------------------------------------------------
     Reveal on scroll
     --------------------------------------------------------- */

  const revealItems = [...document.querySelectorAll('.reveal')];

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -7% 0px'
    });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  /* ---------------------------------------------------------
     Counters
     --------------------------------------------------------- */

  const countEls = [...document.querySelectorAll('[data-count]')];

  function animateCounter(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    const wantsPad = el.textContent.trim().startsWith('0');
    const duration = 1550;
    const start = performance.now();

    function frame(now) {
      const raw = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - raw, 3);
      const value = Math.round(target * eased);
      const formatted = target > 999
        ? value.toLocaleString('en-US')
        : wantsPad
          ? String(value).padStart(2, '0')
          : String(value);
      el.textContent = formatted;
      if (raw < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.7 });
    countEls.forEach((el) => countObserver.observe(el));
  }

  /* ---------------------------------------------------------
     Mobile menu
     --------------------------------------------------------- */

  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuLabel = menuToggle?.querySelector('.menu-toggle__label');
  const mobileLinks = [...(mobileMenu?.querySelectorAll('a') || [])];

  function setMenu(open) {
    if (!menuToggle || !mobileMenu) return;
    body.classList.toggle('menu-open', open);
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    menuToggle.setAttribute('aria-expanded', String(open));
    if (menuLabel) menuLabel.textContent = open ? 'CLOSE' : 'MENU';
    if (open) {
      const firstLink = mobileMenu.querySelector('a');
      window.setTimeout(() => firstLink?.focus(), 350);
    } else if (document.activeElement && mobileMenu.contains(document.activeElement)) {
      menuToggle.focus();
    }
  }

  menuToggle?.addEventListener('click', () => {
    setMenu(!body.classList.contains('menu-open'));
  });

  mobileLinks.forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && body.classList.contains('menu-open')) {
      setMenu(false);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1020 && body.classList.contains('menu-open')) setMenu(false);
  }, { passive: true });

  /* ---------------------------------------------------------
     Magnetic buttons
     --------------------------------------------------------- */

  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.magnetic').forEach((el) => {
      const strength = 7;
      el.addEventListener('pointermove', (event) => {
        const rect = el.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        el.style.transform = `translate(${x * strength}px, ${y * strength * 0.65}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ---------------------------------------------------------
     Custom cursor
     --------------------------------------------------------- */

  if (finePointer && !reduceMotion) {
    const cursor = document.querySelector('.cursor');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorLabel = cursor?.querySelector('.cursor__label');

    if (cursor && cursorDot) {
      body.classList.add('cursor-enabled');
      let x = -100;
      let y = -100;
      let cx = -100;
      let cy = -100;
      let lastCheck = 0;

      window.addEventListener('pointermove', (event) => {
        x = event.clientX;
        y = event.clientY;
        cursorDot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        if (!body.classList.contains('cursor-ready')) body.classList.add('cursor-ready');

        if (performance.now() - lastCheck > 80) {
          lastCheck = performance.now();
          const target = document.elementFromPoint(x, y);
          const project = target?.closest('.project');
          const interactive = target?.closest('a, button, [role="button"], .copy-email');
          const inDialog = target?.closest('.project-dialog');

          cursor.classList.toggle('cursor--hover', Boolean(project) && !inDialog);
          cursor.classList.toggle('cursor--link', !project && Boolean(interactive));
          if (cursorLabel) {
            cursorLabel.textContent = project ? 'VIEW' : interactive ? 'GO' : 'VIEW';
          }
        }
      }, { passive: true });

      document.addEventListener('mouseleave', () => {
        body.classList.remove('cursor-ready');
      });
      document.addEventListener('mouseenter', () => {
        if (x > 0) body.classList.add('cursor-ready');
      });

      function animateCursor() {
        cx += (x - cx) * 0.16;
        cy += (y - cy) * 0.16;
        cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
        window.requestAnimationFrame(animateCursor);
      }
      animateCursor();
    }
  }

  /* ---------------------------------------------------------
     Capabilities accordion
     --------------------------------------------------------- */

  const capabilities = [...document.querySelectorAll('.capability')];
  capabilities.forEach((cap) => {
    const head = cap.querySelector('.capability__head');
    head?.addEventListener('click', () => {
      const willOpen = !cap.classList.contains('is-open');
      capabilities.forEach((other) => {
        const isCurrent = other === cap;
        other.classList.toggle('is-open', isCurrent ? willOpen : false);
        other.querySelector('.capability__head')?.setAttribute('aria-expanded', String(isCurrent ? willOpen : false));
      });
    });
  });

  /* ---------------------------------------------------------
     Project dialog
     --------------------------------------------------------- */

  const projects = {
    crossculture: {
      index: 'RESEARCH / 01',
      meta: 'RESEARCH DIRECTION / CROSS-CULTURAL STUDIES',
      title: '跨文化研究',
      image: 'assets/work-nexus.jpg',
      alt: 'Aerial night view of a luminous district with data paths and a holographic layer above it.',
      summary: 'Research on communication across cultures: how media texts, symbols and everyday practices are encoded in one cultural context and read in another.',
      challenge: 'What gets lost, gained or reinvented when a story moves between cultures — and how can communicators design for that translation rather than against it?',
      role: ['Intercultural communication theory', 'Cross-cultural media reception', 'Cultural identity in digital spaces', 'Comparative media studies'],
      metrics: [],
      tags: ['CROSS-CULTURAL', 'COMMUNICATION', 'MEDIA', 'IDENTITY']
    },
    softpower: {
      index: 'RESEARCH / 02',
      meta: 'RESEARCH DIRECTION / CULTURAL SOFT POWER',
      title: '文化软实力',
      image: 'assets/work-aura.jpg',
      alt: 'A warm, minimalist room with a brass panel and a soft holographic dial.',
      summary: 'Research on cultural soft power: how cultural resources, heritage and contemporary media become sources of attraction, trust and influence.',
      challenge: 'How can cultural heritage — including that of historic cities such as Kaifeng — be told in ways that resonate with international and younger audiences?',
      role: ['Soft power theory', 'International communication', 'Heritage and city image', 'Digital storytelling of Chinese culture'],
      metrics: [],
      tags: ['SOFT POWER', 'NARRATIVE', 'HERITAGE', 'GLOBAL']
    },
    festivals: {
      index: 'RESEARCH / 03',
      meta: 'RESEARCH DIRECTION / FILM FESTIVALS',
      title: '电影节',
      image: 'assets/work-kinetic.jpg',
      alt: 'A dark brushed-metal robotic arm lit by a lime beam, reaching toward a chrome sphere.',
      summary: 'Research on film festivals as sites of cultural exchange, industry networking and city image-building.',
      challenge: 'How do film festivals shape which stories circulate globally, and what role do they play in the cultural image of their host cities?',
      role: ['Festival studies', 'Film circulation and programming', 'Festivals and city image', 'Cross-cultural audiences'],
      metrics: [],
      tags: ['FILM FESTIVALS', 'CINEMA', 'CITY IMAGE', 'EXCHANGE']
    }
  };

  const dialog = document.getElementById('project-dialog');
  const modalClose = document.getElementById('modal-close');
  const modalImage = document.getElementById('modal-image');
  const modalIndex = document.getElementById('modal-index');
  const modalMeta = document.getElementById('modal-meta');
  const modalTitle = document.getElementById('modal-title');
  const modalSummary = document.getElementById('modal-summary');
  const modalChallenge = document.getElementById('modal-challenge');
  const modalRole = document.getElementById('modal-role');
  const modalMetrics = document.getElementById('modal-metrics');
  const modalTags = document.getElementById('modal-tags');
  const modalCta = document.getElementById('modal-cta');
  let lastProjectTrigger = null;

  function openProject(key, trigger) {
    const data = projects[key];
    if (!data || !dialog) return;
    lastProjectTrigger = trigger || null;
    if (modalIndex) modalIndex.textContent = data.index;
    if (modalMeta) modalMeta.textContent = data.meta;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalSummary) modalSummary.textContent = data.summary;
    if (modalChallenge) modalChallenge.textContent = data.challenge;
    if (modalImage) {
      modalImage.src = data.image;
      modalImage.alt = data.alt;
    }
    if (modalRole) modalRole.innerHTML = data.role.map((item) => `<li>${item}</li>`).join('');
    if (modalMetrics) {
      modalMetrics.innerHTML = data.metrics.map(([value, label]) => (
        `<div class="project-dialog__metric"><b>${value}</b><span>${label}</span></div>`
      )).join('');
      modalMetrics.style.display = data.metrics.length ? '' : 'none';
    }
    if (modalTags) modalTags.innerHTML = data.tags.map((tag) => `<span>${tag}</span>`).join('');

    body.classList.add('dialog-open');
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    window.setTimeout(() => modalClose?.focus(), 80);
  }

  function closeProject() {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    body.classList.remove('dialog-open');
    lastProjectTrigger?.focus();
  }

  document.querySelectorAll('[data-project]').forEach((card) => {
    card.addEventListener('click', () => openProject(card.dataset.project, card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openProject(card.dataset.project, card);
      }
    });
  });

  modalClose?.addEventListener('click', closeProject);
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closeProject();
  });
  dialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeProject();
  });
  dialog?.addEventListener('close', () => {
    body.classList.remove('dialog-open');
  });
  modalCta?.addEventListener('click', (event) => {
    event.preventDefault();
    closeProject();
    window.setTimeout(() => {
      const contact = document.getElementById('contact');
      if (contact) {
        contact.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
        const email = contact.querySelector('.email-link');
        window.setTimeout(() => email?.focus(), 700);
      }
    }, 50);
  });

  /* ---------------------------------------------------------
     Email copy + toast
     --------------------------------------------------------- */

  const toast = document.getElementById('toast');
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await copyText(button.dataset.copy);
        showToast('EMAIL COPIED TO CLIPBOARD');
        const label = button.querySelector('span');
        if (label) {
          const original = label.textContent;
          label.textContent = 'COPIED — TALK SOON';
          window.setTimeout(() => { label.textContent = original; }, 2200);
        }
      } catch (error) {
        showToast('COPY FAILED — PLEASE SELECT THE EMAIL ABOVE');
      }
    });
  });

  /* ---------------------------------------------------------
     Sound
     --------------------------------------------------------- */

  const soundToggle = document.getElementById('sound-toggle');
  let audioContext = null;
  let masterGain = null;
  let soundNodes = [];
  let soundOn = false;

  function buildAmbient() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0;

    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 480;
    lowpass.Q.value = 0.7;

    masterGain.connect(audioContext.destination);
    lowpass.connect(masterGain);

    const frequencies = [55, 82.5, 110.2];
    frequencies.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const panner = audioContext.createStereoPanner();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 1 ? 4 : index === 2 ? -6 : 0;
      gain.gain.value = index === 0 ? 0.055 : index === 1 ? 0.018 : 0.009;
      panner.pan.value = index === 0 ? -0.22 : index === 1 ? 0.25 : 0;
      oscillator.connect(gain);
      gain.connect(panner);
      panner.connect(lowpass);
      oscillator.start();
      soundNodes.push(oscillator);
    });

    // slow filter motion for a living room tone
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.frequency.value = 0.055;
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(lowpass.frequency);
    lfo.start();
    soundNodes.push(lfo);

    // barely-there air
    const bufferSize = audioContext.sampleRate * 2;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noise[i] = Math.random() * 2 - 1;
    const noiseSource = audioContext.createBufferSource();
    const noiseGain = audioContext.createGain();
    const noiseFilter = audioContext.createBiquadFilter();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1200;
    noiseFilter.Q.value = 0.6;
    noiseGain.gain.value = 0.0035;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSource.start();
    soundNodes.push(noiseSource);
  }

  async function setSound(on) {
    if (!soundToggle) return;
    if (!audioContext) buildAmbient();
    if (audioContext.state === 'suspended') await audioContext.resume();

    const now = audioContext.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(on ? 0.8 : 0, now + (on ? 1.2 : 0.65));

    soundOn = on;
    soundToggle.classList.toggle('is-on', on);
    soundToggle.setAttribute('aria-pressed', String(on));
    soundToggle.setAttribute('aria-label', on ? 'Turn ambient sound off' : 'Turn ambient sound on');
    soundToggle.dataset.tooltip = on ? 'SOUND ON' : 'SOUND OFF';
  }

  soundToggle?.addEventListener('click', () => {
    setSound(!soundOn).catch(() => {
      showToast('AUDIO UNAVAILABLE IN THIS BROWSER');
    });
  });

  /* ---------------------------------------------------------
     Back to top
     --------------------------------------------------------- */

  document.getElementById('back-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    window.setTimeout(() => {
      document.querySelector('.brand')?.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 700);
  });

  /* ---------------------------------------------------------
     Subtle pointer parallax on the hero copy
     --------------------------------------------------------- */

  if (finePointer && !reduceMotion) {
    const copy = document.querySelector('.hero-copy');
    const hud = document.querySelector('.hero-hud');
    if (copy) {
      window.addEventListener('pointermove', (event) => {
        if (window.scrollY > window.innerHeight * 0.6) return;
        const nx = (event.clientX / window.innerWidth - 0.5);
        const ny = (event.clientY / window.innerHeight - 0.5);
        copy.style.setProperty('--px', `${nx * -5}px`);
        copy.style.setProperty('--py', `${ny * -4}px`);
        if (hud) {
          hud.style.setProperty('--px', `${nx * 7}px`);
          hud.style.setProperty('--py', `${ny * 6}px`);
        }
      }, { passive: true });
    }
  }

  /* ---------------------------------------------------------
     Smooth anchor scrolling with a little offset
     --------------------------------------------------------- */

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      if (dialog?.open) closeProject();
      if (body.classList.contains('menu-open')) setMenu(false);
      event.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top - 14), behavior: reduceMotion ? 'auto' : 'smooth' });
      window.history.replaceState(null, '', id);
    });
  });

  /* ---------------------------------------------------------
     Keep small details honest
     --------------------------------------------------------- */

  // add a live class after the first paint so hover states settle in nicely
  window.requestAnimationFrame(() => root.classList.add('ui-ready'));

  // graceful fallback if the 3D module cannot initialise
  window.setTimeout(() => {
    if (!window.__NEXUS__) {
      root.classList.add('no-webgl');
      const bootEl = document.getElementById('boot');
      if (bootEl && !bootEl.classList.contains('is-hidden')) {
        bootEl.classList.add('is-hidden');
        body.classList.remove('is-loading');
        body.classList.add('is-ready');
      }
    }
  }, 6500);
})();
