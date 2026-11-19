/* Shared behaviour for the developer pages: logo, light/dark switch, help panels, toasts, copy buttons. */
(function(){
  const $ = id => document.getElementById(id);
  const mk = $('mk'); if (mk && window.SL) mk.innerHTML = SL.BRAND.logo;

  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const mode = () => document.documentElement.dataset.ui || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const t = $('uiTheme');
  if (t){
    const icon = () => { t.innerHTML = mode() === 'dark' ? sun : moon; };
    t.onclick = () => { const n = mode() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.ui = n; try { localStorage.setItem('shutterlink:ui-theme', n); } catch(_){} icon(); };
    icon();
  }

  document.addEventListener('click', e => {
    const h = e.target.closest('.help-b');
    if (h){ const p = $(h.getAttribute('aria-controls')); p.hidden = !p.hidden; h.setAttribute('aria-expanded', String(!p.hidden)); }
    const c = e.target.closest('[data-copy]');
    if (c){
      const src = $(c.dataset.copy); const text = src ? src.innerText : '';
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { c.textContent = 'Copied'; setTimeout(() => c.textContent = 'Copy', 1600); }, () => window.toast('Select the code and copy it'));
    }
  });

  let tt;
  window.toast = (m, bad) => {
    const el = $('toast'); if (!el) return;
    el.textContent = m; el.classList.toggle('bad', !!bad); el.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), bad ? 4200 : 2400);
  };
})();
