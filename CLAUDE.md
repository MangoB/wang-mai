# wang-mai — notes for Claude / agents

Read `docs/development.md` first: file layout and conventions. Security work follows `docs/security.md` step by step.

- UI copy is Thai. Keep it plain and short.
- No build step: Vue 3 + Firebase loaded via import map in `index.html`. Components are JS objects with `template` strings in `src/components/`. Don't introduce `.vue` files or npm deps unless the project moves to Vite.
- All Firestore access lives in `src/store.js`. Components call store functions only.
- Changing stored fields means updating `src/store.js`, `firestore.rules`, and `docs/data-model.md` together. Rules are published separately (console or `firebase deploy --only firestore:rules`); tell the user when they need republishing.
- `src/lib/*` is dependency-free; test changes there with node.
- Style through the CSS tokens in `src/style.css`; keep light and dark working and the layout usable at 400px.
- Deploy: push to `main` → GitHub Actions → https://mangob.github.io/wang-mai/
- The local dev server talks to the production Firestore. Never trigger reset or write test data without asking.
- The old Claude Artifact version was deleted; its source is in git history (commit f2e2091).
