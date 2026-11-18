/* Shutterlink core — shared by the link page and settings.
   Everything the page shows comes from one config object. In this prototype
   it is saved in the browser; as a Sport Shutter plugin, SL.load / SL.save
   become calls to the account API and nothing else needs to change. */
(function(){
'use strict';

const KEY = 'shutterlink:v2';

/* ---------- Brand (host site) ---------- */
const BRAND = {
  name: 'Sport Shutter',
  home: 'https://sportshutter.com/',
  blue: '#2326D3',
  logo: '<svg viewBox="0 0 86 90" aria-hidden="true"><g fill="currentColor"><path d="M28.5 0V58H0V28.5A28.5 28.5 0 0 1 28.5 0Z"/><path d="M0 62H28.5V90A28.5 28.5 0 0 1 0 62Z"/><path d="M57.5 0A28.5 28.5 0 0 1 86 28.5H57.5Z"/><path d="M57.5 32H86V61.5A28.5 28.5 0 0 1 57.5 90Z"/><circle cx="43" cy="45" r="13.5"/></g></svg>',
};

/* ---------- Colour maths ---------- */
function rgb(h){
  h = String(h||'').trim().replace('#','');
  if (h.length === 3) h = h.split('').map(c => c+c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0,0,0];
  return [0,2,4].map(i => parseInt(h.slice(i,i+2),16));
}
const hex = a => '#' + a.map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mix = (a,b,t) => { const x=rgb(a), y=rgb(b); return hex(x.map((v,i) => v + (y[i]-v)*t)); };
function lum(h){
  return rgb(h).map(v => { v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); })
    .reduce((s,v,i) => s + v*[.2126,.7152,.0722][i], 0);
}
const contrast = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((m,n) => n-m); return (x+.05)/(y+.05); };
const isDark = h => lum(h) < .2;
/* Nudge fg toward black or white until it reads on bg. */
function legible(fg, bg, min=4.5){
  const to = isDark(bg) ? '#ffffff' : '#000000';
  let c = fg, t = 0;
  while (contrast(c,bg) < min && t < 1){ t += .05; c = mix(fg, to, t); }
  return c;
}
const isHex = s => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s||'').trim());

/* Turn four chosen colours into the full token set the page uses. */
function tokens(c, opts={}){
  const bg = c.bg, text = legible(c.text, bg, 7);
  const dark = isDark(bg);
  const surface = c.surface;
  const onAccent = contrast('#ffffff', c.accent) >= contrast('#14151f', c.accent) ? '#ffffff' : '#14151f';
  return {
    '--bg': bg,
    '--surface': surface,
    '--surface-2': mix(surface, text, dark ? .06 : .035),
    '--border': mix(bg, text, dark ? .14 : .11),
    '--border-strong': mix(bg, text, dark ? .26 : .22),
    '--text': text,
    '--text-dim': legible(mix(text, bg, .28), bg, 4.5),
    '--text-faint': legible(mix(text, bg, .42), bg, 3.2),
    '--accent': c.accent,
    '--on-accent': onAccent,
    '--accent-text': legible(c.accent, bg, 4.5),
    '--accent-soft': mix(bg, c.accent, dark ? .2 : .1),
    '--scrim': dark ? 'rgba(0,0,0,.55)' : 'rgba(20,22,40,.38)',
    '--shadow': dark ? '0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.25)' : '0 1px 2px rgba(16,24,40,.05), 0 10px 30px rgba(16,24,40,.08)',
    'color-scheme': dark ? 'dark' : 'light',
  };
}

/* ---------- Theme presets ---------- */
const THEMES = [
  { id:'night',    name:'Sport Shutter Night', colors:{ bg:'#0f1120', surface:'#181b2e', text:'#eef0fb', accent:'#2326D3' } },
  { id:'day',      name:'Sport Shutter Day',   colors:{ bg:'#f6f6f9', surface:'#ffffff', text:'#16172b', accent:'#2326D3' } },
  { id:'gallery',  name:'Gallery',             colors:{ bg:'#fbfbf9', surface:'#ffffff', text:'#141414', accent:'#141414' } },
  { id:'graphite', name:'Graphite',            colors:{ bg:'#1a1b1e', surface:'#232428', text:'#ececec', accent:'#e8e8e8' } },
  { id:'harbour',  name:'Harbour',             colors:{ bg:'#e8edf0', surface:'#f7f9fa', text:'#1b2a33', accent:'#1f6f8b' } },
  { id:'eucalypt', name:'Eucalypt',            colors:{ bg:'#121915', surface:'#1a231e', text:'#e5eee8', accent:'#86b89a' } },
  { id:'ember',    name:'Ember',               colors:{ bg:'#17110f', surface:'#221916', text:'#f4ebe6', accent:'#ff6a3d' } },
  { id:'paper',    name:'Newsprint',           colors:{ bg:'#efede8', surface:'#f8f7f4', text:'#1e1d1b', accent:'#c2262e' } },
];

/* ---------- Type pairs ---------- */
const FONTS = [
  { id:'modern',    name:'Modern',    display:'Familjen Grotesk', body:'Familjen Grotesk', dw:700, ls:'-.035em', q:'family=Familjen+Grotesk:wght@400;500;600;700' },
  { id:'editorial', name:'Editorial', display:'Newsreader', body:'Inter Tight', dw:500, ls:'-.03em', q:'family=Newsreader:opsz,wght@6..72,500&family=Inter+Tight:wght@400;500;600;700' },
  { id:'gallery',   name:'Gallery',   display:'Cormorant Garamond', body:'Karla', dw:600, ls:'-.02em', q:'family=Cormorant+Garamond:wght@600&family=Karla:wght@400;500;600;700' },
  { id:'wide',      name:'Wide',      display:'Archivo', body:'Archivo', dw:800, ls:'-.02em', stretch:'125%', q:'family=Archivo:wdth,wght@100..125,400..800' },
  { id:'technical', name:'Technical', display:'Space Grotesk', body:'Space Grotesk', dw:700, ls:'-.04em', q:'family=Space+Grotesk:wght@400;500;600;700' },
  { id:'classic',   name:'Classic',   display:'Playfair Display', body:'Source Sans 3', dw:700, ls:'-.02em', q:'family=Playfair+Display:wght@700&family=Source+Sans+3:wght@400;500;600;700' },
];
const fontUrl = f => `https://fonts.googleapis.com/css2?${f.q}&display=swap`;
function loadFont(f, doc=document){
  const id = 'sl-font-' + f.id;
  if (doc.getElementById(id)) return;
  const l = doc.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = fontUrl(f);
  doc.head.appendChild(l);
}

/* Apply theme + type + shape to a document root. tint = colour sampled from the cover photo. */
function applyTheme(cfg, root=document.documentElement, tint){
  const t = cfg.theme;
  const c = { ...t.colors };
  const s = (+t.photoTint || 0) / 100;
  if (tint && s > 0){
    const dark = isDark(c.bg);
    const norm = dark ? mix(tint, '#05060a', .55) : mix(tint, '#ffffff', .78);
    c.bg = mix(c.bg, norm, s * .9);
    c.surface = mix(c.surface, norm, s * .55);
  }
  const tk = tokens(c);
  for (const k in tk) k === 'color-scheme' ? root.style.colorScheme = tk[k] : root.style.setProperty(k, tk[k]);
  const f = FONTS.find(x => x.id === t.font) || FONTS[0];
  loadFont(f, root.ownerDocument);
  root.style.setProperty('--font-display', `"${f.display}", system-ui, sans-serif`);
  root.style.setProperty('--font-body', `"${f.body}", system-ui, sans-serif`);
  root.style.setProperty('--display-weight', f.dw);
  root.style.setProperty('--display-tracking', f.ls);
  root.style.setProperty('--display-stretch', f.stretch || '100%');
  const r = Math.max(0, Math.min(32, +t.radius || 0));
  root.style.setProperty('--radius', r + 'px');
  root.style.setProperty('--radius-sm', Math.round(r * .6) + 'px');
  root.style.setProperty('--radius-btn', t.buttonShape === 'circle' ? '50%' : Math.round(Math.max(r*.7, 6)) + 'px');
  root.dataset.dark = isDark(c.bg) ? '1' : '0';
  return tk;
}

/* ---------- Images ---------- */
const pic = (id, w, h) => `https://picsum.photos/id/${id}/${w}/${h}`;
/* Resize a picsum placeholder; any other URL (or uploaded photo) is used as-is. */
function sized(url, w, h){
  const m = /^https:\/\/picsum\.photos\/id\/(\d+)\//.exec(url || '');
  return m ? pic(m[1], w, h) : (url || '');
}
/* Read an uploaded file, shrink it and return a JPEG data URL small enough to store. */
function readImage(file, max=1600, q=.82){
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error('That file is not an image.'));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('Could not read that file.'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => rej(new Error('Could not open that image.'));
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', q));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
/* Average colour of an image (needs CORS for remote images; data URLs always work). */
function sampleColour(url){
  return new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 10;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0, 10, 10);
        const d = x.getImageData(0,0,10,10).data; const s=[0,0,0];
        for (let i=0;i<d.length;i+=4){ s[0]+=d[i]; s[1]+=d[i+1]; s[2]+=d[i+2]; }
        res(hex(s.map(v => v/100)));
      } catch(_) { res(null); }
    };
    im.onerror = () => res(null);
    im.src = url;
  });
}

/* ---------- Shop catalogue (comes from the Sport Shutter shop, not settings) ---------- */
const SHOP = [
  { id:'grose',    pid:1018, title:'Grose Valley',    blurb:'Last light over the escarpment, shot from Pulpit Rock.', from:65 },
  { id:'rain',     pid:1015, title:'After the Rain',  blurb:'Coxs River running high the morning after a storm.', from:65 },
  { id:'redearth', pid:1016, title:'Red Earth',       blurb:'Late afternoon on the ridge line, Flinders Ranges.', from:80 },
  { id:'bondi',    pid:1050, title:'Bondi Blue',      blurb:'The first swimmers out before sunrise.', from:55 },
  { id:'falls',    pid:1039, title:'Wentworth Falls', blurb:'A long exposure from the base of the falls.', from:80 },
  { id:'mist',     pid:1043, title:'Megalong Mist',   blurb:'Fog pooling in the valley at dawn.', from:65 },
  { id:'snow',     pid:1036, title:'First Snow',      blurb:'Kosciuszko the morning after the first fall.', from:90 },
  { id:'coast',    pid:1053, title:'South Coast',     blurb:'Low tide and long shadows near Kiama.', from:65 },
];
const PRINT_OPTIONS = {
  sizes:  [ { id:'a4', label:'A4', note:'21 × 30 cm', mult:1 }, { id:'a3', label:'A3', note:'30 × 42 cm', mult:1.6 }, { id:'a2', label:'A2', note:'42 × 59 cm', mult:2.5 } ],
  papers: [ { id:'rag', label:'Cotton rag', note:'Matte, deep blacks', add:0 }, { id:'lustre', label:'Lustre', note:'Soft sheen', add:-5 } ],
  frames: [ { id:'none', label:'Unframed', add:0, css:'none' }, { id:'black', label:'Black', add:90, css:'#141414' }, { id:'oak', label:'Oak', add:110, css:'#b98a57' }, { id:'white', label:'White', add:90, css:'#f4f3ef' } ],
};
const CURRENCIES = ['AUD','NZD','USD','GBP','EUR','CAD'];
function money(n, cur='AUD'){
  const loc = { AUD:'en-AU', NZD:'en-NZ', USD:'en-US', GBP:'en-GB', EUR:'en-IE', CAD:'en-CA' }[cur] || 'en-AU';
  try { return new Intl.NumberFormat(loc, { style:'currency', currency:cur, maximumFractionDigits:0 }).format(n); }
  catch(_) { return '$' + Math.round(n); }
}

/* ---------- Actions & icons ---------- */
const ACTIONS = {
  shop:       { label:'Prints',     hint:'Jumps to your prints' },
  gallery:    { label:'Work',       hint:'Jumps to your gallery' },
  film:       { label:'Watch',      hint:'Plays your latest film' },
  enquire:    { label:'Enquire',    hint:'Jumps to your enquiry form' },
  newsletter: { label:'Subscribe',  hint:'Jumps to your newsletter signup' },
  instagram:  { label:'Instagram',  hint:'Uses your Instagram address', social:true },
  tiktok:     { label:'TikTok',     hint:'Uses your TikTok address', social:true },
  youtube:    { label:'YouTube',    hint:'Uses your YouTube address', social:true },
  email:      { label:'Email',      hint:'Uses your email address', social:true },
  link:       { label:'Link',       hint:'Any web address', needsUrl:true },
};
const SOCIALS = {
  instagram:{ label:'Instagram', ph:'https://instagram.com/yourname' },
  tiktok:   { label:'TikTok',    ph:'https://tiktok.com/@yourname' },
  youtube:  { label:'YouTube',   ph:'https://youtube.com/@yourname' },
  vimeo:    { label:'Vimeo',     ph:'https://vimeo.com/yourname' },
  facebook: { label:'Facebook',  ph:'https://facebook.com/yourpage' },
  pinterest:{ label:'Pinterest', ph:'https://pinterest.com/yourname' },
  website:  { label:'Website',   ph:'https://yoursite.com' },
  email:    { label:'Email',     ph:'you@example.com' },
};
const s = (d, extra='') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICONS = {
  shop: s('<rect x="4" y="3" width="16" height="18" rx="1.5"/><rect x="7" y="6" width="10" height="9"/><path d="M7 13l3-3 2 2 2-2 3 3"/>'),
  gallery: s('<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>'),
  film: s('<path d="M8 5.5v13l10.5-6.5z"/>'),
  enquire: s('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  newsletter: s('<path d="M4 19V8l8-4 8 4v11z"/><path d="M4 8l8 6 8-6"/>'),
  instagram: s('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
  tiktok: s('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.8 2.3 4.5 5 4.8"/>'),
  youtube: s('<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'),
  vimeo: s('<path d="M3 8.5l1.2 1.3c1-.8 1.9-1.4 2.4-.4.8 1.6 1.8 7.4 3.6 7.4 2.6 0 6.8-6.5 7.3-9.6.5-3.2-2.8-3.4-4.7-1.6 1.6-.7 3.4.3 1.6 3.5-1.6 2.9-2.8 3.4-3.4 1.5-.6-1.9-1.1-6.4-2.8-6.8C6.6 3.5 4.6 7 3 8.5z"/>'),
  facebook: s('<path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z"/>'),
  pinterest: s('<circle cx="12" cy="12" r="9"/><path d="M10.5 20l1.6-7.2M11 14.5c.6 1.1 3.4 1.5 4.6-1.4 1.1-2.8-.6-5.6-3.6-5.6-3.3 0-5 2.3-4.5 4.8"/>'),
  website: s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.8 5.8 3.8 9s-1.2 6.2-3.8 9c-2.6-2.8-3.8-5.8-3.8-9S9.4 5.8 12 3z"/>'),
  email: s('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/>'),
  link: s('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  share: s('<path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>', 'stroke-width="2"'),
  bag: s('<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>', 'stroke-width="2"'),
  gear: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 'stroke-width="2"'),
  chevron: s('<path d="M9 6l6 6-6 6"/>', 'stroke-width="2"'),
  down: s('<path d="M6 9l6 6 6-6"/>', 'stroke-width="2"'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="2"'),
  pin: s('<path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  copy: s('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.2"'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor"/></svg>',
  minus: s('<path d="M6 12h12"/>', 'stroke-width="2"'),
  plus: s('<path d="M12 6v12M6 12h12"/>', 'stroke-width="2"'),
};

/* ---------- Defaults (the demo photographer) ---------- */
const DEFAULTS = {
  v: 2,
  profile: {
    name: 'Mara Ellison',
    bio: 'Landscapes and weddings from the Blue Mountains, NSW.',
    location: 'Katoomba, NSW',
    avatar: pic(64, 400, 400),
    status: { on: true, text: 'Booking autumn 2027 weddings' },
  },
  theme: { preset:'night', colors:{ ...THEMES[0].colors }, font:'modern', radius:18, photoTint:65, buttonShape:'circle', linkStyle:'list', align:'left' },
  cover: {
    style: 'full', seconds: 5, captions: true, overlay: 55,
    photos: [
      { url:pic(1018,1080,1350), caption:'Grose Valley, last light' },
      { url:pic(1015,1080,1350), caption:'Coxs River after rain' },
      { url:pic(1016,1080,1350), caption:'Red earth, Flinders Ranges' },
      { url:pic(1050,1080,1350), caption:'Bondi, 5:42am' },
      { url:pic(1044,1080,1350), caption:'Ceremony at Leura' },
    ],
  },
  quick: [
    { type:'shop', label:'Prints', url:'' },
    { type:'enquire', label:'Book', url:'' },
    { type:'film', label:'Watch', url:'' },
    { type:'instagram', label:'Instagram', url:'' },
  ],
  sections: [
    { id:'shop',       on:true,  title:'Prints' },
    { id:'gallery',    on:true,  title:'Recent work' },
    { id:'film',       on:true,  title:'Latest film' },
    { id:'links',      on:true,  title:'More from me' },
    { id:'enquire',    on:true,  title:'Book a session' },
    { id:'newsletter', on:true,  title:'Field notes' },
    { id:'socials',    on:true,  title:'Follow along' },
  ],
  shop: { featured:['grose','rain','redearth','bondi','falls'], currency:'AUD', showPrices:true },
  gallery: { columns:3, photos:[1019,1021,1022,1028,1033,1035,1038,1040,1041].map((id,i) => ({ url:pic(id,900,900), caption:['Wolgan Valley','Sunrise, Narrow Neck','Leura Cascades','Evans Lookout','The Three Sisters','Kanangra Walls','Blackheath','Mount Banks','Hanging Rock'][i] })) },
  film: { url:'', title:'Chasing first snow at Kosciuszko', meta:'12 min', thumb:pic(1036,1280,720) },
  links: [
    { title:'Wedding portfolio', sub:'Full galleries from 2025 and 2026', url:'', thumb:pic(1062,160,160), on:true, badge:'' },
    { title:'Lightroom presets', sub:'The Mountain Light pack, 12 looks', url:'', thumb:pic(1043,160,160), on:true, badge:'New' },
    { title:'Sunrise workshop, 14 Feb', sub:'6 spots left at Govetts Leap', url:'', thumb:pic(1039,160,160), on:true, badge:'' },
    { title:'Gear I use', sub:'Cameras, lenses and bags', url:'', thumb:pic(1011,160,160), on:true, badge:'' },
  ],
  enquire: { intro:'Tell me a little about your day or project and I’ll get back to you with availability and pricing.', types:'Wedding, Elopement, Portrait, Print commission', reply:'I usually reply within two days.', to:'' },
  newsletter: { blurb:'One email a month: where I shot, what I used, and first look at new prints.', button:'Subscribe' },
  socials: { instagram:'', tiktok:'', youtube:'', vimeo:'', facebook:'', pinterest:'', website:'', email:'' },
  page: { showGear:true, footer:true },
};

/* ---------- Storage ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
function merge(base, over){
  if (!isObj(over)) return base;
  const out = { ...base };
  for (const k in over){
    if (!(k in base)) continue;              // drop unknown keys
    out[k] = isObj(base[k]) ? merge(base[k], over[k]) : (Array.isArray(base[k]) ? (Array.isArray(over[k]) ? over[k] : base[k]) : (typeof over[k] === typeof base[k] ? over[k] : base[k]));
  }
  return out;
}
function normalise(c){
  // make sure every section exists exactly once, in the saved order
  const known = DEFAULTS.sections.map(s => s.id);
  const seen = new Set();
  c.sections = c.sections.filter(s => s && known.includes(s.id) && !seen.has(s.id) && seen.add(s.id))
    .concat(DEFAULTS.sections.filter(s => !seen.has(s.id)).map(s => ({ ...s, on:false })));
  c.quick = c.quick.filter(q => q && ACTIONS[q.type]).slice(0, 4);
  for (const k of ['bg','surface','text','accent']) if (!isHex(c.theme.colors[k])) c.theme.colors[k] = DEFAULTS.theme.colors[k];
  return c;
}
function load(){
  try { const raw = localStorage.getItem(KEY); if (raw) return normalise(merge(clone(DEFAULTS), JSON.parse(raw))); } catch(_) {}
  return clone(DEFAULTS);
}
function save(cfg){
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); return { ok:true }; }
  catch(e) { return { ok:false, full: e && (e.name === 'QuotaExceededError' || e.code === 22) }; }
}
function reset(){ try { localStorage.removeItem(KEY); } catch(_) {} return clone(DEFAULTS); }
function fromJSON(text){ return normalise(merge(clone(DEFAULTS), JSON.parse(text))); }
function bytes(cfg){ return new Blob([JSON.stringify(cfg)]).size; }

/* ---------- Small helpers ---------- */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function href(raw){
  const u = String(raw || '').trim();
  if (!u) return '';
  if (/^mailto:|^tel:/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;
  return '';
}
function youtubeId(u){
  const m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(u || '');
  return m ? m[1] : null;
}

window.SL = { KEY, BRAND, THEMES, FONTS, SHOP, PRINT_OPTIONS, CURRENCIES, ACTIONS, SOCIALS, ICONS, DEFAULTS,
  rgb, hex, mix, lum, contrast, isDark, legible, isHex, tokens, applyTheme, loadFont, fontUrl,
  pic, sized, readImage, sampleColour, money, load, save, reset, clone, fromJSON, bytes, esc, href, youtubeId, normalise };
})();
