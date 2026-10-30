/* ============================================================
   BountyFlow · app.js
   Loading sequence, hash router, local storage.
   ============================================================ */

/* ---------- persistent local state (bookmarks) ---------- */
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

/* ---------- main app ---------- */
const BFApp = (() => {
  'use strict';
  let programs = [];

  /* ---------- loading screen ---------- */
  const MARK_SVG = `
    <g class="mark-sweep">
      <circle cx="24" cy="24" r="20" fill="none" stroke="#dce5f4" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="103.67 12.57"/>
      <path d="M33.1 6.2A20 20 0 0 1 41.8 14.9" fill="none" stroke="#f43f5e" stroke-width="3.4" stroke-linecap="round"/>
    </g>
    <g stroke="#dce5f4" stroke-linecap="round" fill="none">
      <path d="M22.6 13.2 20.5 10.9M25.4 13.2 27.5 10.9" stroke-width="2.2"/>
      <path d="M18.3 22.8 13.7 19.5M29.7 22.8 34.3 19.5M18.3 32.6 14.1 36M29.7 32.6 33.9 36" stroke-width="2.4"/>
      <path d="M18 27.7 12.7 27.7M30 27.7 35.3 27.7" stroke-width="2.2"/>
      <rect x="18" y="18" width="12" height="19" rx="6" stroke-width="2.6"/>
      <path d="M24 21.2V33.8" stroke-width="2.2"/>
    </g>
    <circle cx="24" cy="14.8" r="2.7" fill="#dce5f4"/>`;

  function bootUI() {
    const wrap = document.createElement('div');
    wrap.className = 'boot';
    wrap.innerHTML = `
      <div class="boot-inner">
        <svg viewBox="0 0 48 48" class="boot-mark" aria-hidden="true">${MARK_SVG}</svg>
        <div class="boot-word">Bounty<em>Flow</em></div>
        <div class="boot-tag">Bug bounty intelligence, auto-analyzed</div>
        <div class="boot-bar"><div class="boot-fill" id="bootFill"></div></div>
        <div class="boot-status" id="bootStatus">Initializing…</div>
        <div class="boot-pct" id="bootPct">0%</div>
      </div>`;
    document.body.append(wrap);
    return wrap;
  }

  function bootLog(wrap, stage, pct) {
    const status = wrap.querySelector('#bootStatus');
    const fill = wrap.querySelector('#bootFill');
    const pctEl = wrap.querySelector('#bootPct');
    if (status) status.textContent = stage;
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  }

  /* ---------- header / nav ---------- */
  function renderHeader(syncedAt) {
    const status = document.querySelector('.sync-status');
    if (status && syncedAt) {
      status.classList.add('ok');
      status.innerHTML = '';
      status.append(
        Object.assign(document.createElement('span'), { className: 'sync-dot' }),
        Object.assign(document.createElement('span'), { className: 'sync-text', textContent: 'Synced ' + BFUI.timeAgo(syncedAt) }),
        Object.assign(document.createElement('button'), {
          className: 'refresh-btn', title: 'Force refresh data (clears cache)',
          onclick: async () => {
            await BFData.clearCache();
            location.reload();
          }
        }));
      status.querySelector('.refresh-btn').append(BFUI.icon('refresh', 12));
    }
  }

  /* ---------- router ---------- */
  let currentHash = null;
  function route(opts) {
    const hash = location.hash || '#/';
    const main = document.getElementById('main');
    if (!main) return;
    // only scroll to top on real navigation, not on state-sync re-renders
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
    currentHash = hash;
    main.innerHTML = '';

    // nav active state
    document.querySelectorAll('.nav a').forEach(a =>
      a.classList.toggle('active', a.getAttribute('href') === hash.split('/').slice(0, 2).join('/')));

    let view;
    if (hash.startsWith('#/program/')) {
      view = BFViews.programDetail(decodeURIComponent(hash.slice('#/program/'.length)));
    } else if (hash.startsWith('#/student')) {
      view = BFViews.studentMode();
    } else if (hash.startsWith('#/explorer')) {
      view = BFViews.explorer();
    } else if (hash.startsWith('#/bookmarks')) {
      view = BFViews.bookmarks();
    } else {
      view = BFViews.dashboard();
    }
    main.append(view);
    if (hash === '#/' || hash === '') {
      BFViews.refreshResults();
      const q = BFFilters.get().q;
      const inp = document.getElementById('searchInput');
      if (inp && q) { inp.value = q; }
    }
  }

  const go = hash => { location.hash = hash; };

  /* ---------- init ---------- */
  async function init() {
    const wrap = bootUI();
    bootLog(wrap, 'initializing', 2);

    try {
      const { programs: list, syncedAt, fromCache } = await BFData.load((stage, pct) => bootLog(wrap, stage, pct));
      bootLog(wrap, 'profiling ' + list.length + ' programs…', 98);
      await new Promise(r => setTimeout(r, 30)); // let UI paint
      for (let i = 0; i < list.length; i++) {
        list[i].analysis = BFAnalyzer.analyze(list[i]);
      }
      programs = list;
      BFViews.setPrograms(programs);
      bootLog(wrap, 'analysis complete: ' + programs.length + ' programs profiled', 99);

      // reflect filter state → UI + re-render on change
      BFFilters.onApply(() => {
        const hash = location.hash || '#/';
        if (hash === '#/' || hash === '') {
          BFViews.syncDashboardChrome();
          BFViews.refreshResults();
        } else if (hash.startsWith('#/student')) {
          route({ keepScroll: true }); // re-render student view with fresh state
        }
      });

      window.addEventListener('hashchange', route);
      route();
      renderHeader(syncedAt);
      bootLog(wrap, 'ready · good hunting', 100);
      await new Promise(r => setTimeout(r, 420));
      wrap.classList.add('done');
      setTimeout(() => wrap.remove(), 500);
    } catch (err) {
      bootLog(wrap, 'error: ' + err.message, 100);
      bootLog(wrap, 'check your connection & reload', 100);
    }
  }

  return { init, go, get programs() { return programs; } };
})();

document.addEventListener('DOMContentLoaded', BFApp.init);
