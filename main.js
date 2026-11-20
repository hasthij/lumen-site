(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Section headings: masked line reveal
  $$('h2').forEach(h => {
    h.classList.add('reveal-mask');
    h.innerHTML = `<span class="mask"><span>${h.innerHTML}</span></span>`;
  });
  $$('.rows .row, .steps li').forEach((el, i) => el.style.setProperty('--d', (i % 3) * .1 + 's'));

  // Scroll reveal
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: '0px 0px -5% 0px' });
  $$('.reveal, [data-in], .reveal-mask, .rows, .stats, .steps, .bars').forEach(el => io.observe(el));

  // Sticky nav: progress line + border once scrolled. Hero desk parallax.
  const nav = $('#nav'), desk = $('.desk');
  let tick = false;
  const onScroll = () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => {
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      nav.style.setProperty('--p', max > 0 ? y / max : 0);
      nav.classList.toggle('scrolled', y > 8);
      if (!reduce) {
        const r = desk.getBoundingClientRect(), t = Math.min(Math.max((innerHeight - r.top) / (innerHeight + r.height), 0), 1);
        desk.style.setProperty('--py', ((.5 - t) * 40).toFixed(1));
        desk.style.setProperty('--ps', Math.max(t - .5, 0).toFixed(3));
      }
      tick = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Row cursor spotlight
  $$('.row').forEach(r => r.addEventListener('pointermove', e => {
    r.style.setProperty('--mx', e.clientX - r.getBoundingClientRect().left + 'px');
  }));

  // Count-up
  const fmt = (el, v) => { el.textContent = (el.dataset.prefix || '') + v.toFixed(+el.dataset.dec || 0) + (el.dataset.suffix || ''); };
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target, to = +el.dataset.count;
    if (reduce || !to) return fmt(el, to);
    const t0 = performance.now(), dur = 1300;
    const step = t => {
      const p = Math.min((t - t0) / dur, 1);
      fmt(el, to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: .5 });
  $$('[data-count]').forEach(el => { fmt(el, 0); cio.observe(el); });

  // Typing: real launcher frames captured at every keystroke
  const F = { a: 7, b: 7 }; // frames 0..n per query ("spotify", "=24*7+3")
  const src = (k, i) => `shots/type-${k}-${i}.png`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Every frame is a decoded <img> layer in a stack: showing one is a class toggle, no re-decode or layout.
  const buildFrames = box => {
    box.replaceChildren();
    const m = {};
    for (const k of ['a', 'b']) for (let i = 0; i <= F[k]; i++) {
      const im = Object.assign(new Image(), { src: src(k, i), alt: '', decoding: 'async' });
      box.append(im); m[k + i] = im;
    }
    let cur = null;
    return key => { if (cur === m[key]) return; if (cur) cur.classList.remove('on'); cur = m[key]; if (cur) cur.classList.add('on'); };
  };

  const setHero = buildFrames($('#heroType'));
  let heroVis = true;
  new IntersectionObserver(([e]) => { heroVis = e.isIntersecting; }).observe($('.desk'));
  (async function heroTyping() {
    if (reduce) { setHero('a' + F.a); return; }
    setHero('a0');
    await sleep(2400);
    for (;;) for (const k of ['a', 'b']) {
      for (let i = 0; i <= F[k]; i++) { while (!heroVis || document.hidden) await sleep(300); setHero(k + i); await sleep(i === 0 ? 900 : 120 + Math.random() * 70); }
      await sleep(2600);
      for (let i = F[k] - 1; i >= 0; i--) { setHero(k + i); await sleep(38); }
      await sleep(500);
    }
  })();

  // Scroll-driven story: the pinned stage plays the same real frames as you scroll
  const sec = $('#demo');
  if (sec && !reduce) {
    const steps = $$('.story li', sec), stage = $('.stage2', sec), setLaunch = buildFrames($('#scLaunch')), isl = $('#scIsl');
    const N = steps.length, clamp = (v, a, b) => Math.min(Math.max(v, a), b);
    let lastKey = '';
    const draw = () => {
      const r = sec.getBoundingClientRect(), p = clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 0.9999);
      const s = Math.floor(p * N), local = p * N - s;
      sec.style.setProperty('--sp', p.toFixed(3));
      steps.forEach((li, k) => li.classList.toggle('on', k === s));
      let key;
      if (s === 0) key = local < .45 ? 'keys' : 'a0';
      else if (s === 1) key = 'a' + (1 + Math.floor(clamp(local / .85, 0, 1) * (F.a - .01)));
      else if (s === 2) key = local < .12 ? 'b0' : 'b' + (1 + Math.floor(clamp((local - .12) / .75, 0, 1) * (F.b - .01)));
      else key = 'i' + (s - 3);
      if (key === lastKey) return; lastKey = key;
      stage.classList.toggle('keys', key === 'keys');
      stage.classList.toggle('mode-isl', key[0] === 'i');
      if (key[0] === 'a' || key[0] === 'b') setLaunch(key);
      if (key === 'keys') setLaunch('a0');
      if (key[0] === 'i') show(isl, +key.slice(1));
    };
    addEventListener('scroll', draw, { passive: true });
    addEventListener('resize', draw); draw();
  }

  // Screenshot stacks: crossfade through the real app screens
  function show(stack, i) { $$(':scope>.shot', stack).forEach((s, k) => s.classList.toggle('on', k === i)); }
  if (!reduce) {
    $$('[data-cycle]').forEach(stack => {
      const n = $$(':scope>.shot', stack).length; let i = 0, vis = true;
      new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(stack);
      setInterval(() => { if (vis && !document.hidden) show(stack, i = (i + 1) % n); }, +stack.dataset.cycle);
    });
  }

  // Tabbed showcases (island tabs, settings pages): segmented control with a sliding pill
  $$('.tabbed').forEach(stack => {
    const shots = $$(':scope>.shot', stack), seg = $('.seg', stack.parentElement);
    const pill = Object.assign(document.createElement('span'), { className: 'pill' });
    seg.append(pill);
    let cur = 0, auto = true, vis = false;
    const btns = shots.map((s, i) => {
      const b = Object.assign(document.createElement('button'), { textContent: s.dataset.t });
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => { auto = false; go(i); });
      seg.append(b); return b;
    });
    const place = () => {
      const b = btns[cur];
      pill.style.width = b.offsetWidth + 'px'; pill.style.height = b.offsetHeight + 'px';
      pill.style.transform = `translate(${b.offsetLeft}px,${b.offsetTop}px)`;
    };
    const go = i => {
      cur = i; show(stack, i);
      btns.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
      place();
    };
    go(0);
    addEventListener('resize', place);
    document.fonts?.ready.then(place);
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; }, { threshold: .4 }).observe(stack);
    if (!reduce) setInterval(() => { if (auto && vis && !document.hidden) go((cur + 1) % shots.length); }, 4600);
  });

  // Hero: pointer tilt (each layer moves by its own depth) plus a soft spotlight, only while the pointer is over the desk.
  const dsk = $('.desk');
  if (dsk && !reduce && matchMedia('(hover:hover)').matches) {
    $$('[data-depth]', dsk).forEach(e => e.style.setProperty('--z', e.dataset.depth));
    let raf = 0, px = 0, py = 0;
    const apply = () => { raf = 0; dsk.style.setProperty('--tx', px.toFixed(3)); dsk.style.setProperty('--ty', py.toFixed(3)); };
    dsk.addEventListener('pointermove', e => {
      const r = dsk.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5;
      dsk.style.setProperty('--gx', (px + .5) * 100 + '%'); dsk.style.setProperty('--gy', (py + .5) * 100 + '%'); dsk.style.setProperty('--go', 1);
      raf ||= requestAnimationFrame(apply);
    });
    dsk.addEventListener('pointerleave', () => { px = py = 0; dsk.style.setProperty('--go', 0); raf ||= requestAnimationFrame(apply); });
  }
  $$('.feats li').forEach(l => l.addEventListener('pointermove', e => {
    const r = l.getBoundingClientRect();
    l.style.setProperty('--mx', e.clientX - r.left + 'px'); l.style.setProperty('--my', e.clientY - r.top + 'px');
  }));

  // Pause the endless CSS animations while the tab is hidden or the hero is off-screen.
  const setPaused = () => document.documentElement.classList.toggle('paused', document.hidden || !heroVis);
  document.addEventListener('visibilitychange', setPaused);
  new IntersectionObserver(([e]) => { heroVis = e.isIntersecting; setPaused(); }, { rootMargin: '200px' }).observe($('.desk'));
})();
