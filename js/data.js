/* ============================================================
   BountyFlow · data.js
   Fetch all platform datasets (zero API keys, CORS-open static
   JSON), normalize the 4 platform schemas + curated direct list
   into ONE program shape, and cache in IndexedDB (24h TTL).
   ============================================================ */

const BFData = (() => {
  'use strict';

  /* ---------- IndexedDB helpers ---------- */
  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(BF.CACHE.DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(BF.CACHE.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function cacheGet(key) {
    try {
      const db = await idb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(BF.CACHE.STORE, 'readonly');
        const req = tx.objectStore(BF.CACHE.STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { return null; }
  }

  async function cacheSet(key, val) {
    try {
      const db = await idb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(BF.CACHE.STORE, 'readwrite');
        tx.objectStore(BF.CACHE.STORE).put(val, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { return false; }
  }

  /* ---------- fetching with mirror fallback ---------- */
  async function fetchAny(urls) {
    let lastErr;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('all sources failed');
  }

  /* ---------- normalization ---------- */

  // Canonical scope category from each platform's native type
  const H1_TYPE = {
    URL: 'web', WILDCARD: 'wildcard', OTHER: 'other',
    GOOGLE_PLAY_APP_ID: 'mobile', APPLE_STORE_APP_ID: 'mobile',
    WINDOWS_APP_STORE_APP_ID: 'mobile', TESTFLIGHT: 'mobile',
    OTHER_APK: 'mobile', OTHER_IPA: 'mobile',
    SOURCE_CODE: 'source', IP_ADDRESS: 'network', CIDR: 'network',
    DOWNLOADABLE_EXECUTABLES: 'desktop', HARDWARE: 'hardware',
    API: 'api', SMART_CONTRACT: 'web3', AI_MODEL: 'ai'
  };
  const BC_TYPE = {
    website: 'web', api: 'api', network: 'network', ios: 'mobile',
    android: 'mobile', hardware: 'hardware', ip_address: 'network',
    iot: 'iot', other: 'other'
  };
  const INT_TYPE = {
    url: 'web', wildcard: 'wildcard', android: 'mobile', ios: 'mobile',
    iprange: 'network', device: 'hardware', other: 'other'
  };
  const YWH_TYPE = {
    'web-application': 'web', api: 'api',
    'mobile-application-android': 'mobile', 'mobile-application-ios': 'mobile',
    'mobile-application': 'mobile', wildcard: 'wildcard',
    application: 'desktop', challenge: 'other', 'ai-model': 'ai', other: 'other'
  };

  const clip = (s, n) => {
    if (!s) return '';
    s = String(s).trim();
    return s.length > n ? s.slice(0, n) : s;
  };

  // Normalize a scope item: { cat, target, note, bountyEligible, maxSeverity }
  function scopeItem(cat, target, note, bountyEligible, maxSeverity) {
    return {
      cat: cat || 'other',
      t: clip(target, 300) || '',
      n: clip(note, 400),
      b: bountyEligible === true,
      s: clip(maxSeverity, 20) || null
    };
  }

  function toUSD(value, currency) {
    if (value == null || value <= 0) return null;
    const rate = BF.FX[currency] || 1;
    return Math.round(value * rate);
  }

  function normHackerOne(p) {
    const scope = [], oos = [];
    (p.targets && p.targets.in_scope || []).forEach(t => {
      scope.push(scopeItem(
        H1_TYPE[t.asset_type], t.asset_identifier, t.instruction,
        t.eligible_for_bounty, t.max_severity
      ));
    });
    (p.targets && p.targets.out_of_scope || []).forEach(t => {
      oos.push(scopeItem(H1_TYPE[t.asset_type] || 'other', t.asset_identifier, t.instruction));
    });
    return {
      id: 'h1-' + (p.handle || p.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: p.name || p.handle || 'Unnamed',
      platform: 'hackerone',
      url: p.url || ('https://hackerone.com/' + p.handle),
      website: p.website || null,
      offersBounties: !!p.offers_bounties,
      offersSwag: !!p.offers_swag,
      maxBountyUSD: null, // H1 does not publish amounts
      minBountyUSD: null,
      bountyCurrency: 'USD',
      bountyKnown: false,
      safeHarbor: null,
      allowsDisclosure: null,
      managed: !!p.managed_program,
      submissionState: p.submission_state || 'open',
      responseEfficiency: p.response_efficiency_percentage,
      avgFirstResponseDays: p.average_time_to_first_program_response,
      avgResolvedDays: p.average_time_to_report_resolved,
      bountySplitting: !!p.allows_bounty_splitting,
      summary: null,
      scope, oos
    };
  }

  function normBugcrowd(p) {
    const scope = [], oos = [];
    (p.targets && p.targets.in_scope || []).forEach(t => {
      scope.push(scopeItem(BC_TYPE[t.type], t.target || t.uri, t.name));
    });
    (p.targets && p.targets.out_of_scope || []).forEach(t => {
      oos.push(scopeItem(BC_TYPE[t.type] || 'other', t.target || t.uri, t.name));
    });
    const max = (typeof p.max_payout === 'number' && p.max_payout > 0) ? p.max_payout : null;
    return {
      id: 'bc-' + (p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: (p.name || 'Unnamed').trim(),
      platform: 'bugcrowd',
      url: p.url,
      website: null,
      offersBounties: !!max,
      offersSwag: false,
      maxBountyUSD: max,
      minBountyUSD: null,
      bountyCurrency: 'USD',
      bountyKnown: !!max,
      safeHarbor: p.safe_harbor || null,
      allowsDisclosure: !!p.allows_disclosure,
      managed: !!p.managed_by_bugcrowd,
      submissionState: 'open',
      responseEfficiency: null,
      avgFirstResponseDays: null,
      avgResolvedDays: null,
      bountySplitting: null,
      summary: null,
      scope, oos
    };
  }

  function normIntigriti(p) {
    const scope = [], oos = [];
    (p.targets && p.targets.in_scope || []).forEach(t => {
      scope.push(scopeItem(
        INT_TYPE[t.type], t.endpoint || t.target || '', t.description
      ));
    });
    (p.targets && p.targets.out_of_scope || []).forEach(t => {
      oos.push(scopeItem(INT_TYPE[t.type] || 'other', t.endpoint || t.target || '', t.description));
    });
    const cur = (p.max_bounty && p.max_bounty.currency) || 'EUR';
    const maxV = p.max_bounty && p.max_bounty.value > 0 ? p.max_bounty.value : null;
    const minV = p.min_bounty && p.min_bounty.value > 0 ? p.min_bounty.value : null;
    return {
      id: 'int-' + (p.handle || p.id),
      name: p.name || 'Unnamed',
      platform: 'intigriti',
      url: p.url,
      website: null,
      offersBounties: !!maxV,
      offersSwag: false,
      maxBountyUSD: toUSD(maxV, cur),
      minBountyUSD: toUSD(minV, cur),
      bountyCurrency: cur,
      bountyKnown: !!maxV,
      safeHarbor: null,
      allowsDisclosure: null,
      managed: false,
      submissionState: p.status === 'open' ? 'open' : (p.status || 'open'),
      responseEfficiency: null,
      avgFirstResponseDays: null,
      avgResolvedDays: null,
      bountySplitting: null,
      summary: null,
      scope, oos
    };
  }

  function normYesWeHack(p) {
    const scope = [], oos = [];
    (p.targets && p.targets.in_scope || []).forEach(t => {
      scope.push(scopeItem(YWH_TYPE[t.type], t.target, t.description));
    });
    (p.targets && p.targets.out_of_scope || []).forEach(t => {
      oos.push(scopeItem(YWH_TYPE[t.type] || 'other', t.target, t.description));
    });
    const max = p.max_bounty > 0 ? p.max_bounty : null;
    const min = p.min_bounty > 0 ? p.min_bounty : null;
    return {
      id: 'ywh-' + (p.id || p.name).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: p.name || 'Unnamed',
      platform: 'yeswehack',
      url: p.public ? ('https://yeswehack.com/programs/' + (p.id || '')) : null,
      website: null,
      offersBounties: !!max,
      offersSwag: false,
      maxBountyUSD: toUSD(max, 'EUR'),
      minBountyUSD: toUSD(min, 'EUR'),
      bountyCurrency: 'EUR',
      bountyKnown: !!max,
      safeHarbor: null,
      allowsDisclosure: null,
      managed: !!p.managed,
      submissionState: p.disabled ? 'disabled' : 'open',
      responseEfficiency: null,
      avgFirstResponseDays: null,
      avgResolvedDays: null,
      bountySplitting: null,
      summary: null,
      scope, oos
    };
  }

  function normDirect(p) {
    const scope = (p.targets || []).map(t => scopeItem(t.cat, t.target, null));
    return {
      id: 'dir-' + p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: p.name,
      platform: 'direct',
      url: p.url,
      website: null,
      offersBounties: !!p.offersBounties,
      offersSwag: !!p.offersSwag,
      maxBountyUSD: p.maxBounty || null,
      minBountyUSD: null,
      bountyCurrency: p.currency || 'USD',
      bountyKnown: !!p.maxBounty,
      bountyApprox: !!p.approx,
      safeHarbor: p.safeHarbor || null,
      allowsDisclosure: null,
      managed: false,
      submissionState: 'open',
      responseEfficiency: null,
      avgFirstResponseDays: null,
      avgResolvedDays: null,
      bountySplitting: null,
      summary: p.summary || null,
      scope, oos: []
    };
  }

  function dedupeId(list) {
    const seen = new Set();
    return list.filter(p => {
      if (seen.has(p.id)) {
        p.id = p.id + '-' + seen.size; // keep it unique
      }
      seen.add(p.id);
      return true;
    });
  }

  /* ---------- public API ---------- */

  /**
   * Load all programs. Fast path: fresh IndexedDB cache.
   * Slow path: fetch 4 platform files + local direct list, normalize, cache.
   * onProgress(stage, pct) drives the loading UI.
   */
  async function load(onProgress) {
    const prog = (stage, pct) => onProgress && onProgress(stage, pct);

    // 1. try cache
    prog('checking local cache…', 4);
    const cached = await cacheGet(BF.CACHE.KEY);
    if (cached && cached.at && (Date.now() - cached.at) < BF.CACHE.TTL_MS && cached.programs) {
      prog('loading cached dataset: ' + cached.programs.length + ' programs…', 30);
      return { programs: cached.programs, syncedAt: cached.at, fromCache: true };
    }

    // 2. fetch fresh
    const results = [];
    const tasks = [
      ['hackerone', normHackerOne, 40, 62],
      ['bugcrowd', normBugcrowd, 64, 74],
      ['intigriti', normIntigriti, 76, 84],
      ['yeswehack', normYesWeHack, 86, 92]
    ];
    for (const [name, norm, from, to] of tasks) {
      prog('fetching ' + name + '…', from);
      try {
        const raw = await fetchAny(BF.SOURCES[name]);
        const out = raw.map(norm).filter(p => p.scope.length > 0 || p.name);
        results.push(...out);
        prog(name + ': ' + out.length + ' programs', to);
      } catch (e) {
        prog(name + ' unreachable, skipped', to);
      }
    }

    // 3. curated direct programs (bundled with the site)
    prog('loading curated direct programs…', 94);
    try {
      const dir = await fetchAny(['data/direct-programs.json']);
      results.push(...(dir.programs || []).map(normDirect));
    } catch (e) {
      // relative fetch fallback for file:// or sub-path hosting
      try {
        const dir = await fetchAny([location.pathname.replace(/[^/]*$/, '') + 'data/direct-programs.json']);
        results.push(...(dir.programs || []).map(normDirect));
      } catch (e2) { /* direct list is optional */ }
    }

    const programs = dedupeId(results);
    const syncedAt = Date.now();
    prog('normalized: ' + programs.length + ' programs total', 97);

    await cacheSet(BF.CACHE.KEY, { at: syncedAt, programs });
    prog('ready', 100);
    return { programs, syncedAt, fromCache: false };
  }

  async function clearCache() {
    try {
      const db = await idb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(BF.CACHE.STORE, 'readwrite');
        tx.objectStore(BF.CACHE.STORE).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (e) { return false; }
  }

  return { load, clearCache };
})();
