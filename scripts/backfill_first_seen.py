#!/usr/bin/env python3
"""One-off: derive first-seen dates for programs from the git history of
arkadiyt/bounty-targets-data, so the 'New programs' feed has real dates
from day one. Usage: python backfill_first_seen.py <path-to-partial-clone> <days> <out.json>
The clone can be made with: git clone --filter=blob:none --no-checkout https://github.com/arkadiyt/bounty-targets-data.git
"""
import importlib.util, json, os, subprocess, sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("dd", os.path.join(HERE, "discord_digest.py"))
dd = importlib.util.module_from_spec(spec); spec.loader.exec_module(dd)

repo, days, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
NORMS = (("hackerone", dd.norm_hackerone), ("bugcrowd", dd.norm_bugcrowd),
         ("intigriti", dd.norm_intigriti), ("yeswehack", dd.norm_yeswehack))

def git(*a):
    return subprocess.run(["git", "-C", repo] + list(a), capture_output=True, check=True).stdout

def ids_at(commit):
    progs = []
    for name, norm in NORMS:
        raw = json.loads(git("show", f"{commit}:data/{name}_data.json"))
        progs.extend(norm(p) for p in raw)
    return {p["id"] for p in dd.dedupe_ids(progs)}

now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
first_seen, prev, baseline = {}, None, None
for d in range(days, -1, -1):
    day = now - timedelta(days=d)
    c = git("rev-list", "-1", "--before=" + day.isoformat(), "HEAD").decode().strip()
    ids = ids_at(c)
    if prev is None:
        baseline = day
    else:
        for i in ids - prev:
            first_seen.setdefault(i, (day - timedelta(hours=12)).strftime("%Y-%m-%d"))
    prev = ids
    print(day.date(), len(ids), "new so far:", len(first_seen), flush=True)
# programs that vanished and came back count as new; drop ones no longer listed
first_seen = {k: v for k, v in first_seen.items() if k in prev}
json.dump({"baseline": baseline.strftime("%Y-%m-%d"), "first_seen": first_seen},
          open(out, "w"), indent=1, sort_keys=True)
print("wrote", out, len(first_seen))
