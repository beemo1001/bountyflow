/* ============================================================
   BountyFlow · app.js
   Boot sequence, new-program tracking, hash router, bookmarks.
   ============================================================ */

/* ---------- bookmarks (local only) ---------- */
const BFStore = (() => {
  'use strict';
  const KEY = 'bf-bookmarks';
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const set = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  return {
    bookmarks: get,
    isBookmarked: id => get().includes(id),
    toggleBookmark(id) {
      const v = get();
      const i = v.indexOf(id);
      if (i >= 0) v.splice(i, 1); else v.push(id);
      set(v);
      return i < 0;
    }
  };
})();

const BFApp = (() => {
  'use strict';
  let programs = [];

  // data/first-seen.json is kept up to date by the GitHub Action
  // (.github/workflows/bountyflow-tracker.yml). Missing file = no "new" badges.
  async function loadFirstSeen() {
    try {
      const r = await fetch('data/first-seen.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) { return { baseline: null, first_seen: {} }; }
  }

  function setActiveNav(hash) {
    const base = '#/' + (hash.replace(/^#\/?/, '').split('/')[0] || '');
    document.querySelectorAll('.cf-nav a').forEach(a => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === base || (base === '#/program' && href === '#/'));
    });
  }

  function route(opts) {
    const hash = location.hash || '#/';
    const main = document.getElementById('main');
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
    main.innerHTML = '';
    setActiveNav(hash);

    let view;
    if (hash.startsWith('#/program/')) {
      const [id, tab] = decodeURIComponent(hash.slice('#/program/'.length)).split('~');
      view = BFViews.programDetail(id, tab);
    } else if (hash.startsWith('#/new')) view = BFViews.newFeed();
    else if (hash.startsWith('#/match') || hash.startsWith('#/student')) view = BFViews.studentMode();
    else if (hash.startsWith('#/scope') || hash.startsWith('#/explorer')) view = BFViews.explorer();
    else if (hash.startsWith('#/saved') || hash.startsWith('#/bookmarks')) view = BFViews.bookmarks();
    else view = BFViews.dashboard();

    main.append(view);
    if (hash === '#/' || hash === '') BFViews.refreshResults();
  }

  function renderSync(syncedAt) {
    const el = document.getElementById('syncStatus');
    el.innerHTML = '';
    el.classList.add('ok');
    el.title = 'Data refreshes every 30 minutes upstream. Click to refresh now.';
    el.append(Object.assign(document.createElement('span'), { className: 'dot' }),
      Object.assign(document.createElement('span'), { textContent: 'Synced ' + BFUI.timeAgo(syncedAt) }));
    el.onclick = async () => { el.lastChild.textContent = 'Refreshing'; await BFData.clearCache(); location.reload(); };
  }

  // Deep links that survive embedding (Whop passes the query string, not the #hash):
  //   ?program=<id>  opens that program      ?view=new|match|scope|saved  opens that page
  function applyQueryRoute() {
    const q = new URLSearchParams(location.search);
    let ref = new URLSearchParams();
    try { if (document.referrer) ref = new URL(document.referrer).searchParams; } catch (e) { /* no referrer */ }
    const prog = q.get('program') || ref.get('program'), view = q.get('view') || ref.get('view');
    if (prog) location.hash = '#/program/' + encodeURIComponent(prog);
    else if (view && /^(new|match|scope|saved)$/.test(view)) location.hash = '#/' + view;
  }

  async function init() {
    applyQueryRoute();
    CF.initChrome('bountyflow');
    const boot = CF.boot('BountyFlow');
    try {
      const [{ programs: list, syncedAt }, seen] = await Promise.all([
        BFData.load((stage, pct) => boot.step(stage, pct)),
        loadFirstSeen()
      ]);
      boot.step('analyzing ' + list.length + ' programs', 97);
      await new Promise(r => setTimeout(r, 20));
      const fs = seen.first_seen || {};
      const cutoff = Date.now() - BF.NEW_DAYS * 86400000;
      for (const p of list) {
        p.analysis = BFAnalyzer.analyze(p);
        p.firstSeen = fs[p.id] || null;
        p.isNew = !!(p.firstSeen && new Date(p.firstSeen + 'T12:00:00Z').getTime() >= cutoff);
      }
      programs = list;
      BFViews.setPrograms(programs, { baseline: seen.baseline });

      const newCount = programs.filter(p => p.isNew).length;
      const dot = document.getElementById('newCount');
      if (newCount) { dot.textContent = newCount; dot.hidden = false; }

      BFFilters.onApply(() => {
        const hash = location.hash || '#/';
        if (hash === '#/' || hash === '') BFViews.refreshResults();
        else route({ keepScroll: true });
      });
      window.addEventListener('hashchange', () => route());
      route();
      renderSync(syncedAt);
      boot.done();
    } catch (err) {
      boot.step('Could not load data: ' + err.message + '. Check your connection and reload.', 100);
    }
  }

  return { init, go: hash => { location.hash = hash; }, rerender: () => route({ keepScroll: true }), get programs() { return programs; } };
})();

document.addEventListener('DOMContentLoaded', BFApp.init);
