// MedTech user manuals — marker/callout sync, lightbox, active section, mobile menu, fade-in.
(function () {
  const sync = (id, on) => document.querySelectorAll(`[data-id="${id}"]`).forEach((el) => el.classList.toggle('active', on));
  document.querySelectorAll('.marker, .callouts li').forEach((el) => {
    ['mouseenter', 'focus'].forEach((e) => el.addEventListener(e, () => sync(el.dataset.id, true)));
    ['mouseleave', 'blur'].forEach((e) => el.addEventListener(e, () => sync(el.dataset.id, false)));
  });
  document.querySelectorAll('.marker').forEach((m) => {
    const callout = document.querySelector(`.callouts li[data-id="${m.dataset.id}"]`);
    if (callout) m.setAttribute('aria-label', `${m.textContent.trim()}: ${callout.textContent.replace(/^\s*\d+\s*/, '').trim()}`);
    m.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!callout) return;
      callout.scrollIntoView({ behavior: 'smooth', block: 'center' });
      callout.classList.add('active');
      setTimeout(() => callout.classList.remove('active'), 1600);
    });
  });

  const box = document.querySelector('.lightbox');
  const close = document.querySelector('.lightbox-close');
  if (box) {
    const img = box.querySelector('img');
    const shut = () => { box.hidden = true; close.hidden = true; document.body.style.overflow = ''; };
    document.querySelectorAll('.screenshot img').forEach((shot) => {
      shot.parentElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('marker')) return;
        img.src = shot.src; img.alt = shot.alt;
        box.hidden = false; close.hidden = false; document.body.style.overflow = 'hidden';
      });
    });
    box.addEventListener('click', shut);
    close.addEventListener('click', shut);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) shut(); });
  }

  const links = document.querySelectorAll('.sidebar a');
  const targets = [...links].map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  if (targets.length) {
    const io = new IntersectionObserver((entries) => {
      const v = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) links.forEach((a) => a.classList.toggle('active', decodeURIComponent(a.hash.slice(1)) === v.target.id));
    }, { rootMargin: '-20% 0px -65% 0px' });
    targets.forEach((t) => io.observe(t));
  }

  const toggle = document.querySelector('.menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.forEach((a) => a.addEventListener('click', () => document.body.classList.remove('menu-open')));
  }

  const fade = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in-view'); fade.unobserve(e.target); }
  }), { threshold: 0.05 });
  document.querySelectorAll('.fade-in').forEach((el) => fade.observe(el));
})();
