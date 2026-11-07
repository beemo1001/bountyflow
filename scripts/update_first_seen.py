#!/usr/bin/env python3
"""Keeps data/first-seen.json current: every program ID that appears in the
dataset for the first time gets today's date. The website reads this file to
power the "New" feed and NEW badges. Run by .github/workflows/bountyflow-tracker.yml.
"""
import importlib.util, json, os, sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "first-seen.json")
KEEP_DAYS = 120  # forget first-seen dates older than this to keep the file small

spec = importlib.util.spec_from_file_location("dd", os.path.join(HERE, "discord_digest.py"))
dd = importlib.util.module_from_spec(spec); spec.loader.exec_module(dd)

def main():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        data = json.load(open(OUT, encoding="utf-8"))
    except FileNotFoundError:
        data = {}
    programs = dd.load_programs()  # raises if a platform is unreachable: then we change nothing
    ids = {p["id"] for p in programs}
    known = set(data.get("known", []))
    first = data.get("first_seen", {})
    if not known:
        # first run ever: everything currently listed is the baseline, not "new"
        known = set(ids) | set(first)
        data.setdefault("baseline", today)
    added = sorted(ids - known)
    for i in added:
        first[i] = today
    cutoff = datetime.now(timezone.utc).timestamp() - KEEP_DAYS * 86400
    first = {k: v for k, v in first.items()
             if datetime.strptime(v, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() >= cutoff}
    data.update({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                 "known": sorted(known | ids), "first_seen": first})
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, sort_keys=True)
    print("[tracker] {} programs listed, {} new today: {}".format(len(ids), len(added), ", ".join(added) or "none"))

if __name__ == "__main__":
    sys.exit(main())
