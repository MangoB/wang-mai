# wang-mai — notes for Claude

- UI copy is Thai. Keep it plain and short.
- Current app: single file `artifact/wang-mai.html` (Vue 3.4.21 global build from cdnjs, in-file `text/x-template`).
- Published as Claude Artifact https://claude.ai/artifact/F6cwxLBK2Lv9Sif7SShZdc with capabilities `{db:{}, user:{}}`. Republish to that URL; don't create a new artifact.
- Data model: `docs/data-model.md`. Keep it Firestore-compatible; update the doc when fields change.
- Artifact CSP: no external images/iframes/fetch; scripts only from cdnjs/jsdelivr/unpkg; fonts from Google Fonts.
- Theme tokens on `:root` with dark-mode overrides; keep both themes working.
