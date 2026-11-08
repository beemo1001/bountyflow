#!/usr/bin/env python3
# ============================================================
#  BountyFlow · Discord Digest
#  Sends students ONE tidy Discord message when there is
#  something actually worth their time: brand-new programs
#  that pay, plus a weekly "best picks for students" roundup.
#
#  Anti-spam by design:
#    - at most ONE message per run; completely silent when
#      there is nothing worth posting
#    - new-program alerts fire only for programs that pay
#      cash AND score well for students (ALERT_MIN_SCORE)
#    - the weekly roundup skips recently featured programs
#    - the first run is a friendly welcome, never a dump
#
#  Zero cost, zero servers, zero API keys beyond a Discord
#  webhook. Data source is the same one the website uses:
#  arkadiyt/bounty-targets-data (auto-updated every 30 min).
#
#  Modes:
#    digest (default)  scheduled run; posts only on news or
#                      when the weekly roundup is due
#    force             post the roundup now even if not due
#    test              build a sample digest from live data;
#                      saved state is never read or written
#
#  Usage:
#    python scripts/discord_digest.py
#    python scripts/discord_digest.py --mode=test
#    python scripts/discord_digest.py --dry-run
#    python scripts/discord_digest.py --webhook=<url>
#
#  Everything a teacher may want to tune is in the KNOBS
#  section right below.
# ============================================================

import gzip
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

# ------------------------------------------------------------
# KNOBS (tune freely)
# ------------------------------------------------------------

# New-program alerts: every new open program is listed, paid ones first
ALERT_MIN_SCORE = 0           # raise (0-99) to only announce higher-value programs
ALERT_REQUIRES_PAID = False   # True = skip new programs that pay no cash (VDPs)
ALERT_MAX_LISTED = 8          # programs shown per message; the rest link to the New page

# Weekly roundup
WEEKLY_INTERVAL_DAYS = 7      # one roundup per week (alerts happen in between)
WEEKLY_TOP = 3                # programs featured in the roundup
WEEKLY_MIN_SCORE = 40
WEEKLY_AVOID_RECENT = 8       # skip programs featured in recent roundups

# Where Discord links send members: the BountyFlow app inside the Whop community.
# (Whop's website embed does not forward query strings, so links open the app's home page,
# where new programs sit at the top under "Just launched".)
# Override with the APP_URL repo variable. The bot avatar is served from the public site.
DEFAULT_APP = "https://whop.com/cyberflow/exp_SUX6Kgq38007TT/app/"
DEFAULT_SITE = "https://beemo1001.github.io/bountyflow/"

# Footer note on every message (edit to match your cron schedule)
NEXT_SCAN_NOTE = "next scan in about 12h"

# Data sources: raw GitHub + jsDelivr mirror (identical to the website)
SOURCES = {
    "hackerone": [
        "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/master/data/hackerone_data.json",
        "https://cdn.jsdelivr.net/gh/arkadiyt/bounty-targets-data@master/data/hackerone_data.json",
    ],
    "bugcrowd": [
        "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/master/data/bugcrowd_data.json",
        "https://cdn.jsdelivr.net/gh/arkadiyt/bounty-targets-data@master/data/bugcrowd_data.json",
    ],
    "intigriti": [
        "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/master/data/intigriti_data.json",
        "https://cdn.jsdelivr.net/gh/arkadiyt/bounty-targets-data@master/data/intigriti_data.json",
    ],
    "yeswehack": [
        "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/master/data/yeswehack_data.json",
        "https://cdn.jsdelivr.net/gh/arkadiyt/bounty-targets-data@master/data/yeswehack_data.json",
    ],
}

# Same static FX the website uses (filtering-grade approximation)
FX = {"USD": 1, "EUR": 1.08, "GBP": 1.27}

PLATFORM_LABEL = {
    "hackerone": "HackerOne",
    "bugcrowd": "Bugcrowd",
    "intigriti": "Intigriti",
    "yeswehack": "YesWeHack",
}
PLATFORM_COLOR = {
    "hackerone": 0xD8D8DE,
    "bugcrowd": 0xF28C5A,
    "intigriti": 0x6FD3C2,
    "yeswehack": 0xF5D26B,
}
BRAND_BLUE = 0xE0243A  # CyberFlow crimson (name kept for compatibility)

CAT_LABEL = {
    "web": "web", "api": "API", "wildcard": "wildcard", "mobile": "mobile",
    "desktop": "desktop", "network": "network", "iot": "IoT",
    "hardware": "hardware", "source": "source code", "web3": "web3",
    "ai": "AI", "other": "other",
}
DIFF_LABEL = {"beginner": "Beginner", "intermediate": "Intermediate", "advanced": "Advanced"}

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.environ.get("STATE_FILE", os.path.join(HERE, "discord-digest", "state.json"))

USER_AGENT = "BountyFlow-Digest/1.0 (educational project; data: arkadiyt/bounty-targets-data)"

# ------------------------------------------------------------
# Small helpers
# ------------------------------------------------------------

DASH_CHARS = "\u2012\u2013\u2014\u2015\u2212\u2e3a\u2e3b"  # never ship em/en dashes


def clean(s):
    """Make external text safe for Discord markdown and dash-free."""
    if not s:
        return ""
    s = str(s)
    for ch in DASH_CHARS:
        s = s.replace(ch, "-")
    return s.replace("`", "'").replace("[", "(").replace("]", ")").replace("\n", " ").strip()


def clip(s, n):
    s = s or ""
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def money(v):
    return "${:,}".format(v)


def kmoney(v):
    if v >= 1000000:
        return "$" + "{:.1f}".format(v / 1000000).rstrip("0").rstrip(".") + "M"
    if v >= 1000:
        return "$" + "{:.1f}".format(v / 1000).rstrip("0").rstrip(".") + "k"
    return "$" + str(v)


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s):
    try:
        return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def log(msg):
    print("[digest] " + msg)


# ------------------------------------------------------------
# Fetching (with jsDelivr mirror fallback, gzip aware)
# ------------------------------------------------------------

def fetch_json(url, timeout=120):
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            data = gzip.decompress(data)
    return json.loads(data.decode("utf-8"))


def fetch_platform(name):
    last_err = None
    for url in SOURCES[name]:
        try:
            t0 = time.time()
            raw = fetch_json(url)
            log("fetched %-9s %5d programs (%.1fs)" % (name, len(raw), time.time() - t0))
            return raw
        except Exception as e:
            last_err = e
            log("source failed for %s (%s), trying mirror" % (name, e))
    raise RuntimeError("all sources failed for " + name + ": " + str(last_err))


# ------------------------------------------------------------
# Normalization (faithful port of js/data.js so program IDs
# are IDENTICAL to the website: deep links like
# yoursiteserver/#/program/h1-tesla keep working)
# ------------------------------------------------------------

H1_TYPE = {
    "URL": "web", "WILDCARD": "wildcard", "OTHER": "other",
    "GOOGLE_PLAY_APP_ID": "mobile", "APPLE_STORE_APP_ID": "mobile",
    "WINDOWS_APP_STORE_APP_ID": "mobile", "TESTFLIGHT": "mobile",
    "OTHER_APK": "mobile", "OTHER_IPA": "mobile",
    "SOURCE_CODE": "source", "IP_ADDRESS": "network", "CIDR": "network",
    "DOWNLOADABLE_EXECUTABLES": "desktop", "HARDWARE": "hardware",
    "API": "api", "SMART_CONTRACT": "web3", "AI_MODEL": "ai",
}
BC_TYPE = {
    "website": "web", "api": "api", "network": "network", "ios": "mobile",
    "android": "mobile", "hardware": "hardware", "ip_address": "network",
    "iot": "iot", "other": "other",
}
INT_TYPE = {
    "url": "web", "wildcard": "wildcard", "android": "mobile", "ios": "mobile",
    "iprange": "network", "device": "hardware", "other": "other",
}
YWH_TYPE = {
    "web-application": "web", "api": "api",
    "mobile-application-android": "mobile", "mobile-application-ios": "mobile",
    "mobile-application": "mobile", "wildcard": "wildcard",
    "application": "desktop", "challenge": "other", "ai-model": "ai", "other": "other",
}


def text_clip(s, n):
    if not s:
        return ""
    s = str(s).strip()
    return s[:n]


def scope_item(cat, target, note="", bounty_eligible=False, max_severity=None):
    return {
        "cat": cat or "other",
        "t": text_clip(target, 300),
        "n": text_clip(note, 400),
        "b": bounty_eligible is True,
        "s": text_clip(max_severity, 20) or None,
    }


def to_usd(value, currency):
    if value is None or value <= 0:
        return None
    return round(value * FX.get(currency, 1))


def slug(s):
    # mirrors JS: s.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    import re as _re
    return _re.sub(r"[^a-z0-9]+", "-", (s or "").lower())


def norm_hackerone(p):
    scope, oos = [], []
    tg = p.get("targets") or {}
    for t in tg.get("in_scope") or []:
        scope.append(scope_item(
            H1_TYPE.get(t.get("asset_type")),
            t.get("asset_identifier"), t.get("instruction"),
            t.get("eligible_for_bounty"), t.get("max_severity"),
        ))
    for t in tg.get("out_of_scope") or []:
        oos.append(scope_item(H1_TYPE.get(t.get("asset_type"), "other"), t.get("asset_identifier"), t.get("instruction")))
    handle = p.get("handle") or p.get("name")
    return {
        "id": "h1-" + slug(handle),
        "name": p.get("name") or p.get("handle") or "Unnamed",
        "platform": "hackerone",
        "url": p.get("url") or ("https://hackerone.com/" + (p.get("handle") or "")),
        "offersBounties": bool(p.get("offers_bounties")),
        "offersSwag": bool(p.get("offers_swag")),
        "maxBountyUSD": None, "minBountyUSD": None,
        "bountyCurrency": "USD", "bountyKnown": False,
        "safeHarbor": None, "allowsDisclosure": None,
        "managed": bool(p.get("managed_program")),
        "submissionState": p.get("submission_state") or "open",
        "responseEfficiency": p.get("response_efficiency_percentage"),
        "avgFirstResponseDays": p.get("average_time_to_first_program_response"),
        "avgResolvedDays": p.get("average_time_to_report_resolved"),
        "summary": None,
        "scope": scope, "oos": oos,
    }


def norm_bugcrowd(p):
    scope, oos = [], []
    tg = p.get("targets") or {}
    for t in tg.get("in_scope") or []:
        scope.append(scope_item(BC_TYPE.get(t.get("type")), t.get("target") or t.get("uri"), t.get("name")))
    for t in tg.get("out_of_scope") or []:
        oos.append(scope_item(BC_TYPE.get(t.get("type"), "other"), t.get("target") or t.get("uri"), t.get("name")))
    mx = p.get("max_payout")
    mx = mx if (isinstance(mx, (int, float)) and mx > 0) else None
    return {
        "id": "bc-" + slug(p.get("name")),
        "name": (p.get("name") or "Unnamed").strip(),
        "platform": "bugcrowd",
        "url": p.get("url"),
        "offersBounties": bool(mx),
        "offersSwag": False,
        "maxBountyUSD": mx, "minBountyUSD": None,
        "bountyCurrency": "USD", "bountyKnown": bool(mx),
        "safeHarbor": p.get("safe_harbor") or None,
        "allowsDisclosure": bool(p.get("allows_disclosure")),
        "managed": bool(p.get("managed_by_bugcrowd")),
        "submissionState": "open",
        "responseEfficiency": None,
        "avgFirstResponseDays": None, "avgResolvedDays": None,
        "summary": None,
        "scope": scope, "oos": oos,
    }


def norm_intigriti(p):
    scope, oos = [], []
    tg = p.get("targets") or {}
    for t in tg.get("in_scope") or []:
        scope.append(scope_item(INT_TYPE.get(t.get("type")), t.get("endpoint") or t.get("target") or "", t.get("description")))
    for t in tg.get("out_of_scope") or []:
        oos.append(scope_item(INT_TYPE.get(t.get("type"), "other"), t.get("endpoint") or t.get("target") or "", t.get("description")))
    mx_b = p.get("max_bounty") or {}
    mn_b = p.get("min_bounty") or {}
    cur = mx_b.get("currency") or "EUR"
    mx = mx_b.get("value") if (mx_b.get("value") or 0) > 0 else None
    mn = mn_b.get("value") if (mn_b.get("value") or 0) > 0 else None
    return {
        "id": "int-" + str(p.get("handle") or p.get("id")),
        "name": p.get("name") or "Unnamed",
        "platform": "intigriti",
        "url": p.get("url"),
        "offersBounties": bool(mx),
        "offersSwag": False,
        "maxBountyUSD": to_usd(mx, cur), "minBountyUSD": to_usd(mn, cur),
        "bountyCurrency": cur, "bountyKnown": bool(mx),
        "safeHarbor": None, "allowsDisclosure": None,
        "managed": False,
        "submissionState": "open" if p.get("status") in (None, "open") else p.get("status"),
        "responseEfficiency": None,
        "avgFirstResponseDays": None, "avgResolvedDays": None,
        "summary": None,
        "scope": scope, "oos": oos,
    }


def norm_yeswehack(p):
    scope, oos = [], []
    tg = p.get("targets") or {}
    for t in tg.get("in_scope") or []:
        scope.append(scope_item(YWH_TYPE.get(t.get("type")), t.get("target"), t.get("description")))
    for t in tg.get("out_of_scope") or []:
        oos.append(scope_item(YWH_TYPE.get(t.get("type"), "other"), t.get("target"), t.get("description")))
    mx = p.get("max_bounty") if (p.get("max_bounty") or 0) > 0 else None
    mn = p.get("min_bounty") if (p.get("min_bounty") or 0) > 0 else None
    return {
        "id": "ywh-" + slug(str(p.get("id") or p.get("name"))),
        "name": p.get("name") or "Unnamed",
        "platform": "yeswehack",
        "url": ("https://yeswehack.com/programs/" + str(p.get("id") or "")) if p.get("public") else None,
        "offersBounties": bool(mx),
        "offersSwag": False,
        "maxBountyUSD": to_usd(mx, "EUR"), "minBountyUSD": to_usd(mn, "EUR"),
        "bountyCurrency": "EUR", "bountyKnown": bool(mx),
        "safeHarbor": None, "allowsDisclosure": None,
        "managed": bool(p.get("managed")),
        "submissionState": "disabled" if p.get("disabled") else "open",
        "responseEfficiency": None,
        "avgFirstResponseDays": None, "avgResolvedDays": None,
        "summary": None,
        "scope": scope, "oos": oos,
    }


def dedupe_ids(lst):
    # mirrors the website's dedupeId() exactly (collision => "-N" suffix)
    seen = set()
    for p in lst:
        if p["id"] in seen:
            p["id"] = p["id"] + "-" + str(len(seen))
        seen.add(p["id"])
    return lst


def load_programs():
    """Fetch all 4 platform datasets and normalize them. Raises if any platform fails."""
    programs = []
    for name, norm in (
        ("hackerone", norm_hackerone),
        ("bugcrowd", norm_bugcrowd),
        ("intigriti", norm_intigriti),
        ("yeswehack", norm_yeswehack),
    ):
        raw = fetch_platform(name)
        programs.extend(norm(p) for p in raw)
    return dedupe_ids(programs)


# ------------------------------------------------------------
# Analysis (port of js/analyzer.js: same difficulty rules and
# the same WHY strings students see on the website)
# ------------------------------------------------------------

def build_tools(cats):
    """Free toolkit per attack surface; identical picks to the site's playbook."""
    tools = []
    if "web" in cats or "wildcard" in cats:
        tools += ["Burp Suite Community", "ffuf", "subfinder", "httpx", "nuclei", "waybackurls"]
    if "api" in cats:
        tools += ["Burp (Repeater)", "Postman", "jwt_tool"]
    if "mobile" in cats:
        tools += ["apktool", "jadx", "MobSF", "Frida"]
    if "network" in cats:
        tools += ["Nmap", "testssl.sh"]
    if "web3" in cats:
        tools += ["Foundry", "Slither", "Etherscan"]
    if "source" in cats:
        tools += ["Semgrep", "CodeQL"]
    if not tools:
        tools = ["Burp Suite Community", "OWASP ZAP"]
    out, seen_t = [], set()
    for t in tools:
        if t not in seen_t:
            out.append(t)
            seen_t.add(t)
    return out[:8]


def build_first_moves(cats):
    moves = []
    if "wildcard" in cats:
        moves.append("Enumerate subdomains: subfinder -d <domain> -all | httpx -silent, then eyeball every live host")
    if "web" in cats:
        moves.append("Map old URLs: waybackurls <domain> | sort -u, then fuzz hidden paths with ffuf")
    if "api" in cats:
        moves.append("Collect the API surface: docs, JS files and mobile traffic; note every object ID you see")
    if "mobile" in cats:
        moves.append("Set up the lab: Android emulator + Burp proxy + jadx, then watch the app's traffic")
    if "network" in cats:
        moves.append("Enumerate services with nmap -sV (respect the program's rate limits)")
    if "web3" in cats:
        moves.append("Read the contracts on the explorer; map external calls and state changes")
    if "source" in cats:
        moves.append("Trace untrusted input into exec/query/eval sinks")
    if not moves:
        moves.append("Read the policy, map the assets, fingerprint the stack")
    return moves[:2]


def analyze(p):
    cat_counts = {}
    total = 0
    for t in p["scope"]:
        cat_counts[t["cat"]] = cat_counts.get(t["cat"], 0) + 1
        total += 1

    shares = {c: (n / total if total else 0) for c, n in cat_counts.items()}
    top_cats = sorted(cat_counts.items(), key=lambda kv: kv[1], reverse=True)

    n = lambda k: cat_counts.get(k, 0)
    share = lambda c: shares.get(c, 0)

    score = 40
    why = []
    if n("wildcard") > 0:
        score -= 12; why.append("wildcard scope, broad recon surface (+easy)")
    if n("web") >= 50:
        score -= 12; why.append("50+ web assets, huge attack surface (+easy)")
    elif n("web") >= 10:
        score -= 8; why.append("10+ web assets, plenty of surface to explore (+easy)")
    if not p["offersBounties"]:
        score -= 6; why.append("VDP (no cash bounty), far less competition, ideal practice (+easy)")
    if p["safeHarbor"] == "full":
        score -= 4; why.append("full safe harbor, strong legal protection (+easy)")
    if p["managed"] and p["platform"] == "hackerone":
        score -= 3; why.append("managed program, structured rules (+easy)")
    if p["offersSwag"]:
        score -= 2; why.append("swag rewards, relaxed beginner attitude (+easy)")
    if share("web3") > 0.3:
        score += 25; why.append("web3-heavy scope, Solidity/EVM expertise required (+hard)")
    if share("hardware") > 0.2 or share("iot") > 0.25:
        score += 18; why.append("hardware/IoT targets, physical & firmware skills (+hard)")
    if share("network") > 0.2:
        score += 12; why.append("network/IP-range targets, infra skills (+hard)")
    if share("source") > 0.2:
        score += 10; why.append("source-code review scope, advanced audit skills (+hard)")
    if share("ai") > 0:
        score += 10; why.append("AI/ML attack surface, poorly documented area (+hard)")
    if share("mobile") > 0.8:
        score += 8; why.append("mobile-only scope, device setup & proxying needed (+hard)")
    if p["bountyKnown"] and (p["maxBountyUSD"] or 0) >= 100000:
        score += 8; why.append("100k+ max bounty, professionals compete here (+hard)")
    elif p["bountyKnown"] and (p["maxBountyUSD"] or 0) >= 10000:
        score += 4; why.append("10k+ max bounty, moderate competition (+hard)")
    if p["responseEfficiency"] is not None and p["responseEfficiency"] < 50:
        score += 5; why.append("low response efficiency ({}%), slow feedback (+hard)".format(p["responseEfficiency"]))
    if p["avgFirstResponseDays"] is not None and p["avgFirstResponseDays"] > 7:
        score += 4; why.append("slow first response (~{}d) (+hard)".format(round(p["avgFirstResponseDays"])))
    if 0 < total < 3:
        score += 6; why.append("tiny scope ({} assets), precision required (+hard)".format(total))

    score = max(5, min(95, round(score)))
    level = "beginner" if score <= 33 else ("intermediate" if score <= 66 else "advanced")

    return {
        "cats": cat_counts, "top_cats": top_cats, "total": total,
        "score": score, "level": level, "why": why,
        "tools": build_tools(cat_counts),
        "first_moves": build_first_moves(cat_counts),
    }


def student_value(p, a):
    """How worthwhile this program is FOR A STUDENT right now (roughly 0-99).

    Combines: real money, realistic difficulty, student-accessible
    surface (web/API/wildcard), scope size, responsiveness, legal safety.
    """
    v = 0
    mx = p["maxBountyUSD"] or 0
    if p["bountyKnown"] and mx >= 100000:
        v += 30
    elif p["bountyKnown"] and mx >= 10000:
        v += 24
    elif p["bountyKnown"] and mx >= 1000:
        v += 16
    elif p["offersBounties"]:
        v += 18        # pays, amounts not published (H1 style)
    elif p["offersSwag"]:
        v += 6
    else:
        v += 2         # VDP: practice value only

    v += {"beginner": 30, "intermediate": 18, "advanced": 6}[a["level"]]

    n = a["cats"].get
    if a["total"] and (n("web", 0) + n("api", 0) + n("wildcard", 0)) / a["total"] >= 0.7:
        v += 10        # nothing exotic needed to start
    if n("wildcard", 0) > 0:
        v += 5         # subdomain hunting, the classic student entry
    v += min(10, a["total"] / 6)

    if p["responseEfficiency"] is not None:
        v += 8 if p["responseEfficiency"] >= 80 else (4 if p["responseEfficiency"] >= 50 else 0)
    else:
        v += 3
    if p["safeHarbor"] == "full":
        v += 6
    return round(v, 1)


def analyze_all(programs):
    for p in programs:
        a = analyze(p)
        a["value"] = student_value(p, a)
        a["snapshot"] = snapshot(p, a)
        p["analysis"] = a
    return programs


def snapshot(p, a):
    """One sentence describing the scope, same voice as the website."""
    if not a["total"]:
        return "No in-scope assets listed. Read the policy before testing."
    top = a["top_cats"]
    bits = []
    if len(top) == 1:
        bits.append("{} {} {}".format(top[0][1], CAT_LABEL.get(top[0][0], "other"), "target" if top[0][1] == 1 else "targets"))
    else:
        bits.append(" + ".join("{} {}".format(c, CAT_LABEL.get(k, "other")) for k, c in top[:2]) + " targets")
    if len(top) > 2:
        bits.append("{} more types".format(len(top) - 2))
    if a["cats"].get("wildcard"):
        bits.append("wildcard recon open")
    return ", ".join(bits[:3]) + "."


# ------------------------------------------------------------
# Discord embeds
# ------------------------------------------------------------

def deep_link(p, base):
    return (base + "?program=" + p["id"]) if base else None


def money_line(p):
    if p["bountyKnown"] and p["maxBountyUSD"]:
        s = "up to " + money(p["maxBountyUSD"])
        if p["minBountyUSD"]:
            s += " (min " + money(p["minBountyUSD"]) + ")"
        if p["bountyCurrency"] and p["bountyCurrency"] != "USD":
            s += ", paid in " + p["bountyCurrency"]
        return s
    if p["offersBounties"]:
        s = "cash bounties, amounts vary by severity"
        if p["platform"] == "hackerone":
            s += " (H1 does not publish amounts)"
        return s
    if p["offersSwag"]:
        return "no cash, swag + hall of fame"
    return "no cash bounty (VDP), points & thanks"


def scope_line(p, a):
    parts = ["{} in-scope targets".format(a["total"])]
    tops = " · ".join("{} {}".format(c, CAT_LABEL.get(k, "other")) for k, c in a["top_cats"][:3])
    if tops:
        parts.append(tops)
    sample = sorted((t["t"] for t in p["scope"] if t["t"]), key=len)[:3]
    if sample:
        parts.append("e.g. " + ", ".join(clean(s) for s in sample))
    return " · ".join(parts)


def short_reward(p):
    if p["bountyKnown"] and p["maxBountyUSD"]:
        return "Up to " + kmoney(p["maxBountyUSD"])
    if p["offersBounties"]:
        return "Cash bounties"
    return "Swag, no cash" if p["offersSwag"] else "No cash (VDP)"


def program_block(p, base):
    """Two short lines per program: who, then what it pays, what is in scope, how hard, links."""
    a = p["analysis"]
    cats = ", ".join(CAT_LABEL.get(k, "other") for k, _ in a["top_cats"][:2])
    scope = "{} target{}".format(a["total"], "" if a["total"] == 1 else "s") + (" ({})".format(cats) if cats else "")
    links = ["[Program page](" + p["url"] + ")"] if p["url"] else []
    name = clean(p["name"])
    if name.lower() in ("vdp", "bbp", "bug bounty", "bug bounty program", "vulnerability disclosure program") and p["url"] and "/programs/" in p["url"]:
        company = p["url"].split("/programs/")[1].split("/")[0].replace("-", " ").title()
        name = company + " " + name     # e.g. Intigriti's "VDP" -> "Showpad VDP"
    line1 = "**{}** · {}".format(name[:80], PLATFORM_LABEL[p["platform"]])
    line2 = " · ".join([short_reward(p), scope, DIFF_LABEL[a["level"]]] + links)
    return line1 + "\n" + line2


def card(title, intro, blocks, more_line, now):
    desc = (intro + "\n\n" if intro else "") + "\n\n".join(blocks)
    if more_line:
        desc += "\n\n" + more_line
    return {"title": title, "description": desc, "color": BRAND_BLUE,
            "footer": {"text": "BountyFlow by CyberFlow · checked twice a day"}, "timestamp": iso(now)}


def new_page(base):
    return (base or DEFAULT_APP) + "?view=new"


def listing(programs, base, now, title, intro):
    paid = [p for p in programs if is_paid(p)]
    free = [p for p in programs if not is_paid(p)]
    ordered = by_value(paid) + by_value(free)
    shown = ordered[:ALERT_MAX_LISTED]
    more = len(ordered) - len(shown)
    if more > 0:
        more_line = "+{} more · [Open BountyFlow]({}) for scopes, difficulty and a playbook for each".format(more, base or DEFAULT_APP)
    else:
        more_line = "[Open BountyFlow]({}) for scopes, difficulty and a playbook for each".format(base or DEFAULT_APP)
    return card(title, intro, [program_block(p, base) for p in shown], more_line, now), shown


def first_seen_recent(programs, days):
    """Open programs whose first-seen date (data/first-seen.json, kept by the tracker) is within `days`."""
    try:
        fs = json.load(open(os.path.join(HERE, "..", "data", "first-seen.json"), encoding="utf-8")).get("first_seen", {})
    except Exception:
        return []
    cutoff = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")
    return [p for p in programs if fs.get(p["id"], "") >= cutoff and p["submissionState"] == "open"]


def fit_embeds(embeds):
    """Enforce every Discord embed limit, then trim to the 6000 char budget."""
    for e in embeds:
        if "title" in e:
            e["title"] = clip(e["title"], 256)
        if "description" in e:
            e["description"] = clip(e["description"], 4096)
        for f in e.get("fields", []):
            f["name"] = clip(f["name"], 256)
            f["value"] = clip(f["value"], 1024)
        if "footer" in e:
            e["footer"]["text"] = clip(e["footer"]["text"], 2048)

    def total(es):
        t = 0
        for e in es:
            t += len(e.get("title", "")) + len(e.get("description", "")) + len(e.get("footer", {}).get("text", ""))
            t += sum(len(f["name"]) + len(f["value"]) for f in e.get("fields", []))
        return t

    while embeds and total(embeds) > 5900:
        last = embeds[-1]
        if last.get("fields"):
            last["fields"].pop()
            if not last["fields"] and len(embeds) > 1:
                embeds.pop()
        elif len(embeds) > 1:
            embeds.pop()
        else:
            break
    return embeds[:10]


def build_payload(embeds, avatar_url):
    payload = {
        "username": "BountyFlow",
        "allowed_mentions": {"parse": []},   # program names can never ping anyone
        "embeds": fit_embeds(embeds),
    }
    if avatar_url:
        payload["avatar_url"] = avatar_url
    return payload


def post_to_discord(webhook, payload):
    data = json.dumps(payload).encode("utf-8")
    for attempt in (1, 2):
        req = urllib.request.Request(webhook, data=data, headers={
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp.read()
            return True
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt == 1:
                wait = int(e.headers.get("Retry-After", "5")) + 1
                log("rate limited, waiting {}s".format(wait))
                time.sleep(wait)
                continue
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")[:300]
            except Exception:
                pass
            raise RuntimeError("Discord rejected the message: HTTP {} {}".format(e.code, body))
    return False


# ------------------------------------------------------------
# State (tiny JSON file committed back to the repo by the
# workflow; remembers what was already announced)
# ------------------------------------------------------------

def default_state():
    return {"version": 1, "seen": {}, "gone": {}, "spotlight_history": [],
            "last_weekly": None, "last_post": None, "last_run": None}


def load_state(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            st = json.load(f)
        base = default_state()
        base.update(st)
        return base
    except FileNotFoundError:
        return default_state()
    except Exception as e:
        log("state file unreadable ({}), starting fresh".format(e))
        return default_state()


def save_state(path, state):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=True, indent=1)
        f.write("\n")
    os.replace(tmp, path)


def update_state(state, programs, featured_ids, weekly_posted, posted, now):
    ids_now = {p["id"] for p in programs}
    seen = state.get("seen") or {}

    # keep first-seen dates for survivors; record today for newcomers
    new_seen = {}
    for p in programs:
        old = seen.get(p["id"]) or {}
        new_seen[p["id"]] = {"first": old.get("first") or iso(now)}

    # programs that vanished: remember for 30 days so a dataset
    # hiccup never causes a false "new program" alert on return
    gone = dict(state.get("gone") or {})
    for pid in seen:
        if pid not in ids_now and pid not in gone:
            gone[pid] = iso(now)
    cutoff = now - timedelta(days=30)
    gone = {pid: d for pid, d in gone.items()
            if (parse_iso(d) or now) >= cutoff and pid not in ids_now}

    history = list(state.get("spotlight_history") or [])
    for pid in featured_ids:
        history.append({"id": pid, "at": iso(now)})

    state.update({
        "version": 1,
        "seen": new_seen,
        "gone": gone,
        "spotlight_history": history[-12:],
        "last_run": iso(now),
    })
    if weekly_posted:
        state["last_weekly"] = iso(now)
    if posted:
        state["last_post"] = iso(now)
    return state


# ------------------------------------------------------------
# The anti-spam brain: decide IF and WHAT to post
# ------------------------------------------------------------

def is_paid(p):
    return p["offersBounties"] or p["bountyKnown"]


def by_value(pool):
    return sorted(pool, key=lambda p: (-p["analysis"]["value"], p["name"].lower()))


def weekly_picks(programs, history_ids):
    open_paid = [p for p in programs
                 if p["submissionState"] == "open" and is_paid(p)
                 and p["analysis"]["value"] >= WEEKLY_MIN_SCORE]
    fresh = [p for p in open_paid if p["id"] not in history_ids]
    pool = fresh if len(fresh) >= WEEKLY_TOP else open_paid
    return by_value(pool)[:WEEKLY_TOP]


def plan(mode, programs, state, now):
    """Returns a dict: type, embeds, featured ids, post?, weekly?, write_state?"""
    base = os.environ.get("APP_URL") or DEFAULT_APP
    if not base.endswith("/"):
        base += "/"
    seen = state.get("seen") or {}

    # ---- test mode and the very first run: the programs that launched this week ----
    if mode == "test" or not seen:
        recent = first_seen_recent(programs, 7)
        if mode == "test":
            title = "Test message: new programs this week"
            intro = "If you can read this, the BountyFlow feed works. Real posts look exactly like this."
        else:
            title = "BountyFlow is live in this channel"
            intro = "New bug bounty programs land here twice a day, plus a weekly top 3. Here is what launched this week:"
        if recent:
            embed, shown = listing(recent, base, now, title, intro)
        else:
            shown = weekly_picks(programs, [])
            embed = card(title, intro.replace("Here is what launched this week:", "Nothing launched yet this week, so here are 3 good picks:"),
                         [program_block(p, base) for p in shown], "", now)
        log("{}: {} programs listed".format("TEST" if mode == "test" else "WELCOME", len(shown)))
        return {"type": "test" if mode == "test" else "welcome", "embeds": [embed], "featured": [p["id"] for p in shown],
                "post": True, "weekly": mode != "test", "write_state": mode != "test"}

    # ---- diff against last scan ----
    ids_now = {p["id"] for p in programs}
    gone = state.get("gone") or {}
    returning = {pid for pid, d in gone.items() if (parse_iso(d) or now) >= now - timedelta(days=14)}
    fresh = [p for p in programs if p["id"] not in seen and p["id"] not in returning]
    retired_ids = [pid for pid in seen if pid not in ids_now]

    # safety: if the dataset looks broken (mass shrinkage), do nothing
    if len(retired_ids) > max(5, 0.2 * len(seen)):
        return {"type": "anomaly", "embeds": [], "featured": [], "post": False, "weekly": False, "write_state": False,
                "abort": "dataset shrank by {} of {} programs, refusing to post".format(len(retired_ids), len(seen))}

    notables = [p for p in fresh if p["submissionState"] == "open"
                and (not ALERT_REQUIRES_PAID or is_paid(p)) and p["analysis"]["value"] >= ALERT_MIN_SCORE]
    last_weekly = parse_iso(state.get("last_weekly") or "")
    weekly_due = (last_weekly is None) or (now - last_weekly) >= timedelta(days=WEEKLY_INTERVAL_DAYS)

    # ---- 1) new programs since the last scan ----
    if notables:
        n = len(notables)
        embed, shown = listing(notables, base, now, "{} new bug bounty program{}".format(n, "" if n == 1 else "s"), "")
        log("new since last scan: {} (listed {}), retired: {}".format(len(fresh), len(shown), len(retired_ids)))
        return {"type": "new", "embeds": [embed], "featured": [], "post": True, "weekly": False, "write_state": True}

    # ---- 2) weekly top 3, avoiding recent picks ----
    if weekly_due or mode == "force":
        history_ids = [h["id"] for h in (state.get("spotlight_history") or [])[-WEEKLY_AVOID_RECENT:]]
        picks = weekly_picks(programs, history_ids)
        week_new = len(first_seen_recent(programs, 7))
        intro = "{} new program{} launched this week. These 3 are the best bets for students right now:".format(
            week_new, "" if week_new == 1 else "s")
        embed = card("This week's top picks", intro, [program_block(p, base) for p in picks],
                     "[Open BountyFlow]({}) to browse every program".format(base or DEFAULT_APP), now)
        return {"type": "weekly", "embeds": [embed], "featured": [p["id"] for p in picks],
                "post": True, "weekly": True, "write_state": True}

    # ---- 3) nothing new: stay silent ----
    log("quiet run: nothing new, weekly not due ({} retired)".format(len(retired_ids)))
    return {"type": "quiet", "embeds": [], "featured": [], "post": False, "weekly": False, "write_state": True}


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

def parse_args(argv):
    opts = {"mode": None, "dry": False, "webhook": None}
    for a in argv:
        if a == "--dry-run":
            opts["dry"] = True
        elif a.startswith("--mode="):
            opts["mode"] = a.split("=", 1)[1]
        elif a.startswith("--webhook="):
            opts["webhook"] = a.split("=", 1)[1]
        elif a in ("-h", "--help"):
            print(__doc__)
            sys.exit(0)
        else:
            print("unknown argument: " + a)
            sys.exit(2)
    return opts


def gh_output(key, val):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write("{}={}\n".format(key, val))


def main(argv):
    opts = parse_args(argv)
    mode = opts["mode"] or os.environ.get("RUN_MODE") or "digest"
    if mode not in ("digest", "force", "test"):
        log("unknown mode '{}', use digest, force or test".format(mode))
        return 2

    now = now_utc()
    log("mode={} time={}".format(mode, iso(now)))

    # 1. data
    try:
        programs = load_programs()
    except Exception as e:
        log("FATAL: could not load datasets: " + str(e))
        return 1
    analyze_all(programs)
    log("analyzed {} programs".format(len(programs)))

    # 2. decide
    state = load_state(STATE_FILE) if mode != "test" else default_state()
    out = plan(mode, programs, state, now)

    if out.get("abort"):
        log("FATAL: " + out["abort"])
        gh_output("state_changed", "false")
        gh_output("posted", "false")
        return 1

    # 3. post (or print)
    if out["post"]:
        payload = build_payload(out["embeds"], os.environ.get("AVATAR_URL") or DEFAULT_SITE + "logo.png")
        if opts["dry"]:
            log("DRY RUN: would post a {} message with {} embeds".format(out["type"], len(payload["embeds"])))
            print(json.dumps(payload, indent=2, ensure_ascii=True))
            gh_output("state_changed", "false")
            gh_output("posted", "false")
            return 0
        webhook = opts["webhook"] or os.environ.get("DISCORD_WEBHOOK")
        if not webhook:
            if mode == "test":
                log("no DISCORD_WEBHOOK set; printing the sample message instead")
                print(json.dumps(payload, indent=2, ensure_ascii=True))
                return 0
            log("FATAL: DISCORD_WEBHOOK is not set. Add it as a repository secret (see DISCORD_SETUP.md)")
            return 1
        try:
            post_to_discord(webhook, payload)
            log("posted a '{}' message to Discord ({} embeds)".format(out["type"], len(payload["embeds"])))
        except Exception as e:
            log("FATAL: " + str(e))
            log("state NOT updated, so the next run can retry this message")
            gh_output("state_changed", "false")
            gh_output("posted", "false")
            return 1
        gh_output("posted", "true")
    else:
        gh_output("posted", "false")

    # 4. persist state (only for real digest/force runs that posted or stayed quiet)
    if out["write_state"] and not opts["dry"]:
        state = update_state(state, programs, out["featured"], out["weekly"], out["post"], now)
        save_state(STATE_FILE, state)
        log("state saved ({} programs tracked)".format(len(state["seen"])))
        gh_output("state_changed", "true")

    log("done: " + out["type"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
