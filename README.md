# ShutterLink

A Sport Shutter feature: a link-in-bio page any photographer can use to showcase their work, sell prints and take bookings, instead of Linktree.

Branding: the top bar shows the Sport Shutter mark with the ShutterLink name and links to sportshutter.com; the footer reads “Powered by Sport Shutter”.

**Live prototype:** `index.html` is the public page; `settings.html` controls it (the gear in the page's top bar opens it).

## What's in it

**Link page (`index.html`)**
- First screen fits on any iPhone without scrolling, in three cover styles: full-screen slideshow, framed, or minimal (profile photo)
- Story-style slideshow: tap the sides or swipe to change photo, hold to pause, arrow keys on desktop
- Up to four quick buttons (prints, gallery, film, enquire, newsletter, socials or any link)
- Sections you can reorder or hide: prints, gallery with full-screen viewer, featured film (YouTube plays in-page), links, enquiry form, newsletter, socials
- Print sheet with size, paper and frame options (live framed preview), quantity, cart with totals
- Share sheet with copy link; works offline-friendly with graceful image fallbacks

**Settings (`settings.html`)**
- Opens on **Get started** the first time: your name, then “Choose photos” (opens the phone’s photo library). The photos replace the demo ones on the cover and gallery straight away
- Theme presets plus fully custom colours, with live readability checks
- Six type pairings, corner roundness, button shape, alignment, link style, photo-colour blend
- Photo uploads (resized in the browser) or image links, captions, reordering
- Undo / redo, backup to file, restore from file, reset to demo
- Live phone preview that follows the tab you're on; full-screen preview on mobile
- Light and dark mode for the settings app itself

## How it fits together

- `assets/core.js` holds everything shared: the colour system (four colours in, a full accessible palette out), themes, fonts, default content, the shop catalogue and storage.
- Settings are saved in the browser for the prototype (`SL.load` / `SL.save`). For the Sport Shutter plugin these two functions become account API calls; nothing else needs to change.
- The shop catalogue (`SL.SHOP`) stands in for the photographer's Sport Shutter products. Checkout hands off to Sport Shutter.

Placeholder photos come from picsum.photos. The demo photographer is fictional.

## Viewing

GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.
