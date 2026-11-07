# wang-mai — notes for Claude / agents

Read `docs/development.md` first: file layout, local emulator setup, tests. Scope: `docs/requirements.md`; status: `docs/roadmap.md`.

## Git
- `main` holds finished, tested work only. Work on a branch; merge into `main` as one clean commit per feature.
- Drafts, mockups and experiments stay off `main`.
- `npm test` (rules) and `npm run test:e2e` (browser) must pass before merging; CI runs both on every push.
- Commit messages describe what the change delivers, not the back-and-forth.

## Code
- UI copy is Thai. Keep it plain and short.
- No build step: Vue 3 + Firebase loaded via import map in `index.html`. Components are JS objects with `template` strings in `src/components/`. No `.vue` files or npm deps unless the project moves to Vite.
- The app is v2 in `v2/`; it reuses `src/firebase.js` and `src/lib/*`. The root `index.html` only points to v2 (v1 moved in, see `docs/decisions/0001`). v1 `people`/`places` stay read-only until deleted.
- All Firebase access lives in each version's `store.js`. Components call store functions only.
- Changing stored fields means updating the `store.js`, `firestore.rules` (+ a test in `tests/rules.test.mjs`) and `docs/data-model.md` together. Rules are published separately (console or `firebase deploy --only firestore:rules`); tell the user when they need republishing.
- `src/lib/*` is dependency-free; test changes there with node.
- Style through the CSS tokens in `src/style.css`; keep light and dark working and the layout usable at 400px.
- Deploy: push to `main` → GitHub Actions → https://mangob.github.io/wang-mai/

## Security
- The production API key allows only the production domains. Never add localhost to it, to a reCAPTCHA key or to Auth authorized domains. Develop against the Firebase Emulator.
- Never commit App Check debug tokens, service-account keys or any other secret. Secrets go in GitHub Secrets only.
- Never store user emails in Firestore.
