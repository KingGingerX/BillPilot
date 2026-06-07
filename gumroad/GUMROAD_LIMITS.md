# Gumroad Publishing Limits

The custom storefront in this repo cannot be uploaded directly as the full `tgbglobal.gumroad.com` profile page from this environment.

Current constraints:

- No Gumroad access token is available in the environment.
- Gumroad's public API is product-focused and does not provide a safe profile section publishing workflow here.
- Gumroad's native profile editor supports profile settings, pages, product sections, posts sections, subscribe sections, and text sections.
- The repo's full static page should be hosted separately and used as the premium marketing layer, with Gumroad links used for checkout.

Practical path:

1. Use `GUMROAD_PROFILE_SETUP.md` to update the Gumroad-native profile.
2. Deploy `dist/` to a static host for the full visual experience.
3. Link Gumroad products from the static page with the existing UTM-tagged links.
4. Add the static site URL to the Gumroad profile bio or text section.
