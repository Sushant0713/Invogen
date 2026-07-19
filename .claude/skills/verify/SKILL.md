---
name: verify
description: How to run and verify Invogen (client + server + MongoDB) locally.
---

# Verifying Invogen changes

## Stack state

- MongoDB on `localhost:27017` (db name `invogen`) and the API server on `:5000`
  are usually already running on this machine. Check first:
  `netstat -ano | grep -E ":(27017|5000|5173)\s"`.
- The Vite client dev server usually already runs on `:5173` (user-started, HMR
  picks up edits). If not: `npm --prefix client run dev` from the repo root.
- Server env uses Zod defaults when `server/.env` is absent. Seeded super admin:
  `admin@invogen.app` / `Admin@123456` (defaults in `server/src/config/env.ts`).

## Surfaces without login

The permission classifier blocks typing passwords into login forms. The
**public invoice view** `/view/invoice/:token` exercises the full preview
layout pipeline (`prepareInvoiceLivePreviewPages` → reflow → fit →
`TemplatePreviewPages`) with no auth:

1. Find/add a share token directly in Mongo (server only matches
   `{'shares.token': token}`, no expiry field needed):
   `mongosh --quiet --eval "db.getSiblingDB('invogen').invoices.updateOne({}, {\$push:{shares:{token:'verify-1',channel:'link',createdAt:new Date()}}})"`
2. Open `http://localhost:5173/view/invoice/verify-1`.
3. **Clean up after**: `$pull` the token and revert any snapshot edits.

## Layout parity checks

- Preview element wrappers carry `data-preview-element-id`. Compare
  `style.height` (layout-computed) vs `scrollHeight` (rendered) per element —
  drift > 3px means the measurement pipeline diverged from the browser.
- `localStorage.setItem('invogen-layout-debug', '1')` then reload enables the
  built-in parity/overlap logger AND the layout idempotency assertion
  (`layout-parity-debug.ts`). The window flag `__INVOGEN_LAYOUT_DEBUG` also
  works but loses the race against React Query's cache on reload.
  The last idempotency diff is stashed at `window.__lastIdempotencyDiff`.
- To stress text wrapping, edit `templateSnapshot[0].elements[n].props`
  (e.g. `termsItems`) in Mongo and reload the share link.

## Gotchas

- Browser-pane screenshots of the invoice pages often time out; use
  `javascript_tool` + DOM queries or `get_page_text` instead.
- `npx tsc -p tsconfig.app.json --noEmit` in `client/` reports many
  pre-existing errors (LoginForm, ChartCard, BuilderCanvas, dead
  `layout-warnings.ts` imports). `npm run build` (vite only) is the real
  build gate.
