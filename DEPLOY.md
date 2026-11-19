# Putting ShutterLink on sportshutter.com

ShutterLink is a separate static app (this repo, hosted on GitHub Pages at
`https://grantelliotwalker-coder.github.io/shutterLink/`). It can appear as part of
sportshutter.com while being built and deployed independently.

The app uses only relative paths, so it works at any address: the site root, a
sub-path such as `/shutterlink/`, or its own subdomain.

There are two ways to connect it.

---

## Option A: subdomain (simplest; recommended)

`shutterlink.sportshutter.com` (or `link.sportshutter.com`)

Sport Shutter already runs separate apps this way (`app.sportshutter.com`,
`become-a-photographer.sportshutter.com`), so this matches the existing setup and needs
no changes to the main site's server.

1. In the DNS for sportshutter.com, add a `CNAME` record:
   `shutterlink` → `grantelliotwalker-coder.github.io`
2. In this repo on GitHub: **Settings → Pages → Custom domain** → `shutterlink.sportshutter.com`,
   save, then tick **Enforce HTTPS** once the certificate is issued.
   (GitHub adds a `CNAME` file to the repo. After that the github.io address redirects to the
   new domain, so only do this once DNS is in place.)

---

## Option B: a path on the main site (`sportshutter.com/shutterlink/`)

The main site's server (or CDN) forwards `/shutterlink/…` to GitHub Pages. Visitors only
ever see sportshutter.com.

Two rules, whichever platform:

- **Redirect `/shutterlink` to `/shutterlink/`** (trailing slash). The main site already
  uses `/assets/`, and without the slash the browser would look there for ShutterLink's
  files. (The page also corrects this itself, but the redirect avoids a wasted request.)
- **Forward `/shutterlink/*` to `https://grantelliotwalker-coder.github.io/shutterLink/*`**.
  Note the capital `L` in `shutterLink` on GitHub's side.

### Nginx
```nginx
location = /shutterlink { return 301 /shutterlink/$is_args$args; }

location /shutterlink/ {
    proxy_pass https://grantelliotwalker-coder.github.io/shutterLink/;
    proxy_set_header Host grantelliotwalker-coder.github.io;
    proxy_ssl_server_name on;
    proxy_redirect https://grantelliotwalker-coder.github.io/shutterLink/ /shutterlink/;
}
```

### Cloudflare (Worker on route `sportshutter.com/shutterlink*`)
```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/shutterlink') {
      return Response.redirect(`${url.origin}/shutterlink/${url.search}`, 301);
    }
    const rest = url.pathname.slice('/shutterlink/'.length);
    const target = `https://grantelliotwalker-coder.github.io/shutterLink/${rest}${url.search}`;
    return fetch(target, { method: request.method, headers: { 'Accept': request.headers.get('Accept') || '*/*' } });
  },
};
```

### Vercel (`vercel.json` on the main site)
```json
{
  "redirects": [{ "source": "/shutterlink", "destination": "/shutterlink/", "permanent": true }],
  "rewrites":  [{ "source": "/shutterlink/:path*", "destination": "https://grantelliotwalker-coder.github.io/shutterLink/:path*" }]
}
```

### Netlify (`_redirects` on the main site)
```
/shutterlink     /shutterlink/   301
/shutterlink/*   https://grantelliotwalker-coder.github.io/shutterLink/:splat   200
```

---

## Things to know

- **Shared browser storage (Option B only).** On a path, ShutterLink runs on the same origin
  as sportshutter.com, so it shares that site's browser storage and any cookies that scripts
  can read. ShutterLink only uses keys that start with `shutterlink:`, so nothing collides,
  but it's the same trust level as the main site's own code. A subdomain (Option A) keeps
  them apart.
- **Updates.** Pushing to `main` updates the live page within a minute or two. Files are
  versioned (`core.js?v=…`) so phones don't keep stale copies; bump the number when
  `assets/core.js` changes.
- **Not-found page.** `404.html` works out the app's home address on its own, at any of the
  addresses above.
- **Link previews.** Social apps need full URLs for preview images. Once the final address is
  chosen, change `og:image` in `index.html` to the full URL
  (e.g. `https://sportshutter.com/shutterlink/assets/og-card.png`).

## Checking it works

Open the new address and confirm:
1. `…/shutterlink` (no slash) ends up at `…/shutterlink/`.
2. The page shows your name and photos, and the browser console shows no errors.
3. The gear opens settings at `…/shutterlink/settings.html`, and its preview loads.
4. A made-up address such as `…/shutterlink/nope` shows the “This page isn’t here” page,
   and its button returns to `…/shutterlink/`.
