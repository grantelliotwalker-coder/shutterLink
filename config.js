/* Shutterlink shared config.
   The link page (index.html) renders from this; settings.html edits it.
   In the prototype it's saved in the browser (localStorage). Once this is a
   Sport Shutter plugin, load()/save() become calls to the account API. */

const SL_KEY = 'shutterlink:config:v1';

const SL_BRAND = {
  name: 'Sport Shutter',
  home: 'https://sportshutter.com/',
  blue: '#2326D3',
  logo: `<svg viewBox="0 0 86 90" aria-hidden="true"><g fill="currentColor">
    <path d="M28.5 0V58H0V28.5A28.5 28.5 0 0 1 28.5 0Z"/>
    <path d="M0 62H28.5V90A28.5 28.5 0 0 1 0 62Z"/>
    <path d="M57.5 0A28.5 28.5 0 0 1 86 28.5H57.5Z"/>
    <path d="M57.5 32H86V61.5A28.5 28.5 0 0 1 57.5 90Z"/>
    <circle cx="43" cy="45" r="13.5"/></g></svg>`,
};

const pic = (id, w, h) => `https://picsum.photos/id/${id}/${w}/${h}`;

/* Prints come from the photographer's Sport Shutter shop, not from settings. */
const SL_SHOP = [
  { id:1018, title:'Grose Valley', blurb:'Last light over the escarpment, shot from Pulpit Rock.', from:65 },
  { id:1015, title:'After the Rain', blurb:'Coxs River running high the morning after a storm.', from:65 },
  { id:1016, title:'Red Earth', blurb:'Late afternoon on the ridge line, Flinders Ranges.', from:80 },
  { id:1050, title:'Bondi Blue', blurb:'The first swimmers out before sunrise.', from:55 },
  { id:1039, title:'Wentworth Falls', blurb:'A long exposure from the base of the falls.', from:80 },
  { id:1043, title:'Megalong Mist', blurb:'Fog pooling in the valley at dawn.', from:65 },
  { id:1036, title:'First Snow', blurb:'Kosciuszko the morning after the first fall.', from:90 },
];

/* What each quick button / social can be. */
const SL_ACTIONS = {
  shop:      { label:'Prints',    hint:'Jumps to your prints' },
  film:      { label:'Watch',     hint:'Jumps to your latest film' },
  book:      { label:'Book',      hint:'Your booking page', needsUrl:true },
  instagram: { label:'Instagram', hint:'Uses your Instagram profile', social:true },
  youtube:   { label:'YouTube',   hint:'Uses your YouTube channel', social:true },
  tiktok:    { label:'TikTok',    hint:'Uses your TikTok profile', social:true },
  email:     { label:'Email',     hint:'Uses your email address', social:true },
  link:      { label:'Link',      hint:'Any web address', needsUrl:true },
};

const SL_ICONS = {
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><rect x="7" y="6" width="10" height="9"/><path d="M7 13l3-3 2 2 2-2 3 3"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.8 2.3 4.5 5 4.8"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
};

const SL_DEFAULTS = {
  profile: { name:'Mara Ellison', bio:'Landscapes and weddings from the Blue Mountains, NSW.' },
  look: { background:'photo', accent:SL_BRAND.blue, slideSeconds:5 },
  photos: [
    { url:pic(1018,920,1150), caption:'Grose Valley, last light', tint:'#1f2b33' },
    { url:pic(1015,920,1150), caption:'Coxs River after rain', tint:'#1c2c2a' },
    { url:pic(1016,920,1150), caption:'Red earth, Flinders Ranges', tint:'#3a2a22' },
    { url:pic(1050,920,1150), caption:'Bondi, 5:42am', tint:'#22303a' },
    { url:pic(1044,920,1150), caption:'Ceremony at Leura', tint:'#2b2824' },
  ],
  quick: [
    { type:'shop', label:'Prints', url:'' },
    { type:'book', label:'Book', url:'' },
    { type:'film', label:'Watch', url:'' },
    { type:'instagram', label:'Instagram', url:'' },
  ],
  sections: { shop:true, film:true, links:true, socials:true },
  shopCount: 5,
  film: { title:'Chasing first snow at Kosciuszko', meta:'YouTube, 12 min', url:'', thumb:pic(1036,920,518) },
  links: [
    { title:'Wedding portfolio', sub:'Now booking autumn 2027', url:'', thumb:pic(1062,120,120), on:true },
    { title:'Lightroom presets', sub:'The Mountain Light pack, 12 looks', url:'', thumb:pic(1043,120,120), on:true },
    { title:'Sunrise workshop, Feb 14', sub:'6 spots left at Govetts Leap', url:'', thumb:pic(1039,120,120), on:true },
    { title:'Monthly field notes', sub:'Where I shot and what I used', url:'', thumb:pic(1011,120,120), on:true },
  ],
  socials: { instagram:'', youtube:'', tiktok:'', email:'' },
};

function slClone(o){ return JSON.parse(JSON.stringify(o)); }

function slLoad(){
  try {
    const saved = JSON.parse(localStorage.getItem(SL_KEY) || 'null');
    if (saved) return { ...slClone(SL_DEFAULTS), ...saved,
      look:{ ...SL_DEFAULTS.look, ...saved.look },
      sections:{ ...SL_DEFAULTS.sections, ...saved.sections },
      socials:{ ...SL_DEFAULTS.socials, ...saved.socials } };
  } catch(_) {}
  return slClone(SL_DEFAULTS);
}
function slSave(cfg){ try { localStorage.setItem(SL_KEY, JSON.stringify(cfg)); } catch(_) {} }
function slReset(){ try { localStorage.removeItem(SL_KEY); } catch(_) {} return slClone(SL_DEFAULTS); }

/* Mix two hex colours; t = share of b. */
function slMix(a, b, t){
  const p = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
  const [x,y] = [p(a), p(b)];
  return '#' + x.map((v,i) => Math.round(v + (y[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
function slEsc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
