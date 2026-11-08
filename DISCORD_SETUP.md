# BountyFlow Discord feed

New bug bounty programs posted straight into a Discord channel, as one short card per scan. It runs for free on GitHub Actions and posts through a Discord webhook: no bot, no server.

```
GitHub Actions, twice a day (07:17 and 19:17 UTC)
  ├─ downloads every public program (HackerOne, Bugcrowd, Intigriti, YesWeHack)
  ├─ updates data/first-seen.json (powers the website's New page)
  ├─ compares with the last scan (scripts/discord-digest/state.json)
  └─ posts at most ONE message, or stays silent
```

## What gets posted

- **New programs:** every new open program since the last scan, paid ones first. Two lines each: name and platform, then reward, scope, level and links to the program page and the BountyFlow playbook. Up to 8 per message, then a link to the New page for the rest.
- **Weekly top picks:** once a week, the 3 best programs for students right now (never repeating recent picks).
- **First message:** a short "BountyFlow is live" card listing the programs that launched this week.
- Nothing new? Nothing is posted.

## Setup (one time)

1. In Discord, create a text channel, then open it: **Edit Channel → Integrations → Webhooks → New Webhook**. Name it `BountyFlow` and click **Copy Webhook URL**.
2. In this GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**. Name: `DISCORD_WEBHOOK`. Value: the webhook URL.
3. Test it: **Actions → BountyFlow tracker → Run workflow → mode `test` → Run workflow**. A sample card appears in the channel within a minute or two. Test runs never change the saved state.

That's it. The next scheduled run posts the "BountyFlow is live" card, and from then on only new programs and the weekly picks.

Optional repo **variables** (Variables tab, not Secrets): `SITE_URL` to point links at another copy of the site, `AVATAR_URL` for a different bot picture (PNG/JPG). Both default to the GitHub Pages site.

## Tuning

Knobs at the top of `scripts/discord_digest.py`:

| Knob | Default | Effect |
|---|---|---|
| `ALERT_REQUIRES_PAID` | False | True = skip new programs that pay no cash (VDPs) |
| `ALERT_MIN_SCORE` | 0 | Raise (0-99) to only announce higher-value programs |
| `ALERT_MAX_LISTED` | 8 | Programs per message before "+N more" |
| `WEEKLY_INTERVAL_DAYS` | 7 | Days between top-pick roundups |
| `WEEKLY_TOP` | 3 | Programs in the roundup |

The schedule is the `cron` line in `.github/workflows/bountyflow-tracker.yml`.

Preview any message locally without posting:

```bash
python scripts/discord_digest.py --mode=test --dry-run
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Run fails with `HTTP 401/404` from Discord | The webhook was deleted or regenerated. Copy it again into the `DISCORD_WEBHOOK` secret. |
| Runs are green but nothing posts | Quiet runs mean nothing new. The run log says `quiet run`. |
| Schedule stops after a long quiet period | GitHub pauses schedules on inactive repos. Actions tab → enable the workflow again. |
| Posts arrive a few minutes after the scheduled time | Normal: GitHub cron can drift under load. |

To make the feed forget what it already posted (and send the welcome card again), delete `scripts/discord-digest/state.json`.
