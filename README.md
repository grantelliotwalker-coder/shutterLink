# Shutterlink

A link-in-bio page for photographers — a Linktree alternative that lives on your own site, with your prints shop built in.

This is a prototype: `index.html` is the public link page, `settings.html` controls it (live preview, saved in the browser), and `config.js` holds the shared data and demo content. It uses with a fictional photographer and shop so the interactions can be reviewed before branding goes in.

**What it demonstrates**
- Stories-style hero of recent work (tap sides to step, hold to pause); page colour follows the current photo
- Primary actions: shop prints, book a session
- Prints strip → detail sheet with size picker → cart → checkout (stubbed)
- Featured video, link list, social icons, share button

**Settings (temporary):** the gear in the link page's top bar opens `settings.html`. In the real integration this becomes a tab in the Sport Shutter account, and `slLoad`/`slSave` in `config.js` become API calls.

**Rebranding later:** colours, radii and fonts are CSS variables at the top of the `<style>` block; default content lives in `SL_DEFAULTS` and the shop catalogue in `SL_SHOP` (both in `config.js`). Photos are placeholders from picsum.photos.

View it via GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).
