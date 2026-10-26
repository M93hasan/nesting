# Serula theme assets

The shared visual tokens and dashboard/authentication styles live in the repository-root `theme/` directory.

- `theme/serula.css` defines the core theme tokens and imports the screen-surface layer.
- `theme/serula-surfaces.css` styles the admin and authentication views.
- `web/src/main.tsx` imports the core theme stylesheet for the web application.

The Cloudflare deployment workflow watches changes under `web/**`. When only files in the root `theme/` directory change, a web-path change or a manual workflow dispatch is needed to trigger a production deployment.
