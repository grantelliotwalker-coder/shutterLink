/*!
 * Reference store for the ShutterLink API.
 * Shows exactly what the five store functions must do. Sport Shutter replaces
 * this with calls to its own database (see the SQL in the design brief).
 * The simulator uses it too, saving its state in the browser.
 *
 *   const store = createMemoryStore({ state, persist });
 *   // state:   optional starting data { profiles, aliases, enquiries }
 *   // persist: optional (state) => void, called after every change
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShutterLinkMemoryStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createMemoryStore(opts) {
    opts = opts || {};
    const state = opts.state || {};
    state.profiles = state.profiles || {};   // userId -> { handle, settings, revision, updatedAt }
    state.aliases = state.aliases || {};     // old handle -> userId (so old links still work)
    state.enquiries = state.enquiries || []; // { id, userId, ...enquiry }
    const persist = () => { if (opts.persist) opts.persist(state); };
    const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

    return {
      state,
      async getProfile(userId) {
        return clone(state.profiles[userId] || null);
      },
      async saveSettings(userId, settings, expectedRevision) {
        const p = state.profiles[userId] || (state.profiles[userId] = { handle: null, settings: null, revision: 0, updatedAt: null });
        if (expectedRevision != null && expectedRevision !== p.revision) {
          const e = new Error('conflict'); e.code = 'conflict'; e.revision = p.revision; throw e;
        }
        p.settings = clone(settings);
        p.revision += 1;
        p.updatedAt = new Date().toISOString();
        persist();
        return { revision: p.revision, updatedAt: p.updatedAt };
      },
      async findByHandle(handle) {
        for (const id in state.profiles) if (state.profiles[id].handle === handle) return { userId: id, handle };
        const id = state.aliases[handle];
        return id && state.profiles[id] ? { userId: id, handle: state.profiles[id].handle } : null;
      },
      async setHandle(userId, handle) {
        for (const id in state.profiles) if (id !== userId && state.profiles[id].handle === handle) return { taken: true };
        if (state.aliases[handle] && state.aliases[handle] !== userId) return { taken: true };
        const p = state.profiles[userId] || (state.profiles[userId] = { handle: null, settings: null, revision: 0, updatedAt: null });
        if (p.handle && p.handle !== handle) state.aliases[p.handle] = userId;   // old link redirects
        delete state.aliases[handle];
        p.handle = handle;
        persist();
        return { ok: true };
      },
      async addEnquiry(userId, enquiry) {
        const id = 'enq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        state.enquiries.unshift(Object.assign({ id, userId }, enquiry));
        state.enquiries = state.enquiries.slice(0, 200);
        persist();
        return { id };
      },
    };
  }

  return { createMemoryStore };
});
