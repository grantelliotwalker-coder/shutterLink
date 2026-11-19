/*!
 * ShutterLink API for Sport Shutter
 * ---------------------------------
 * The one file Sport Shutter adds to its server. It answers the requests the
 * ShutterLink pages make, checks everything they send, and keeps every
 * photographer's link-page settings in Sport Shutter's own database.
 *
 * Sport Shutter keeps full control: it supplies who is signed in (req.user),
 * where data is stored (store), where photos go (images) and what happens on
 * events (onEvent). This file never sees passwords and never touches
 * anything else.
 *
 * The same file runs unchanged in the ShutterLink simulator, in the browser,
 * against a pretend database.
 *
 * Works in Node 18+ and in browsers. No dependencies.
 *
 *   const { createShutterLinkApi, expressHandler } = require('./shutterlink-api');
 *   const api = createShutterLinkApi({ store, images, onEvent });
 *   app.use(express.json({ limit: '100kb' }));
 *   app.use('/api', express.raw({ type: 'image/*', limit: '8mb' }));
 *   app.use(expressHandler(api));   // after your session middleware sets req.user
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShutterLinkApi = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA_VERSION = 2;
  const LIMITS = {
    settingsBytes: 64 * 1024,        // the whole settings file; photos are stored separately
    stringChars: 2000,
    imageBytes: 8 * 1024 * 1024,
    imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    lists: { 'cover.photos': 10, 'gallery.photos': 24, links: 20, quick: 4, sections: 12, 'shop.featured': 24 },
    enquiryChars: { name: 80, email: 200, type: 60, date: 20, msg: 4000 },
  };
  const RESERVED = ['admin', 'api', 'app', 'help', 'login', 'logout', 'settings', 'shop', 'support', 'sportshutter',
    'shutterlink', 'about', 'terms', 'privacy', 'blog', 'pricing', 'dashboard', 'account', 'static', 'assets', 'www', 'null', 'undefined'];
  const HANDLE_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/;

  /* ---------- Small helpers ---------- */
  const json = (status, body, headers) => ({ status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers || {}), body });
  const error = (status, code, message, extra) => json(status, Object.assign({ error: { code, message } }, extra || {}));
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const clone = v => JSON.parse(JSON.stringify(v));
  const byteLength = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : Buffer.byteLength(s));
  const now = () => new Date().toISOString();

  function slug(name) {
    const s = String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '').slice(0, 24);
    return s.length >= 3 ? s : (s + 'photo').slice(0, 24);
  }
  function checkHandle(h) {
    if (typeof h !== 'string') return 'Choose a link name.';
    if (!HANDLE_RE.test(h)) return 'Use 3 to 30 lowercase letters, numbers, dots, hyphens or underscores, starting and ending with a letter or number.';
    if (RESERVED.includes(h)) return 'That name is reserved. Try another.';
    return null;
  }

  /* ---------- Settings validation ----------
     Shape and safety only. Unknown fields are allowed so the pages can add
     features without a server change; size limits keep that in check. */
  function validateSettings(s) {
    const errors = [];
    const add = (path, message) => { if (errors.length < 20) errors.push({ path, message }); };
    if (!isObj(s)) return [{ path: '', message: 'Settings must be an object.' }];
    if (s.v !== SCHEMA_VERSION) add('v', `Expected settings version ${SCHEMA_VERSION}.`);
    const raw = JSON.stringify(s);
    if (byteLength(raw) > LIMITS.settingsBytes) add('', `Settings are larger than ${LIMITS.settingsBytes / 1024} KB. Photos must be uploaded, not embedded.`);
    const name = s.profile && s.profile.name;
    if (typeof name !== 'string' || !name.trim()) add('profile.name', 'A name is required.');
    else if (name.length > 40) add('profile.name', 'Names can be up to 40 characters.');
    for (const path in LIMITS.lists) {
      const list = path.split('.').reduce((o, k) => (o == null ? o : o[k]), s);
      if (list != null && !Array.isArray(list)) add(path, 'Must be a list.');
      else if (list && list.length > LIMITS.lists[path]) add(path, `Up to ${LIMITS.lists[path]} items.`);
    }
    (function walk(v, path, depth) {
      if (depth > 8) return add(path, 'Nested too deeply.');
      if (typeof v === 'string') {
        if (v.length > LIMITS.stringChars) add(path, 'Text is too long.');
        const t = v.replace(/[\u0000- ]/g, '').toLowerCase();
        if (/^(javascript|vbscript|file):/.test(t)) add(path, 'That kind of link isn’t allowed.');
        if (/^data:/.test(t)) add(path, 'Upload photos instead of embedding them.');
      } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${i}`, depth + 1));
      else if (isObj(v)) for (const k in v) walk(v[k], path ? `${path}.${k}` : k, depth + 1);
      else if (v !== null && typeof v !== 'number' && typeof v !== 'boolean') add(path, 'Unsupported value.');
    })(s, '', 0);
    return errors;
  }

  /* What visitors are allowed to see. Private fields never leave the server. */
  function publicView(s) {
    const p = clone(s);
    if (p.enquire) delete p.enquire.to;        // the photographer's email stays private
    if (p.page) delete p.page.showGear;
    return p;
  }

  function cleanEnquiry(b) {
    const out = {};
    for (const k in LIMITS.enquiryChars) out[k] = String((b && b[k]) || '').trim().slice(0, LIMITS.enquiryChars[k]);
    const errors = [];
    if (!out.name) errors.push({ path: 'name', message: 'Add your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email)) errors.push({ path: 'email', message: 'Add an email address like you@example.com.' });
    if (!out.msg) errors.push({ path: 'msg', message: 'Add a short message.' });
    return { enquiry: out, errors };
  }

  /* ---------- The API ----------
     options.store   (required) async functions backed by Sport Shutter's database:
       getProfile(userId)              -> { handle, settings, revision, updatedAt } | null
       saveSettings(userId, settings, expectedRevision)
                                        -> { revision, updatedAt }
                                           throw { code: 'conflict', revision } if expectedRevision is stale
       findByHandle(handle)            -> { userId, handle } | null   (handle = current one; differs for an old name)
       setHandle(userId, handle)       -> { ok: true } | { taken: true }   (keep the old name as a redirect)
       addEnquiry(userId, enquiry)     -> { id }
     options.images  (required) put(userId, body, contentType, bytes) -> { url }
     options.onEvent (optional) (type, payload) => void   e.g. purge the CDN, notify the photographer
     options.rateLimit (optional) async (key) => boolean  return false to refuse with 429 */
  function createShutterLinkApi(options) {
    const store = options && options.store, images = options && options.images;
    if (!store || !images) throw new Error('createShutterLinkApi needs { store, images }');
    const emit = (type, payload) => { try { options.onEvent && options.onEvent(type, payload); } catch (_) {} };
    const limited = async key => options.rateLimit ? !(await options.rateLimit(key)) : false;

    // State-changing requests must carry this header. Browsers won't let another site add it
    // without asking first, so a page elsewhere can't save on someone's behalf (CSRF).
    const csrfOk = req => (req.headers['x-shutterlink'] || '') === '1';

    async function suggestHandle(userId, name) {
      const base = slug(name);
      for (let i = 0; i < 50; i++) {
        const h = i ? `${base.slice(0, 26)}${i + 1}` : base;
        if (checkHandle(h)) continue;
        const found = await store.findByHandle(h);
        if (!found || found.userId === userId) return h;
      }
      return `${base.slice(0, 20)}${Date.now().toString(36).slice(-6)}`;
    }

    const routes = [
      // Who is signed in, and their link name.
      ['GET', /^\/api\/shutterlink\/me$/, true, async (req) => {
        const p = await store.getProfile(req.user.id);
        return json(200, { userId: req.user.id, name: req.user.name || '', handle: (p && p.handle) || null, suggestedHandle: p && p.handle ? null : await suggestHandle(req.user.id, req.user.name) });
      }],
      // Their saved settings (null the first time).
      ['GET', /^\/api\/shutterlink\/settings$/, true, async (req) => {
        const p = await store.getProfile(req.user.id);
        return json(200, { settings: (p && p.settings) || null, revision: (p && p.revision) || 0, updatedAt: (p && p.updatedAt) || null, handle: (p && p.handle) || null });
      }],
      // Save the whole settings file.
      ['PUT', /^\/api\/shutterlink\/settings$/, true, async (req) => {
        if (!csrfOk(req)) return error(403, 'csrf', 'Missing X-ShutterLink header.');
        if (await limited('save:' + req.user.id)) return error(429, 'rate_limited', 'Too many saves. Try again in a moment.');
        const b = req.body || {};
        const errors = validateSettings(b.settings);
        if (errors.length) return error(422, 'invalid_settings', 'Some settings aren’t valid.', { errors });
        let profile = await store.getProfile(req.user.id);
        if (!profile || !profile.handle) {
          const h = await suggestHandle(req.user.id, b.settings.profile.name);
          await store.setHandle(req.user.id, h);
          emit('handle.changed', { userId: req.user.id, from: null, to: h });
          profile = await store.getProfile(req.user.id);
        }
        try {
          const saved = await store.saveSettings(req.user.id, b.settings, typeof b.revision === 'number' ? b.revision : null);
          emit('settings.saved', { userId: req.user.id, handle: profile.handle, revision: saved.revision });
          return json(200, { revision: saved.revision, updatedAt: saved.updatedAt, handle: profile.handle });
        } catch (e) {
          if (e && e.code === 'conflict') return error(409, 'conflict', 'These settings changed somewhere else.', { revision: e.revision });
          throw e;
        }
      }],
      // Change the personal link name. The old one keeps redirecting.
      ['PUT', /^\/api\/shutterlink\/handle$/, true, async (req) => {
        if (!csrfOk(req)) return error(403, 'csrf', 'Missing X-ShutterLink header.');
        const h = String((req.body && req.body.handle) || '').trim().toLowerCase();
        const problem = checkHandle(h);
        if (problem) return error(422, 'invalid_handle', problem);
        const before = await store.getProfile(req.user.id);
        if (before && before.handle === h) return json(200, { handle: h });
        const found = await store.findByHandle(h);
        if (found && found.userId !== req.user.id) return error(409, 'taken', 'That name is taken. Try another.');
        const r = await store.setHandle(req.user.id, h);
        if (r && r.taken) return error(409, 'taken', 'That name is taken. Try another.');
        emit('handle.changed', { userId: req.user.id, from: before && before.handle, to: h });
        return json(200, { handle: h });
      }],
      // Upload one photo; the settings then refer to its address.
      ['POST', /^\/api\/shutterlink\/images$/, true, async (req) => {
        if (!csrfOk(req)) return error(403, 'csrf', 'Missing X-ShutterLink header.');
        const type = String(req.headers['content-type'] || '').split(';')[0].trim();
        if (!LIMITS.imageTypes.includes(type)) return error(415, 'unsupported_type', 'Upload a JPEG, PNG or WebP photo.');
        const bytes = req.body ? (req.body.size != null ? req.body.size : req.body.length) : 0;
        if (!bytes) return error(400, 'empty', 'No photo was sent.');
        if (bytes > LIMITS.imageBytes) return error(413, 'too_large', 'Photos can be up to 8 MB.');
        if (await limited('img:' + req.user.id)) return error(429, 'rate_limited', 'Too many uploads. Try again in a moment.');
        const r = await images.put(req.user.id, req.body, type, bytes);
        return json(201, { url: r.url });
      }],
      // Public: a photographer's page settings, safe to cache at the edge.
      ['GET', /^\/api\/public\/pages\/([^/]+)$/, false, async (req, m) => {
        const h = decodeURIComponent(m[1]).toLowerCase();
        const found = await store.findByHandle(h);
        if (!found) return error(404, 'not_found', 'There’s no ShutterLink page at this address.');
        if (found.handle !== h) return json(301, { movedTo: found.handle }, { 'cache-control': 'public, max-age=300' });
        const p = await store.getProfile(found.userId);
        if (!p || !p.settings) return error(404, 'not_found', 'This page hasn’t been set up yet.');
        return json(200, { handle: found.handle, settings: publicView(p.settings), revision: p.revision, updatedAt: p.updatedAt },
          { 'cache-control': 'public, max-age=60, stale-while-revalidate=600' });
      }],
      // Public: a visitor sends an enquiry; it goes to the photographer's Sport Shutter inbox.
      ['POST', /^\/api\/public\/pages\/([^/]+)\/enquiries$/, false, async (req, m) => {
        if (await limited('enq:' + (req.ip || ''))) return error(429, 'rate_limited', 'Too many messages. Try again later.');
        const h = decodeURIComponent(m[1]).toLowerCase();
        const found = await store.findByHandle(h);
        if (!found) return error(404, 'not_found', 'There’s no ShutterLink page at this address.');
        if (req.body && req.body.website) return json(202, { ok: true });   // honeypot: bots fill hidden fields
        const { enquiry, errors } = cleanEnquiry(req.body);
        if (errors.length) return error(422, 'invalid_enquiry', 'Some details are missing.', { errors });
        const r = await store.addEnquiry(found.userId, Object.assign({ receivedAt: now() }, enquiry));
        emit('enquiry.received', { userId: found.userId, handle: found.handle, enquiryId: r.id });
        return json(202, { ok: true });
      }],
    ];

    async function handle(req) {
      const r = { method: String(req.method || 'GET').toUpperCase(), path: String(req.path || '').replace(/\/+$/, ''), headers: {}, body: req.body, user: req.user || null, ip: req.ip || '' };
      for (const k in (req.headers || {})) r.headers[k.toLowerCase()] = req.headers[k];
      const pathMatch = routes.filter(x => x[1].test(r.path));
      if (!pathMatch.length) return error(404, 'not_found', 'Unknown endpoint.');
      const route = pathMatch.find(x => x[0] === r.method);
      if (!route) return error(405, 'method_not_allowed', 'Method not allowed.', undefined);
      if (route[2] && !(r.user && r.user.id)) return error(401, 'signed_out', 'Sign in to Sport Shutter to edit your page.');
      try { return await route[3](r, r.path.match(route[1])); }
      catch (e) { return error(500, 'server_error', 'Something went wrong. Try again.'); }
    }

    return { handle, validateSettings, publicView };
  }

  /* ---------- Express / Connect adapter ----------
     Mount after your session middleware (which sets req.user = { id, name }),
     express.json() and express.raw({ type: 'image/*' }). */
  function expressHandler(api, opts) {
    const getUser = (opts && opts.getUser) || (req => (req.user ? { id: String(req.user.id), name: req.user.name || '' } : null));
    return async function shutterlink(req, res, next) {
      const path = req.path || req.url.split('?')[0];
      if (!/^\/api\/(shutterlink|public\/pages)(\/|$)/.test(path)) return next();
      try {
        const out = await api.handle({ method: req.method, path, headers: req.headers, body: req.body, user: getUser(req), ip: req.ip });
        res.status(out.status);
        for (const k in out.headers) res.setHeader(k, out.headers[k]);
        res.end(out.body === undefined ? '' : JSON.stringify(out.body));
      } catch (e) { next(e); }
    };
  }

  return { createShutterLinkApi, expressHandler, validateSettings, publicView, checkHandle, SCHEMA_VERSION, LIMITS, RESERVED };
});
