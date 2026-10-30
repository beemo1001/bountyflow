# BountyFlow

**Every bug bounty & VDP opportunity on the internet: collected, auto-analyzed, and explained for students.**

BountyFlow is a single-page web app that aggregates ~1,000 bug bounty and vulnerability disclosure programs from every major platform, then automatically analyzes each one's scope and tells your students what they can actually do there.

- **Zero APIs, zero keys, zero cost, zero build step**: pure HTML/CSS/JS
- **Auto-updating data**: pulls the community-maintained [`arkadiyt/bounty-targets-data`](https://github.com/arkadiyt/bounty-targets-data) dataset (refreshed upstream every 30 minutes) directly from GitHub's CDN with CORS
- **Runs 100% in the browser**: nothing is uploaded anywhere; bookmarks live in your browser's local storage

---

## Deploy to GitHub Pages (3 steps)

1. **Create a new repository** on GitHub (e.g. `bountyflow`); public or private both work.
2. **Upload everything in this folder** (`index.html`, `css/`, `js/`, `data/`, `.nojekyll`, `README.md`) to the repo root. You can drag & drop the files on github.com, or:
   ```bash
   git init && git add -A && git commit -m "BountyFlow"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/bountyflow.git
   git push -u origin main
   ```
3. **Enable Pages**: repo → `Settings` → `Pages` → Source: `Deploy from a branch` → Branch: `main` / root → Save.

Your site goes live at `https://YOURNAME.github.io/bountyflow/` in about a minute. That's it: no Actions, no builds, nothing to maintain. The data stays fresh by itself.

> **Deploying to a custom domain or repo sub-path?** Everything is relative-path safe. `data/direct-programs.json` is fetched relative to the page, so sub-path hosting works out of the box.

---

## Discord digest for your students (optional, free)

Also included: a scheduled GitHub Actions workflow that posts the **best opportunities straight into a Discord channel** without spamming it. One tidy message per run, and only when there is something worth their time: new paid programs that suit students (with bounties, scope, the free tools they'll need and a first move), plus a weekly roundup of the top 3 picks.

Setup takes 5 minutes: create a Discord webhook, add it as the repository secret `DISCORD_WEBHOOK`, run the workflow once in `test` mode. Full instructions in [`DISCORD_SETUP.md`](DISCORD_SETUP.md).

---

## What it does

| Feature | Details |
|---|---|
| **Total aggregation** | HackerOne + Bugcrowd + Intigriti + YesWeHack (~950 programs, auto-updated every 30 min) + curated direct list (Google, Apple, Microsoft, Meta, Intel, Signal, ZDI, Mozilla, Tor, Apache + top Web3/Immunefi programs) |
| **Deep filters** | Money (pays/VDP/swag, min max-bounty $1k-$1M+), platform, scope type (web/API/wildcard/mobile/network/IoT/hardware/source/web3/AI), difficulty, safe harbor, disclosure, responsiveness, 18 detected technologies, min assets, accepted severity |
| **Quick filters** | Beginner-friendly · Highest bounties · Wildcard scopes · VDP practice · Fast triage · Full safe harbor |
| **Auto-analysis engine** | Every program is classified, tech-fingerprinted (60+ signatures), and difficulty-scored 0-100 with *human-readable reasons for every point* |
| **Student playbooks** | Per program: recon steps → what to hunt (OWASP/API Top 10 classes) → free toolkit → rules & warnings → realistic expectations |
| **Student Mode** | Pick your level + skills → get matched programs + a "learn this to unlock +N programs" level-up path |
| **Scope Explorer** | Type any domain → instantly see which bounty programs cover it (exact + wildcard matching) |
| **More** | Random-program roulette, bookmarks (local), live stats, fast search, mobile-friendly |

## Customization (all in plain files)

- **Colors & theme** → `css/styles.css`: everything is CSS variables at the top (`:root`). Change `--accent` (blue) / `--red` (brand mark, critical signals) and the whole site follows. Typography: IBM Plex Sans for UI, IBM Plex Mono for data values (both via Google Fonts, with system-font fallback offline).
- **Logo** → the "bug on the radar" mark (a beetle centered in a radar scope ring with a rose sweep arc) lives inline in `index.html` (header), `js/app.js` (loading screen, where the sweep rotates while data loads) and the favicon data-URI; a standalone copy ships as `logo.svg`. One geometry, easy to tweak.
- **Curated direct programs** → `data/direct-programs.json`: add/remove programs (Google-scale giants, your favorites, private invites). The site merges them automatically.
- **Analysis rules** → `js/analyzer.js`: every difficulty rule, tech signature, and vuln mapping is a readable object/regex you can edit. Each program explains *why* it got its rating; your edits will flow straight into those explanations.
- **Icons** → `js/ui.js`: the `ICONS` map holds all SVG paths (Lucide-style, stroke-based). Add an entry, use it anywhere via `BFUI.icon('name')`.
- **Filters & presets** → `js/filters.js`
- **Data sources & FX rates** → `js/config.js`

## How the data works

```
browser ──fetch──> raw.githubusercontent.com/arkadiyt/bounty-targets-data  (CORS open, ~700KB gzipped)
        └─fallback─> cdn.jsdelivr.net mirror
                     │
                     ├─ normalized to one schema per program
                     ├─ cached in IndexedDB for 24h (fast loads, no refetch)
                     └─ analyzed client-side on every session
```

The refresh button in the header force-refreshes the data immediately.

## Notes & honesty

- **HackerOne doesn't publish bounty amounts.** H1 programs show as "Cash bounties · amount varies" and match the "Bounties" filter but not min-amount filters. Exact amounts exist for Bugcrowd (USD), Intigriti & YesWeHack (EUR, converted at a static rate for filtering only).
- The analysis engine is **rule-based by design**: deterministic, instant, offline-capable, explainable: every rating shows its reasoning, which is far better for teaching than a black-box score.
- Curated bounty amounts marked `≈` are public documented figures at curation time; the UI flags them; always verify on the program page.
- This is an **educational index**. It links to official programs but is not affiliated with any platform. Always read each program's official policy before testing anything.

## Credits

- [arkadiyt/bounty-targets-data](https://github.com/arkadiyt/bounty-targets-data) (MIT): the incredible community dataset doing the heavy lifting
- HackerOne, Bugcrowd, Intigriti, YesWeHack, Immunefi and every company running a program, for making security research accessible
- Typography: IBM Plex Sans / IBM Plex Mono (SIL Open Font License)

**Hack ethically. Stay in scope. Good hunting.**
