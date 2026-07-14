# FairPlay

Play mini-games **fairly** — same puzzle, compare scores. Offline-first PWA, no ads, no account, no backend.

**Live:** https://aufun00.github.io/fairplay/

## How it works
- Start a round → the layout + score are encoded into a shareable invite link.
- Someone else plays the **same** round (same puzzle = fair) → compare scores.
- No DB, no backend, no accounts. Static HTML on GitHub Pages.
- The platform guarantees **procedural fairness** only (same puzzle, same rules). Trust in your opponent, and anything off-platform, is the users' own business (money-blind: no money features).

## Structure (`WWW/` is the deployed site root)
```
WWW/
├─ index.html            Home + invite router (?g=<id>&p=<param>)
├─ common.css            Shared frame + top bar
├─ games.js              Game registry (1=match3, 2=mathdoku)
├─ index.lang.en.js      Home + common i18n
├─ sw.js                 Service worker (cache name = version = fairplay.x.y.z)
├─ manifest.webmanifest
└─ <game>/
   ├─ <game>.html
   ├─ <game>.lang.en.js  Game-specific i18n
   └─ <game>.invcode.js  Invite-code encode/decode
```

## Conventions
- **Version = SW cache name**, single source of truth: `fairplay.major.minor.patch`.
- Navigation/HTML = network-first; static assets = cache-first.
- Determinism: integer math, no `Math.random` in generators → same bytes = same round across devices.

Deployed via GitHub Actions (`.github/workflows/pages.yml`) publishing `WWW/`.
