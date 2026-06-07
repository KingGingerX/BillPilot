# Deployment

This project is a static site. No server runtime, database, secrets, or package installation is required.

## Build

```powershell
cmd /c npm.cmd run validate
```

The build output is written to `dist/`.

## Deploy Targets

Any static host can serve the generated files:

- Netlify
- Vercel static output
- Cloudflare Pages
- GitHub Pages
- Any CDN or object storage bucket configured for static website hosting

## Operational Notes

- Serve `dist/index.html` as the default document.
- Keep `dist/assets/hero-workspace.png` with the built files.
- Configure HTTPS at the host or CDN layer.
- If analytics are added later, update `privacy.html` before deployment.
- Gumroad remains the checkout, payment, delivery, and receipt system.

## Lead Capture

The update form is configured for static form hosts that support HTML form capture. Netlify will detect the form during deployment and store submissions in the project dashboard.

## Optional First-Party Events

The project includes `netlify/functions/events.js`. To enable browser event delivery, define this before `analytics.js` loads:

```html
<script>window.TGB_ANALYTICS_ENDPOINT = "/.netlify/functions/events";</script>
```

Leave it unset when no event endpoint is deployed.
