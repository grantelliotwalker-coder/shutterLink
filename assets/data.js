/* ShutterLink data layer
   Every read and write the pages make goes through here, in one of three modes:

   local  This browser only (the prototype as it started). Default.
   sim    A simulated Sport Shutter server running in this browser. It runs the real
          server/shutterlink-api.js against a pretend database, with pretend logins.
          Open any page with ?backend=sim, or use the simulator.
   live   The real Sport Shutter API on the same domain (sportshutter.com/api/...).
          Set window.SHUTTERLINK_BACKEND = 'live' before this file loads, or ?backend=live.

   The pages only call SLData functions, so switching modes changes nothing else. */
(function(){
'use strict';

const params = new URLSearchParams(location.search);
// On sportshutter.com itself the pages talk to the real API unless told otherwise.
const MODE = (params.get('backend') || window.SHUTTERLINK_BACKEND || (/(^|\.)sportshutter\.com$/.test(location.hostname) ? 'live' : 'local')).toLowerCase();
const REMOTE = MODE === 'sim' || MODE === 'live';
const API_BASE = window.SHUTTERLINK_API_BASE || '';
const LOGIN_URL = window.SHUTTERLINK_LOGIN_URL || '/login';
const PUBLIC_ORIGIN = window.SHUTTERLINK_PUBLIC_ORIGIN || 'https://sportshutter.com';
const K = { db:'shutterlink:sim:db', session:'shutterlink:sim:session', config:'shutterlink:sim:config' };
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('shutterlink-sim') : null;
const who = /settings/.test(location.pathname) ? 'Settings' : /simulator/.test(location.pathname) ? 'Console' : 'Public page';

/* ---------- Simulated Sport Shutter ---------- */
const SIM_USERS = {
  u_grant: { id:'u_grant', name:'Grant Walker', email:'grant@example.com' },
  u_mia:   { id:'u_mia',   name:'Mia Chen',     email:'mia@example.com' },
};
function seedState(){
  const grant = SL.clone(SL.DEFAULTS);
  grant.profile.name = 'Grant Walker';
  const mia = SL.clone(SL.DEFAULTS);
  Object.assign(mia.profile, { name:'Mia Chen', bio:'Surf and sport photography from Byron Bay.', location:'Byron Bay, NSW', status:{ on:true, text:'Shooting the summer surf series' } });
  mia.theme = Object.assign(mia.theme, { preset:'day', colors:{ ...SL.THEMES[1].colors }, font:'technical', radius:10, photoTint:30 });
  mia.cover.style = 'framed';
  // Mia is a different photographer: give her the placeholder photos, not Grant's
  const pic = (id, w, h) => `https://picsum.photos/id/${id}/${w}/${h}`;
  mia.profile.avatar = pic(64, 400, 400);
  mia.cover.photos = [1015, 1050, 1053, 1039].map(id => ({ url: pic(id, 1080, 1350), caption:'' }));
  mia.gallery.photos = [1019, 1021, 1022, 1028, 1033, 1035].map(id => ({ url: pic(id, 900, 900), caption:'' }));
  mia.film.thumb = pic(1036, 1280, 720);
  mia.links.forEach((l, i) => { l.thumb = pic([1062, 1043, 1039, 1011][i] || 1011, 160, 160); });
  const t = new Date().toISOString();
  return {
    profiles: {
      u_grant: { handle:'grantwalker', settings:grant, revision:1, updatedAt:t },
      u_mia:   { handle:'miachen', settings:mia, revision:1, updatedAt:t },
    },
    aliases: { grantwalkerphoto:'u_grant' },
    enquiries: [],
    seed: 2,
  };
}
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(_) {} };
function simState(){ let s = read(K.db, null); if (!s || s.seed !== 2){ s = seedState(); write(K.db, s); write(K.session, 'u_grant'); } return s; }
const simConfig = () => Object.assign({ latency:180, offline:false, failNext:false }, read(K.config, {}));
let simApiP = null;
function loadScript(src){
  return new Promise((res, rej) => {
    const base = (document.currentScript && document.currentScript.src) || '';
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}
const here = (() => { const s = document.currentScript && document.currentScript.src; return s ? s.replace(/assets\/data\.js.*$/, '') : ''; })();
function simApi(){
  if (simApiP) return simApiP;
  simApiP = Promise.all([
    window.ShutterLinkApi ? 0 : loadScript(here + 'server/shutterlink-api.js'),
    window.ShutterLinkMemoryStore ? 0 : loadScript(here + 'server/memory-store.js'),
  ]).then(() => window.ShutterLinkApi.createShutterLinkApi({
    // Every request re-reads the pretend database, so all tabs and frames share it.
    store: new Proxy({}, { get: (_, fn) => (...a) => {
      const st = window.ShutterLinkMemoryStore.createMemoryStore({ state: simState(), persist: s => write(K.db, s) });
      return st[fn](...a);
    } }),
    images: { put: async (userId, blob) => {
      // The real server would put the photo in Sport Shutter's storage and return an https address.
      const ref = await SL.putImage(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }), 4096, .92);
      return { url: ref };
    } },
    onEvent: (type, payload) => bc && bc.postMessage({ kind:'event', type, payload, at: Date.now() }),
  }));
  return simApiP;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let seq = 0;
function summarise(body){
  if (body instanceof Blob) return `<${body.type || 'binary'} photo, ${Math.round(body.size / 1024)} KB>`;
  return body === undefined ? null : body;
}
async function simCall(method, path, body, headers){
  const id = (++seq) + '-' + Math.random().toString(36).slice(2, 6), t0 = performance.now();
  simState();   // first visit: create the pretend database and sign in the demo photographer
  const c = simConfig();
  const log = (status, resBody) => bc && bc.postMessage({ kind:'request', id, from:who, method, path, status, ms: Math.round(performance.now() - t0), req: summarise(body), res: resBody, signedIn: read(K.session, '') || null, at: Date.now() });
  await wait(c.latency + Math.random() * c.latency * .4);
  if (c.offline){ log(0, { error:{ code:'offline', message:'No response (server unreachable)' } }); throw new TypeError('Failed to fetch'); }
  if (c.failNext){ write(K.config, Object.assign(c, { failNext:false })); const r = { status:500, body:{ error:{ code:'server_error', message:'Simulated server error.' } } }; log(500, r.body); return r; }
  const api = await simApi();
  const uid = read(K.session, '');
  const r = await api.handle({ method, path, body, headers, user: uid && SIM_USERS[uid] ? SIM_USERS[uid] : null, ip:'sim' });
  log(r.status, r.body);
  return { status: r.status, body: r.body };
}

/* ---------- Real Sport Shutter ---------- */
async function liveCall(method, path, body, headers){
  const isBlob = body instanceof Blob;
  const res = await fetch(API_BASE + path, {
    method, credentials:'same-origin', cache:'no-store',
    headers: Object.assign(isBlob ? {} : { 'content-type':'application/json' }, headers),
    body: body == null ? undefined : isBlob ? body : JSON.stringify(body),
  });
  let data = null; try { data = await res.json(); } catch(_) {}
  return { status: res.status, body: data };
}

async function call(method, path, body, extra){
  const headers = Object.assign({ 'X-ShutterLink':'1' }, extra || {});
  try { return await (MODE === 'sim' ? simCall : liveCall)(method, path, body, headers); }
  catch(_) { return { status:0, body:{ error:{ code:'offline', message:'Couldn’t reach Sport Shutter. Check your connection.' } } }; }
}
const msg = r => (r.body && r.body.error && r.body.error.message) || (r.status ? `Error ${r.status}` : 'Couldn’t reach Sport Shutter.');

/* ---------- What the pages use ---------- */
let revision = null, me = null;
const SLData = {
  mode: MODE, remote: REMOTE,

  /* The signed-in person, or null. Local mode is always "you". */
  async me(){
    if (!REMOTE) return { userId:'local', name:'', handle:null, local:true };
    const r = await call('GET', '/api/shutterlink/me');
    if (r.status === 401) return (me = null);
    if (r.status !== 200) throw new Error(msg(r));
    return (me = r.body);
  },

  /* Your settings for editing. First time: the defaults, with your name filled in. */
  async loadSettings(){
    if (!REMOTE) return { cfg: SL.load(), fresh:false };
    const r = await call('GET', '/api/shutterlink/settings');
    if (r.status !== 200) throw Object.assign(new Error(msg(r)), { status: r.status });
    revision = r.body.revision;
    if (!r.body.settings){
      const cfg = SL.clone(SL.DEFAULTS);
      if (me && me.name) cfg.profile.name = me.name;
      return { cfg, fresh:true, handle: r.body.handle };
    }
    return { cfg: SL.normalise(SL.fromJSON(JSON.stringify(r.body.settings))), fresh:false, handle: r.body.handle };
  },

  /* Save everything. Returns { ok } or { ok:false, status, message }. */
  async saveSettings(cfg){
    if (!REMOTE){ const r = SL.save(cfg); return r.ok ? { ok:true } : { ok:false, status: r.full ? 507 : 500, message: r.full ? 'This browser is out of space for settings.' : 'Couldn’t save in this browser.' }; }
    const r = await call('PUT', '/api/shutterlink/settings', { settings: cfg, revision });
    if (r.status === 200){ revision = r.body.revision; if (me) me.handle = r.body.handle; return { ok:true, revision, handle: r.body.handle }; }
    return { ok:false, status: r.status, message: msg(r), errors: r.body && r.body.errors };
  },
  /* After a conflict: take the latest revision from the server so the next save wins. */
  async refreshRevision(){ if (!REMOTE) return; const r = await call('GET', '/api/shutterlink/settings'); if (r.status === 200) revision = r.body.revision; return r.body; },

  /* Store a photo and get back what to put in the settings. */
  async uploadImage(file, max, q){
    if (!REMOTE) return SL.putImage(file, max, q);
    const blob = await SL.imageBlob(file, max, q);
    const r = await call('POST', '/api/shutterlink/images', blob, { 'content-type': blob.type || 'image/jpeg' });
    if (r.status !== 201) throw new Error(msg(r));
    return r.body.url;
  },

  /* Change the personal link name. */
  async setHandle(handle){
    const r = await call('PUT', '/api/shutterlink/handle', { handle });
    if (r.status === 200){ if (me) me.handle = r.body.handle; return { ok:true, handle: r.body.handle }; }
    return { ok:false, message: msg(r) };
  },

  /* A photographer's public page. */
  async loadPublic(handle){
    if (!REMOTE) return { cfg: SL.load() };
    if (!handle) return { notFound:true, message:'No page was named in this address.' };
    const r = await call('GET', '/api/public/pages/' + encodeURIComponent(handle));
    if (r.status === 301) return { movedTo: r.body.movedTo };
    if (r.status === 404) return { notFound:true, message: msg(r) };
    if (r.status !== 200) return { error: msg(r) };
    return { cfg: SL.normalise(SL.fromJSON(JSON.stringify(r.body.settings))), handle: r.body.handle };
  },

  /* A visitor's enquiry, delivered to the photographer's Sport Shutter inbox. */
  async sendEnquiry(handle, data){
    const r = await call('POST', '/api/public/pages/' + encodeURIComponent(handle) + '/enquiries', data);
    return r.status === 202 ? { ok:true } : { ok:false, message: msg(r), errors: r.body && r.body.errors };
  },

  /* Which page this address is for: /@name on the real site, ?u=name elsewhere. */
  handleFromLocation(){
    const m = /\/@([a-z0-9._-]+)\/?$/i.exec(location.pathname);
    return ((m && m[1]) || params.get('u') || '').toLowerCase() || null;
  },
  /* Links between the pages keep the same mode. */
  link(file, extra){
    const q = new URLSearchParams();
    if (MODE !== 'local') q.set('backend', MODE);
    for (const k in (extra || {})) if (extra[k] != null) q.set(k, extra[k]);
    const s = q.toString().replace(/=(&|$)/g, '$1');
    return file + (s ? '?' + s : '');
  },
  /* The address people share. */
  publicUrl(handle){
    if (MODE === 'live') return `${PUBLIC_ORIGIN}/@${handle}`;
    if (MODE === 'sim') return location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'index.html?backend=sim&u=' + handle;
    return location.href.split(/[?#]/)[0].replace(/index\.html$/, '');
  },
  prettyUrl(handle){ return `sportshutter.com/@${handle}`; },
  loginUrl(){ return MODE === 'sim' ? null : LOGIN_URL + '?next=' + encodeURIComponent(location.pathname + location.search); },

  /* Simulator controls */
  sim: {
    users: SIM_USERS,
    state: simState,
    session: () => read(K.session, '') || null,
    signIn(id){ write(K.session, id || ''); bc && bc.postMessage({ kind:'session', userId: id || null, at: Date.now() }); },
    config: simConfig,
    setConfig(c){ write(K.config, Object.assign(simConfig(), c)); bc && bc.postMessage({ kind:'config', at: Date.now() }); },
    reset(){ write(K.db, seedState()); write(K.session, 'u_grant'); bc && bc.postMessage({ kind:'reset', at: Date.now() }); },
    call: (method, path, body) => simCall(method, path, body, { 'X-ShutterLink':'1' }),
    // Pretend the photographer edited from another device: bumps the revision.
    async editElsewhere(userId){
      const s = simState(), p = s.profiles[userId]; if (!p) return;
      p.revision += 1; p.updatedAt = new Date().toISOString(); write(K.db, s);
      bc && bc.postMessage({ kind:'event', type:'settings.saved', payload:{ userId, handle:p.handle, revision:p.revision, note:'edited on another device' }, at: Date.now() });
    },
  },
  channel: bc,
};
window.SLData = SLData;
})();
