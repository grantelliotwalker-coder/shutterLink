/* Simulator · Code flow
   Runs one request through the real server/shutterlink-api.js against the pretend
   database, records everything it touches, and lays it out step by step:
   page code → request → login → API code → database → events → response → page. */
(function(){
'use strict';
const $ = id => document.getElementById(id), esc = SL.esc, sim = SLData.sim;
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Views ---------- */
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
  const v = b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $('viewFlow').hidden = v !== 'flow'; $('viewLive').hidden = v !== 'live';
  if (v === 'live' && window.startLive) window.startLive();
  if (v === 'flow') fillWho();
});

/* ---------- Source files (shown with their real line numbers) ---------- */
const SRC = {};
async function source(file){ if (!SRC[file]) SRC[file] = (await (await fetch(file + '?v=3.2', { cache:'no-store' })).text()).split('\n'); return SRC[file]; }
function block(lines, start, end){
  const i = lines.findIndex(l => l.includes(start)); if (i < 0) return null;
  let j = i; while (j < lines.length - 1 && !end(lines[j], j - i)) j++;
  return { from: i + 1, lines: lines.slice(i, j + 1) };
}
const apiBlock = (lines, marker) => marker === 'handle()' ? block(lines, 'async function handle(req) {', l => l === '    }') : block(lines, marker, l => l.trim() === '}],');
const clientBlock = (lines, marker) => block(lines, marker, (l, k) => k > 0 && l === '  },');

/* tiny JavaScript highlighter */
function hl(line){
  const re = /(\/\/.*$)|('(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*")|\b(const|let|var|async|await|return|if|else|try|catch|throw|new|function|for|of|in|typeof|null|true|false)\b|\b(\d+)\b/g;
  let out = '', last = 0, m;
  while ((m = re.exec(line))){
    out += esc(line.slice(last, m.index));
    out += m[1] ? `<em class="c">${esc(m[1])}</em>` : m[2] ? `<em class="s">${esc(m[2])}</em>` : m[3] ? `<em class="k">${m[3]}</em>` : `<em class="n">${m[4]}</em>`;
    last = re.lastIndex;
  }
  return out + esc(line.slice(last));
}
function codeView(b, hits){
  if (!b) return '';
  return `<div class="fcode">${b.lines.map((l, k) => `<div class="ln${hits && hits.some(h => l.includes(h)) ? ' hit' : ''}"><i>${b.from + k}</i><span>${hl(l)}</span></div>`).join('')}</div>`;
}
const plain = t => `<pre class="fcode plain">${esc(t)}</pre>`;

/* Keep long settings readable: shallow detail, long lists and text shortened. */
function brief(v, depth = 0){
  if (typeof v === 'string') return v.length > 70 ? v.slice(0, 67) + '…' : v;
  if (Array.isArray(v)) return depth >= 2 ? `[… ${v.length} item${v.length === 1 ? '' : 's'}]` : v.slice(0, 3).map(x => brief(x, depth + 1)).concat(v.length > 3 ? [`… ${v.length - 3} more`] : []);
  if (v && typeof v === 'object'){
    if (depth >= 3) return '{…}';
    const o = {}; for (const k in v) o[k] = brief(v[k], depth + 1); return o;
  }
  return v;
}
const pretty = v => v === undefined ? '' : JSON.stringify(brief(v), null, 2);
const merge = (a, b) => { if (!b || typeof b !== 'object' || Array.isArray(b)) return b; const o = Object.assign({}, a); for (const k in b) o[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k]; return o; };

/* ---------- Scenarios ---------- */
const me = () => sim.session();
const prof = () => sim.state().profiles[me()] || { settings: SL.clone(SL.DEFAULTS), revision: 0, handle: null };
const userName = id => (sim.users[id] || {}).name;
const grantHandle = () => (sim.state().profiles.u_grant || {}).handle || 'grantwalker';
const S = [
  { group:'Photographer, signed in', id:'me', title:'Who’s signed in?', method:'GET', path:'/api/shutterlink/me',
    what:'Settings opens and asks Sport Shutter who is signed in.',
    client:'async me(){', route:'// Who is signed in',
    hits:{ 200:['json(200, { userId'] },
    then:{ 200: r => `Settings opens for ${r.body.name}, with their link sportshutter.com/@${r.body.handle || r.body.suggestedHandle}.`, 401: () => 'Settings shows “Sign in to edit your page” and sends them to the Sport Shutter login.' } },
  { id:'load', title:'Load my settings', method:'GET', path:'/api/shutterlink/settings',
    what:'Settings loads the photographer’s saved page so they can edit it.',
    client:'async loadSettings(){', route:'// Their saved settings',
    hits:{ 200:['json(200, { settings:'] },
    then:{ 200: r => r.body.settings ? `Settings fills in with their page, revision ${r.body.revision}.` : 'First time: settings start from the defaults with their name filled in.', 401: () => 'Settings shows the sign-in screen.' } },
  { id:'save', title:'Save a change', method:'PUT', path:'/api/shutterlink/settings',
    what:'The photographer edits their bio and corners. Settings sends the whole settings file back with the revision it loaded.',
    input: () => ({ profile:{ bio:'Surf, ocean and the people in the water.' }, theme:{ radius:10 } }),
    build: inp => ({ body:{ settings: merge(prof().settings, inp), revision: prof().revision } }),
    client:'async saveSettings(cfg){', route:'// Save the whole settings file.',
    hits:{ 200:['json(200, { revision: saved.revision', "emit('settings.saved'"], 403:["'csrf'"], 409:["'conflict', 'These settings"], 422:['invalid_settings'] },
    then:{ 200: () => 'The status reads “Saved to Sport Shutter”. Visitors see the change straight away.', 409: () => 'Settings asks: keep mine, or load the newer version?', 422: r => `Settings shows “${r.body.error.message}” and keeps the change on screen.`, 401: () => 'Settings shows the sign-in screen; the change stays on screen.' } },
  { id:'handle', title:'Change my link name', method:'PUT', path:'/api/shutterlink/handle',
    what:'The photographer picks a new name for sportshutter.com/@name.',
    input: () => ({ handle: (prof().handle === 'grant.walker' ? 'grantwalker' : 'grant.walker') }),
    build: inp => ({ body: inp }),
    client:'async setHandle(handle){', route:'// Change the personal link name',
    hits:{ 200:["emit('handle.changed', { userId: req.user.id, from: before", 'return json(200, { handle: h });'], 409:["'taken'"], 422:['invalid_handle'], 403:["'csrf'"] },
    then:{ 200: r => `Profile shows sportshutter.com/@${r.body.handle}. The old link now redirects there.`, 409: r => `Shows “${r.body.error.message}” under the field.`, 422: r => `Shows “${r.body.error.message}” under the field.` } },
  { id:'upload', title:'Upload a photo', method:'POST', path:'/api/shutterlink/images',
    what:'Settings shrinks a photo from the phone and uploads it. The address that comes back goes into the settings.',
    blob:true, client:'async uploadImage(file, max, q){', route:'// Upload one photo',
    hits:{ 201:['json(201'], 413:['too_large'], 415:['unsupported_type'] },
    then:{ 201: r => `The photo’s address (${String(r.body.url).slice(0, 24)}…) goes into the settings, which save next.` } },

  { group:'Visitor, anyone', id:'public', title:'Open a page', method:'GET', path: inp => '/api/public/pages/' + inp.handle,
    what:'Someone taps the link in an Instagram bio. The page asks for that photographer’s public settings.',
    input: () => ({ handle: grantHandle() }), visitor:true,
    client:'async loadPublic(handle){', route:"// Public: a photographer's page settings",
    hits:{ 200:['json(200, { handle: found.handle, settings: publicView'], 301:['movedTo'], 404:['not_found'] },
    then:{ 200: () => 'The page draws itself from these settings. Private fields, like the photographer’s email, were removed on the server.', 301: r => `The page switches to sportshutter.com/@${r.body.movedTo} and loads it.`, 404: () => 'The page shows “No page here yet”.' } },
  { id:'old', title:'Follow an old link', method:'GET', path: inp => '/api/public/pages/' + inp.handle,
    what:'A link shared before the photographer renamed themselves still works.',
    input: () => ({ handle:'grantwalkerphoto' }), visitor:true,
    client:'async loadPublic(handle){', route:"// Public: a photographer's page settings",
    hits:{ 200:['publicView'], 301:['movedTo'], 404:['not_found'] },
    then:{ 301: r => `The page quietly moves to sportshutter.com/@${r.body.movedTo} and loads it.`, 200: () => 'This is already the current name, so the page loads.', 404: () => 'The page shows “No page here yet”.' } },
  { id:'enquiry', title:'Send an enquiry', method:'POST', path: () => '/api/public/pages/' + grantHandle() + '/enquiries',
    what:'A visitor fills in the booking form. It goes to the photographer’s Sport Shutter inbox, never to an email address on the page.',
    input: () => ({ name:'Sam', email:'sam@example.com', type:'Surf session', msg:'Are you free for a surf shoot in March?' }), visitor:true,
    build: inp => ({ body: inp }),
    client:'async sendEnquiry(handle, data){', route:'// Public: a visitor sends an enquiry',
    hits:{ 202:["emit('enquiry.received'"], 422:['invalid_enquiry'], 404:['not_found'] },
    then:{ 202: () => 'The visitor sees “Sent. Thanks, Sam.”', 422: r => `The form shows “${r.body.errors[0].message}”` } },

  { group:'When things go wrong', id:'conflict', title:'Save an out-of-date copy', method:'PUT', path:'/api/shutterlink/settings',
    what:'The photographer saved from their laptop, then saves from a phone that still has the older revision.',
    input: () => ({ revision: Math.max(0, prof().revision - 1) }),
    build: inp => ({ body:{ settings: prof().settings, revision: inp.revision } }),
    client:'async saveSettings(cfg){', route:'// Save the whole settings file.',
    hits:{ 409:["'conflict', 'These settings"], 200:['json(200, { revision: saved.revision'] },
    then:{ 409: () => 'Settings asks which version to keep, so nothing is silently overwritten.', 200: () => 'The revision matched, so it saved.' } },
  { id:'unsafe', title:'Save something unsafe', method:'PUT', path:'/api/shutterlink/settings',
    what:'Settings sends a link that would run code if tapped. The server refuses it.',
    input: () => ({ links:[{ title:'Free prints', url:"javascript:alert('gotcha')", on:true }] }),
    build: inp => ({ body:{ settings: merge(prof().settings, inp), revision: prof().revision } }),
    client:'async saveSettings(cfg){', route:'// Save the whole settings file.', extra:'validate',
    hits:{ 422:['invalid_settings'], 200:['json(200, { revision: saved.revision'] },
    then:{ 422: r => `Nothing is saved. Settings shows “${r.body.errors[0].message}”` } },
  { id:'forged', title:'A save from another website', method:'PUT', path:'/api/shutterlink/settings',
    what:'A page on another site tries to save over the photographer’s settings while they’re signed in.',
    input: () => ({ profile:{ name:'Hacked' } }), forged:true,
    build: inp => ({ body:{ settings: merge(prof().settings, inp) } }),
    route:'// Save the whole settings file.',
    hits:{ 403:["'csrf'"] },
    then:{ 403: () => 'Nothing is saved. The other site gets an error and the page is untouched.' } },
  { id:'signedout', title:'Not signed in', method:'GET', path:'/api/shutterlink/settings', forceUser:null,
    what:'Someone opens settings without being signed in to Sport Shutter.',
    client:'async loadSettings(){', route:'handle()',
    hits:{ 401:['signed_out'] },
    then:{ 401: () => 'Settings shows “Sign in to edit your page” and links to the Sport Shutter login.' } },
];
let cur = S[2];

const SQL = {
  getProfile:   'select handle, settings, revision, updated_at\n  from shutterlink_profiles where user_id = $1',
  saveSettings: 'insert into shutterlink_profiles (user_id, settings, revision, updated_at)\nvalues ($1, $2, 1, now())\non conflict (user_id) do update\n  set settings = $2, revision = shutterlink_profiles.revision + 1, updated_at = now()\n  where $3::int is null or shutterlink_profiles.revision = $3\nreturning revision, updated_at',
  findByHandle: 'select user_id, handle from shutterlink_profiles where handle = $1\nunion all\nselect a.user_id, p.handle from shutterlink_handle_aliases a\n  join shutterlink_profiles p using (user_id) where a.handle = $1\nlimit 1',
  setHandle:    'update shutterlink_profiles set handle = $2 where user_id = $1;\ninsert into shutterlink_handle_aliases (handle, user_id) values (<old name>, $1);',
  addEnquiry:   'insert into shutterlink_enquiries (user_id, name, email, type, date, msg)\nvalues ($1, $2, $3, $4, $5, $6) returning id',
};
const EVENT_USE = { 'settings.saved':'Clear the CDN cache for this page.', 'handle.changed':'Clear both names from the cache.', 'enquiry.received':'Put it in the inbox and notify the photographer.' };
const STATUS = { 200:'OK', 201:'Created', 202:'Accepted', 301:'Moved Permanently', 400:'Bad Request', 401:'Unauthorized', 403:'Forbidden', 404:'Not Found', 405:'Method Not Allowed', 409:'Conflict', 413:'Payload Too Large', 415:'Unsupported Media Type', 422:'Unprocessable Entity', 429:'Too Many Requests', 500:'Internal Server Error' };

/* ---------- Left list + input ---------- */
function renderList(){
  let html = '', g = null;
  S.forEach(s => {
    if (s.group && s.group !== g){ g = s.group; html += `<h3>${esc(g)}</h3>`; }
    const path = typeof s.path === 'function' ? s.path(s.input ? s.input() : {}) : s.path;
    html += `<button data-s="${s.id}" aria-current="${s === cur}"><b>${esc(s.title)}</b><span>${s.method} ${esc(path.replace('/api/', ''))}</span></button>`;
  });
  $('scen').innerHTML = html;
}
$('scen').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; cur = S.find(s => s.id === b.dataset.s); pick(); };
function pick(){
  renderList();
  $('sTitle').textContent = cur.title;
  $('sWhat').textContent = cur.what;
  const inp = cur.input ? cur.input() : null;
  $('inWrap').hidden = !inp;
  if (inp) $('sIn').value = JSON.stringify(inp, null, 2);
  $('inErr').hidden = true;
  $('sSub').textContent = `${cur.method} ${typeof cur.path === 'function' ? cur.path(inp || {}) : cur.path}`;
  $('steps').innerHTML = ''; $('result').innerHTML = '';
  resetStepper();
}
$('sIn').oninput = () => { try { const v = JSON.parse($('sIn').value); $('inErr').hidden = true; if (typeof cur.path === 'function') $('sSub').textContent = `${cur.method} ${cur.path(v)}`; } catch(_) {} };

function fillWho(){
  const s = sim.session() || '';
  $('fWho').innerHTML = Object.values(sim.users).map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('') + '<option value="">Signed out</option>';
  $('fWho').value = s;
}
$('fWho').onchange = () => { sim.signIn($('fWho').value); pick(); toast($('fWho').value ? `Signed in as ${userName($('fWho').value)}` : 'Signed out'); };
$('fReset').onclick = () => { sim.reset(); fillWho(); pick(); toast('Pretend database reset'); };

/* ---------- Running a scenario for real ---------- */
async function run(){
  let inp = null;
  if (cur.input){
    try { inp = JSON.parse($('sIn').value); }
    catch(_){ $('inErr').textContent = 'The input isn’t valid JSON. Check for a missing comma or quote.'; $('inErr').hidden = false; $('sIn').focus(); return null; }
  }
  const uid = 'forceUser' in cur ? cur.forceUser : sim.session();
  const user = uid && sim.users[uid] ? sim.users[uid] : null;
  const before = sim.state();
  const calls = [], events = [];
  const mem = ShutterLinkMemoryStore.createMemoryStore({ state: sim.state(), persist: st => localStorage.setItem('shutterlink:sim:db', JSON.stringify(st)) });
  const store = {};
  ['getProfile','saveSettings','findByHandle','setHandle','addEnquiry'].forEach(fn => store[fn] = async (...args) => {
    const c = { fn, args: clone(args) }; calls.push(c);
    try { c.result = clone(await mem[fn](...args)); return c.result; }
    catch(e){ c.threw = { code: e.code, revision: e.revision }; throw e; }
  });
  const images = { put: async (u, blob, type, bytes) => {
    const url = await SL.putImage(new File([blob], 'photo.jpg', { type }), 1600);
    calls.push({ fn:'images.put', args:[u, `<${type} photo, ${Math.round(bytes / 1024)} KB>`, type], result:{ url } });
    return { url };
  } };
  const api = ShutterLinkApi.createShutterLinkApi({ store, images, onEvent: (type, payload) => events.push({ type, payload: clone(payload) }) });

  const path = typeof cur.path === 'function' ? cur.path(inp || {}) : cur.path;
  let body = cur.build ? cur.build(inp).body : undefined, ctype = 'application/json';
  if (cur.blob){ body = await samplePhoto(); ctype = 'image/jpeg'; }
  const headers = cur.forged ? { 'content-type':'text/plain', origin:'https://another-site.example' } : Object.assign({ 'x-shutterlink':'1' }, body !== undefined ? { 'content-type': ctype } : {});
  const res = await api.handle({ method: cur.method, path, headers, body, user: cur.visitor ? null : user, ip:'203.0.113.7' });
  const after = sim.state();
  // let the live pages hear about it, as Sport Shutter's events would
  events.forEach(ev => SLData.channel && SLData.channel.postMessage({ kind:'event', type: ev.type, payload: ev.payload, at: Date.now() }));
  return { path, headers, body, user: cur.visitor ? null : user, res, calls, events, before, after };
}
function samplePhoto(){
  return new Promise(r => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 600);
    g.addColorStop(0, '#9ed0e6'); g.addColorStop(.55, '#1c6b8c'); g.addColorStop(1, '#0d3b52');
    x.fillStyle = g; x.fillRect(0, 0, 800, 600);
    c.toBlob(b => r(b), 'image/jpeg', .85);
  });
}

/* ---------- What changed in the database ---------- */
function diff(a, b, path = '', out = []){
  if (out.length > 14) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (obj(a) && obj(b)){ new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => diff(a[k], b[k], path ? `${path}.${k}` : k, out)); return out; }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.length <= 30){ a.forEach((v, i) => diff(v, b[i], `${path}.${i}`, out)); return out; }
  out.push({ path, was: a, now: b }); return out;
}
const short = v => v === undefined ? '—' : (s => s.length > 90 ? s.slice(0, 87) + '…' : s)(JSON.stringify(brief(v)));
function tableName(p){
  return p.replace(/^profiles\.([^.]+)\.?/, 'shutterlink_profiles · $1 · ').replace(/^aliases\.?/, 'shutterlink_handle_aliases · ').replace(/^enquiries\.?/, 'shutterlink_enquiries · ').replace(/ · $/, '');
}

/* ---------- Laying out the steps ---------- */
async function stepsFor(R){
  const apiLines = await source('server/shutterlink-api.js'), clientLines = await source('assets/data.js');
  const st = R.res.status, hits = (cur.hits && cur.hits[st]) || [];
  const steps = [];
  const signedRoute = !cur.visitor && cur.route !== 'handle()';

  // 1. the page
  if (cur.forged){
    steps.push({ a:'page', who:'Another website', title:'A different site makes the call', file:'another-site.example',
      ex:'The browser would attach the Sport Shutter login, but this page can’t add the X-ShutterLink header without the browser asking Sport Shutter first, and Sport Shutter says no.',
      html: plain(`// on another website\nfetch('https://sportshutter.com${R.path}', {\n  method: 'PUT',\n  credentials: 'include',            // the login cookie comes along\n  headers: { 'Content-Type': 'text/plain' },\n  body: JSON.stringify({ settings: { profile: { name: 'Hacked' } } })\n});`) });
  } else {
    steps.push({ a:'page', who:'ShutterLink page', title:'The page calls the data layer', file:'assets/data.js',
      ex: cur.visitor ? 'The public page only ever reads, plus the one enquiry form.' : 'Every read and save in ShutterLink goes through these few functions, and nothing else talks to the server.',
      html: codeView(clientBlock(clientLines, cur.client), ["call('"]) });
  }
  // 2. request
  const reqLines = [`${cur.method} ${R.path} HTTP/1.1`, 'Host: sportshutter.com'];
  if (R.user && !cur.visitor) reqLines.push('Cookie: ss_session=•••• (Sport Shutter’s own login, added by the browser)');
  if (R.headers.origin) reqLines.push(`Origin: ${R.headers.origin}`);
  if (R.headers['x-shutterlink']) reqLines.push('X-ShutterLink: 1');
  if (R.headers['content-type']) reqLines.push(`Content-Type: ${R.headers['content-type']}`);
  const reqBody = R.body instanceof Blob ? `\n<${R.body.type} photo, ${Math.round(R.body.size / 1024)} KB of image data>` : R.body !== undefined ? '\n' + pretty(R.body) : '';
  steps.push({ a:'net', who:'Request', title:`${cur.method} ${R.path}`, ex: R.body && R.body.settings ? 'The whole settings file is sent (shortened here). Photos are uploaded separately, so it stays small.' : '', html: plain(reqLines.join('\n') + '\n' + reqBody) });
  // 3. login
  steps.push({ a:'ss', who:'Sport Shutter', title: cur.visitor ? 'No login needed' : 'Your session middleware says who it is', file:'your existing login code',
    ex: cur.visitor ? 'Public calls don’t look at the login at all.' : 'Sport Shutter’s own login code runs first and sets req.user. ShutterLink never sees passwords or tokens.',
    html: plain(cur.visitor ? 'req.user = null   // anyone can read a public page' : (R.user ? `req.user = { id: '${R.user.id}', name: '${R.user.name}' }` : 'req.user = null   // not signed in')) });
  // 4. the API
  const routeB = st === 401 && signedRoute ? apiBlock(apiLines, 'handle()') : apiBlock(apiLines, cur.route);
  let apiEx = st === 401 ? 'The route needs a signed-in user, so handle() stops here before running it.' : 'This is the code in shutterlink-api.js that handles this call. The highlighted line decided the result.';
  if (R.res.body && R.res.body.errors) apiEx += ' Problems found: ' + R.res.body.errors.map(e => `${e.path || 'settings'}: ${e.message}`).join('; ');
  steps.push({ a:'ss', who:'Sport Shutter', title:`shutterlink-api.js ${st === 401 ? 'checks the login' : 'handles the call'}`, file:'server/shutterlink-api.js', ex: apiEx,
    html: codeView(routeB, st === 401 && signedRoute ? ['signed_out'] : hits) + (cur.extra === 'validate' ? codeView(block(apiLines, 'function validateSettings(s) {', l => l === '  }'), ["vbscript|file", 'data:']) : '') });
  // 5. database
  const changes = diff(R.before, R.after);
  const callHtml = R.calls.length ? `<div class="calls">${R.calls.map(c => `<div class="call">await ${c.fn.includes('.') ? c.fn : 'store.' + c.fn}(${c.args.map(a => esc(short(a))).join(', ')})<br><span class="ret">→ ${c.threw ? 'throws ' + esc(JSON.stringify(c.threw)) : esc(short(c.result))}</span></div>`).join('')}</div>` : '<div class="calls"><div class="call ret">No database calls: it was stopped before reaching the data.</div></div>';
  const sqlFns = [...new Set(R.calls.map(c => c.fn).filter(f => SQL[f]))];
  steps.push({ a:'db', who:'Database', title: changes.length ? 'The database changes' : 'The database is only read', file:'your store, 5 functions',
    ex: changes.length ? 'What this request changed in Sport Shutter’s database:' : (R.calls.length ? 'Read only. Nothing in the database changed.' : ''),
    html: callHtml + (changes.length ? `<div class="diff"><table>${changes.map(c => `<tr><td>${esc(tableName(c.path))}</td><td>${c.was !== undefined ? `<span class="was">${esc(short(c.was))}</span><br>` : ''}<span class="now">${esc(short(c.now))}</span></td></tr>`).join('')}</table></div>` : '')
      + (sqlFns.length ? `<details class="sql"><summary>The same in PostgreSQL</summary>${plain(sqlFns.map(f => `-- store.${f}\n${SQL[f]}`).join('\n\n'))}</details>` : '') });
  // 6. events
  if (R.events.length) steps.push({ a:'ss', who:'Sport Shutter', title:'Events go out', file:'onEvent(type, payload)', ex:'Sport Shutter decides what each event does.',
    html: plain(R.events.map(e => `onEvent('${e.type}', ${JSON.stringify(e.payload)})\n  → ${EVENT_USE[e.type] || ''}`).join('\n\n')) });
  // 7. response
  const hdr = [`HTTP/1.1 ${st} ${STATUS[st] || ''}`, 'Content-Type: application/json; charset=utf-8', `Cache-Control: ${(R.res.headers && R.res.headers['cache-control']) || 'no-store'}`];
  steps.push({ a:'net', who:'Response', title:`${st} ${STATUS[st] || ''}`, ex: st === 200 && cur.visitor ? 'Safe to cache, so a CDN can answer most visitors without touching the server.' : '', html: plain(hdr.join('\n') + '\n\n' + pretty(R.res.body)) });
  // 8. the page again
  const then = cur.then && cur.then[st];
  steps.push({ a:'page', who:'ShutterLink page', title:'What the person sees', ex: then ? then(R.res) : (R.res.body && R.res.body.error ? `Shows “${R.res.body.error.message}”` : 'Done.'), html:'' });
  return steps;
}
function stepHtml(s, i){
  return `<li class="stp a-${s.a}"><span class="dot" aria-hidden="true">${i + 1}</span><div class="card"><div class="hd"><span class="who-c">${esc(s.who)}</span><b>${esc(s.title)}</b>${s.file ? `<span class="file">${esc(s.file)}</span>` : ''}</div>${s.ex ? `<p class="ex">${esc(s.ex)}</p>` : ''}${s.html}</div></li>`;
}

/* ---------- Run / step through ---------- */
let queue = [], shown = 0, timer = null;
function resetStepper(){ clearTimeout(timer); queue = []; shown = 0; $('stepBtn').textContent = 'Step through'; $('runBtn').disabled = false; }
function show(n){
  const ol = $('steps');
  while (shown < n && shown < queue.length){ ol.insertAdjacentHTML('beforeend', stepHtml(queue[shown], shown)); shown++; }
  $('stepBtn').textContent = shown < queue.length ? `Next step (${shown + 1} of ${queue.length})` : 'Step through';
  const last = ol.lastElementChild; if (last && shown > 1) last.scrollIntoView({ block:'nearest', behavior: reduce ? 'auto' : 'smooth' });
}
async function start(stepMode){
  resetStepper(); $('steps').innerHTML = ''; $('result').innerHTML = '';
  $('runBtn').disabled = true;
  const R = await run();
  if (!R){ $('runBtn').disabled = false; return; }
  queue = await stepsFor(R);
  const st = R.res.status;
  $('result').innerHTML = `<span class="status s${String(st)[0]}">${st} ${STATUS[st] || ''}</span>`;
  $('runBtn').disabled = false;
  if (stepMode){ show(1); return; }
  if ($('instant').checked || reduce){ show(queue.length); return; }
  const tick = () => { show(shown + 1); if (shown < queue.length) timer = setTimeout(tick, 420); };
  tick();
}
$('runBtn').onclick = () => start(false);
$('stepBtn').onclick = () => { if (queue.length && shown < queue.length) show(shown + 1); else start(true); };

fillWho(); pick();
})();
