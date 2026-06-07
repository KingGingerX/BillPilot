# TGB Global Gumroad Storefront

Static professional storefront page for the TGB Global Gumroad collection.

## Files

- `index.html` - production storefront page
- `styles.css` - responsive visual system
- `assets/hero-workspace.png` - local hero image asset
- `privacy.html` - privacy notice for the static storefront
- `terms.html` - storefront terms notice
- `thanks.html` - lead capture confirmation page
- `analytics.js` - first-party event hooks, disabled until an endpoint is configured
- `testimonials.js` - renders verified buyer quotes from JSON
- `data/testimonials.json` - testimonial data source
- `TESTIMONIALS.md` - copy-paste testimonial format
- `netlify/functions/events.js` - optional Netlify event endpoint
- `sitemap.xml` and `robots.txt` - crawler metadata
- `scripts/validate-static.js` - zero-dependency validation and build script

## Validation

Run the full local check suite:

```powershell
cmd /c npm.cmd run lint
cmd /c npm.cmd run typecheck
cmd /c npm.cmd run test
cmd /c npm.cmd run build
cmd /c npm.cmd run validate
```

PowerShell may block `npm.ps1` depending on execution policy. `npm.cmd` avoids that policy issue without changing system settings.

## Build Output

`npm run build` writes deployable static files to `dist/`.

## Analytics

`analytics.js` does not send events unless the page defines `window.TGB_ANALYTICS_ENDPOINT` before the script loads. Gumroad links include UTM parameters either way.

## Lead Capture

The update form uses static form attributes compatible with Netlify Forms and redirects to `thanks.html`.

## Testimonials

Put verified buyer quotes in `data/testimonials.json`. Use `TESTIMONIALS.md` for the exact object format.
