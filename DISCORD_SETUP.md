# BountyFlow Discord Digest

Send your students the best bug bounty opportunities on Discord without spamming the channel. One tidy message when something is actually worth their time: what it pays, what the scope is, what they'll need, and their first move. Everything runs for free on GitHub Actions, posting through a Discord webhook. No bot server, no hosting, no API keys beyond the webhook URL itself.

```
GitHub Actions (free, runs twice a day)
        │
        ├─ downloads the same auto-updating dataset as the website
        ├─ analyzes all ~950 programs with the same student scoring
        ├─ compares against the last scan (state.json in this repo)
        └─ posts AT MOST one message via your Discord webhook
```

## Why a webhook and not a bot?

A real Discord bot needs a process online 24/7, which means a server and maintenance. A webhook is just an address GitHub posts to: free, zero upkeep, impossible to crash. For notifications (as opposed to interactive slash commands) it does exactly the same job. This keeps the whole project on the same philosophy as the site: zero cost, zero servers, zero maintenance.

## How it avoids spamming the channel

- At most **one message per run**, and the run stays completely **silent** when there is nothing new worth posting.
- A new-program alert fires only when a program **pays cash bounties** AND scores at least `50/99` on the student-value scale (real money, realistic difficulty, web/API/wildcard surface, responsive triage, safe harbor).
- The **weekly roundup** (once every 7 days) shows the top 3 student picks and never repeats programs featured recently.
- If a post fails, the state is not updated, so the next run retries instead of losing the announcement.
- The very first run posts a short welcome with the current top 3, never a dump of all 950 programs.

## Setup (5 minutes, once)

**Step 1: create the webhook**

In Discord: open your student server, then `Server Settings` -> `Integrations` -> `Webhooks` -> `New Webhook`. Choose the channel students will read, then `Copy Webhook URL`. It looks like `https://discord.com/api/webhooks/123456789/AbCdEf...`.

**Step 2: add the secret**

In your BountyFlow GitHub repo: `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`. Name it exactly `DISCORD_WEBHOOK` and paste the webhook URL as the value. It stays secret: students never see it, and it is never written into the repo.

**Step 3 (optional but recommended): enable deep links**

Add a repository **variable** (same page, `Variables` tab, not Secrets) named `SITE_URL` set to your live site URL, for example `https://yourname.github.io/bountyflow/`. Every digest message then links straight into the full student playbook for that program (the analysis page with recon steps, vulnerability classes, out-of-scope warnings and learning path). Without it, messages link to the official program page instead.

Optional: add a variable `AVATAR_URL` pointing at a PNG logo if you want the bot to wear your branding (Discord only accepts PNG/JPG/GIF/WebP image URLs, not SVG).

**Step 4: test it**

Repo -> `Actions` tab -> `Discord bounty digest` -> `Run workflow` -> mode `test` -> `Run`. Within a minute your channel receives a sample digest built from live data. The test never changes the tracking state, so you can run it as often as you like.

That's it. The schedule (twice a day, 07:17 and 19:17 UTC, which is 08:17 and 20:17 in UTC+1) takes over from there.

## What a message looks like

```
BountyFlow                                            [blue bar]
BountyFlow digest is online
Watching 952 programs today...
Programs tracked: 952 | Paying programs: 640 | Beginner-friendly: 426 | Top published bounty: $3M

T-Mobile · Bugcrowd                                  [orange bar]
Bounties: up to $133,700
Student fit: Beginner (32/100) · full safe harbor · managed program
Why this rating: 50+ web assets, huge attack surface (+easy)
Scope: 76 in-scope targets · 69 web · e.g. https://sprint.com
What you'll need: Burp Suite Community · ffuf · subfinder · httpx · nuclei · waybackurls (all free)
First move: Map old URLs: waybackurls <domain> | sort -u, then fuzz hidden paths with ffuf
Do not touch: /self-service-*, ...
Links: Full playbook on BountyFlow · Program page

8x8 · HackerOne                                      [pink bar]
...
```

Each program card answers the three questions a student actually has: what can I earn, is this realistic for me, and what do I do first.

## Tuning

Everything lives at the top of `scripts/discord_digest.py` under `KNOBS`:

| Knob | Default | Effect |
|---|---|---|
| `ALERT_MIN_SCORE` | 50 | How good a new program must be to trigger an alert (scale 0-99) |
| `ALERT_REQUIRES_PAID` | True | Set False to also alert for new VDP programs (no cash, practice value) |
| `ALERT_MAX_SPOTLIGHT` / `ALERT_MAX_LISTED` | 2 / 6 | How many new programs get full cards vs one-line mentions |
| `WEEKLY_INTERVAL_DAYS` | 7 | Roundup frequency |
| `WEEKLY_TOP` | 3 | Programs per roundup |
| `WEEKLY_AVOID_RECENT` | 8 | Skip programs featured in the last N spotlights |
| `NEXT_SCAN_NOTE` | "next scan in about 12h" | Footer text; edit if you change the schedule |

The schedule itself is the `cron` line in `.github/workflows/discord-digest.yml` (`17 7,19 * * *` = 07:17 and 19:17 UTC daily). Use [crontab.guru](https://crontab.guru/) to compose a new one. To preview any change safely, run the workflow manually with mode `test`.

## Manual runs

`Actions` -> `Discord bounty digest` -> `Run workflow` gives you three modes:

- `digest`: exactly what the schedule does
- `test`: sample message from live data, state untouched
- `force`: post the weekly roundup right now, even if not due yet

From your own computer you can also print a message without posting it:

```bash
python3 scripts/discord_digest.py --mode=test --dry-run
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Run fails with `Discord rejected the message: HTTP 401/404` | Webhook URL is wrong or was deleted/regenerated. Copy it again into the `DISCORD_WEBHOOK` secret. |
| No messages, but runs finish green | Read the run log: quiet runs say `quiet run: ... none above threshold`. That is the anti-spam design, not a bug. |
| Messages arrive without deep links | The `SITE_URL` variable is missing or lacks the trailing path. It must be the full site URL, e.g. `https://yourname.github.io/bountyflow/`. |
| Schedule stopped after weeks of silence | GitHub disables schedules on repos with 60 days of no activity. The digest normally prevents this by committing its state file, but if it happens: `Actions` tab -> enable the workflow again. |
| Posted at 07:41 instead of 07:17 | Normal. GitHub cron can drift several minutes (sometimes up to an hour) under load. |

## Notes

- The state file `scripts/discord-digest/state.json` is committed back by the workflow after each run. It only contains program IDs and dates, nothing sensitive. Do not edit it by hand unless you want the digest to forget what it already announced (deleting it triggers a fresh welcome message).
- Cost: free on public repositories (Actions minutes are unlimited there, and this run finishes in about a minute). On a private repo it consumes a couple of Actions minutes per day.
- Data honesty, same as the website: HackerOne does not publish bounty amounts, so H1 cards show "amounts vary by severity". Bugcrowd pays USD; Intigriti and YesWeHack pay EUR (converted at a static rate for ranking only).
- The digest covers the four auto-updating platforms. Curated direct programs (Google VRP, Apple, Microsoft and friends) live on the website and in the weekly top stats, but they do not generate "new program" alerts since they are hand-curated and rarely change.
