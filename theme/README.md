# Serula Theme

Serula's framework-neutral theme foundation, inspired by the clean dashboard design of Studio Admin (https://github.com/arhamkhnz/next-shadcn-admin-dashboard).

Serula uses React, TypeScript and Vite and has a specialized nesting workspace. This project adapts the visual principles rather than copying a Next.js/Tailwind app or replacing the existing architecture.

- `serula.css`: neutral color tokens, typography, radius/shadow tokens, orange accent, visible keyboard focus and reduced-motion support.
- Imported by `web/src/main.tsx` so it loads on public and admin routes.
- No new dependencies or remote font requests.
- Nesting, geometry, DXF import/export, authentication and Corel bridge behavior are intentionally kept separate from styling.

This is the initial foundation only. Landing, login, workspace and admin components still need targeted styling and tests before claiming a complete redesign or enabling theme switching.
