/* ============================================================
   BountyFlow · filters.js
   Instant client-side filtering, sorting, searching & presets.
   All combinable. Operates on the normalized program list.
   ============================================================ */

const BFFilters = (() => {
  'use strict';

  const DEFAULTS = {
    q: '',
    // money
    reward: 'any',           // any | bounty | vdp | swag
    minMaxBounty: 0,         // min max-bounty (USD); 0 = no floor
    // platform
    platforms: [],           // hackerone, bugcrowd, intigriti, yeswehack, direct
    // scope types
    cats: [],                // web, api, wildcard, ...
    // trust
    safeHarbor: 'any',       // any | full | partial
    disclosureOnly: false,   // allows disclosure
    responsiveOnly: false,   // H1 response efficiency >= 80
    // analysis
    difficulty: 'any',       // any | beginner | intermediate | advanced
    techs: [],               // tech ids
    minAssets: 0,
    maxSeverity: 'any',      // any | critical | high | medium ...
    // output
    sort: 'relevance',
    // student mode
    studentLevel: null,      // beginner | intermediate | advanced
    studentSkills: []
  };

  let state = { ...DEFAULTS };

  /* ---------- presets ---------- */
  const PRESETS = {
    beginner: {
      label: 'Beginner-friendly',
      title: 'Easiest entry points: broad scope, low competition',
      patch: { difficulty: 'beginner', reward: 'any', minMaxBounty: 0, cats: [], techs: [], platforms: [], safeHarbor: 'any', disclosureOnly: false, responsiveOnly: false, minAssets: 0, maxSeverity: 'any' }
    },
    money: {
      label: 'Highest bounties',
      title: 'Programs with the biggest known max payouts',
      patch: { reward: 'bounty', minMaxBounty: 10000, sort: 'bounty', difficulty: 'any', cats: [], techs: [], platforms: [], safeHarbor: 'any', disclosureOnly: false, responsiveOnly: false, minAssets: 0, maxSeverity: 'any' }
    },
    wildcards: {
      label: 'Wildcard scopes',
      title: 'Every subdomain in scope: recon hunter heaven',
      patch: { cats: ['wildcard'], reward: 'any', minMaxBounty: 0, difficulty: 'any', techs: [], platforms: [], safeHarbor: 'any', disclosureOnly: false, responsiveOnly: false, minAssets: 0, maxSeverity: 'any' }
    },
    vdp: {
      label: 'VDP practice',
      title: 'No cash, no pro competition: pure practice grounds',
      patch: { reward: 'vdp', difficulty: 'any', minMaxBounty: 0, cats: [], techs: [], platforms: [], safeHarbor: 'any', disclosureOnly: false, responsiveOnly: false, minAssets: 0, maxSeverity: 'any' }
    },
    responsive: {
      label: 'Fast triage',
      title: 'Responsive programs (efficiency ≥ 80%, quick first reply)',
      patch: { responsiveOnly: true, reward: 'any', minMaxBounty: 0, cats: [], techs: [], platforms: [], safeHarbor: 'any', difficulty: 'any', disclosureOnly: false, minAssets: 0, maxSeverity: 'any' }
    },
    safeharbor: {
      label: 'Full safe harbor',
      title: 'Maximum legal protection while testing',
      patch: { safeHarbor: 'full', reward: 'any', minMaxBounty: 0, cats: [], techs: [], platforms: [], difficulty: 'any', disclosureOnly: false, responsiveOnly: false, minAssets: 0, maxSeverity: 'any' }
    }
  };

  /* ---------- individual predicates ---------- */
  function match(p) {
    const s = state;

    // search query: name + platform + scope domains
    if (s.q) {
      const q = s.q.toLowerCase();
      let hay = p.name.toLowerCase() + ' ' + p.platform;
      if (p.scope.length <= 200) {
        for (const t of p.scope) { hay += ' ' + t.t.toLowerCase(); if (hay.includes(q)) break; }
      }
      if (!hay.includes(q)) return false;
    }

    // money
    if (s.reward === 'bounty' && !p.offersBounties) return false;
    if (s.reward === 'vdp' && p.offersBounties) return false;
    if (s.reward === 'swag' && !p.offersSwag) return false;
    if (s.minMaxBounty > 0) {
      // programs with unknown amounts never match a floor
      if (!(p.bountyKnown && p.maxBountyUSD >= s.minMaxBounty)) return false;
    }

    // platform
    if (s.platforms.length && !s.platforms.includes(p.platform)) return false;

    // scope categories
    if (s.cats.length) {
      const ok = s.cats.some(c => (p.analysis.catCounts[c] || 0) > 0);
      if (!ok) return false;
    }

    // trust
    if (s.safeHarbor !== 'any') {
      if (p.safeHarbor !== s.safeHarbor) return false;
    }
    if (s.disclosureOnly && !p.allowsDisclosure) return false;
    if (s.responsiveOnly) {
      const eff = p.responseEfficiency;
      const fast = p.avgFirstResponseDays != null && p.avgFirstResponseDays <= 3;
      if (!((eff != null && eff >= 80) || fast)) return false;
    }

    // analysis
    if (s.difficulty !== 'any' && p.analysis.difficulty.level !== s.difficulty) return false;
    if (s.techs.length) {
      const ok = s.techs.every(t => p.analysis.tech.some(x => x.id === t));
      if (!ok) return false;
    }
    if (s.minAssets > 0 && p.analysis.total < s.minAssets) return false;
    if (s.maxSeverity !== 'any') {
      const ok = p.scope.some(t => (t.s || '').toLowerCase() === s.maxSeverity);
      if (!ok) return false;
    }

    return true;
  }

  /* ---------- scoring for relevance & student match ---------- */
  function scoreOf(p) {
    const a = p.analysis;
    let sc = 0;
    if (p.offersBounties) sc += 20;
    if (p.bountyKnown) sc += Math.min(30, Math.log10(p.maxBountyUSD || 10) * 10);
    if (p.safeHarbor === 'full') sc += 10;
    if (p.responseEfficiency != null) sc += p.responseEfficiency / 10;
    if (a.difficulty.level === 'beginner') sc += 15;
    sc += Math.min(20, a.total / 5);
    if (state.studentSkills.length) {
      sc += (BFAnalyzer.skillMatch(p, state.studentSkills) || 0) / 2;
    }
    if (state.studentLevel) {
      const lv = state.studentLevel;
      if (a.difficulty.level === lv) sc += 30;
      else if (lv === 'intermediate' && a.difficulty.level === 'beginner') sc += 10;
      else if (lv === 'advanced' && a.difficulty.level === 'intermediate') sc += 10;
    }
    return sc;
  }

  const SORTS = {
    relevance:  { label: 'Best match',        fn: (a, b) => scoreOf(b) - scoreOf(a) || a.name.localeCompare(b.name) },
    bounty:     { label: 'Highest bounty',     fn: (a, b) => (b.maxBountyUSD || 0) - (a.maxBountyUSD || 0) || a.name.localeCompare(b.name) },
    easiest:    { label: 'Easiest first',     fn: (a, b) => a.analysis.difficulty.score - b.analysis.difficulty.score },
    hardest:    { label: 'Hardest first',     fn: (a, b) => b.analysis.difficulty.score - a.analysis.difficulty.score },
    assets:     { label: 'Most assets',       fn: (a, b) => b.analysis.total - a.analysis.total },
    name:       { label: 'Name A-Z',          fn: (a, b) => a.name.localeCompare(b.name) }
  };

  /* ---------- public API ---------- */
  function get() { return { ...state }; }

  function patch(next, opts) {
    state = { ...state, ...next };
    if (!opts || !opts.silent) applyToUI();
    return get();
  }

  function reset() {
    state = { ...DEFAULTS, studentLevel: state.studentLevel, studentSkills: state.studentSkills };
    applyToUI();
    return get();
  }

  function applyPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return get();
    const hadPreset = state.preset === key;
    if (hadPreset) {
      // clicking the active preset chip toggles it off
      state = { ...state, ...PRESETS[key].patch, preset: null };
      // restore the default-ish values
      Object.assign(state, { cats: [], techs: [], platforms: [], reward: 'any', minMaxBounty: 0, sort: 'relevance', difficulty: 'any', safeHarbor: 'any', responsiveOnly: false, disclosureOnly: false, minAssets: 0, maxSeverity: 'any' });
    } else {
      state = { ...state, ...preset.patch, preset: key };
    }
    applyToUI();
    return get();
  }

  function run(programs) {
    const out = programs.filter(match);
    out.sort(SORTS[state.sort] ? SORTS[state.sort].fn : SORTS.relevance.fn);
    return out;
  }

  /* ---------- reflect state into the DOM (called by ui.js hook) ---------- */
  let applyHook = () => {};
  function onApply(fn) { applyHook = fn; }
  function applyToUI() { applyHook(); }

  return { get, patch, reset, applyPreset, run, PRESETS, SORTS, onApply, DEFAULTS };
})();
