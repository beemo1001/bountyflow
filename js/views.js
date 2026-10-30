/* ============================================================
   BountyFlow · views.js
   All page views: Dashboard (stats + filters + grid), Program
   Detail (scope + analysis + playbook), Student Mode, Scope
   Explorer, Bookmarks.
   ============================================================ */

const BFViews = (() => {
  'use strict';
  const { h, icon, money, gauge, bar, programCard, catChip, techChip, platformBadge, difficultyBadge, scopeTable } = BFUI;

  let programs = [];
  const setPrograms = list => { programs = list; };
  const byId = id => programs.find(p => p.id === id);

  /* ============================================================
     DASHBOARD
     ============================================================ */
  let visibleCount = 0;
  const PAGE = 24;

  function dashboard() {
    const view = h('div', { class: 'view dashboard' });
    view.append(statsStrip(), filterSidebar(), mainArea());
    return view;
  }

  /* Re-render sidebar + preset chips + sort select from current filter state.
     Called after every state change so the chrome always mirrors the state. */
  function syncDashboardChrome() {
    const oldSb = document.getElementById('filterSidebar');
    if (oldSb) oldSb.replaceWith(filterSidebar());
    const oldPr = document.getElementById('presetRow');
    if (oldPr) oldPr.replaceWith(buildPresets());
    const ss = document.getElementById('sortSelect');
    if (ss) ss.value = BFFilters.get().sort;
  }

  function buildPresets() {
    const st = BFFilters.get();
    return h('div', { class: 'preset-row', id: 'presetRow' },
      h('span', { class: 'preset-label' }, 'Quick filters'),
      Object.entries(BFFilters.PRESETS).map(([key, p]) =>
        h('button', {
          class: 'preset-chip' + (st.preset === key ? ' active' : ''),
          title: p.title,
          onclick: () => { BFFilters.applyPreset(key); }
        }, p.label)));
  }

  function statsStrip() {
    const paying = programs.filter(p => p.offersBounties).length;
    const vdp = programs.length - paying;
    const assets = programs.reduce((s, p) => s + p.analysis.total, 0);
    const wild = programs.filter(p => (p.analysis.catCounts.wildcard || 0) > 0).length;
    const known = programs.filter(p => p.bountyKnown && p.maxBountyUSD);
    const topB = known.length ? known.reduce((a, b) => a.maxBountyUSD > b.maxBountyUSD ? a : b) : null;

    const box = (ic, label, value, sub, cls) =>
      h('div', { class: 'stat-card ' + (cls || '') },
        h('div', { class: 'stat-icon' }, icon(ic, 15)),
        h('div', { class: 'stat-value' }, value),
        h('div', { class: 'stat-label' }, label),
        sub ? h('div', { class: 'stat-sub' }, sub) : null);

    return h('section', { class: 'stats-strip card-row' },
      box('grid', 'Programs', programs.length.toLocaleString(), 'all platforms'),
      box('dollar', 'Paying bounties', paying.toLocaleString(), 'cash rewards'),
      box('shield', 'VDP / practice', vdp.toLocaleString(), 'no cash, low pressure', 'green'),
      box('layers', 'In-scope assets', assets.toLocaleString(), 'targets to hunt', 'cyan'),
      box('target', 'Wildcard programs', wild.toLocaleString(), 'recon-friendly', 'violet'),
      topB ? box('trending', 'Top known bounty', money(topB.maxBountyUSD), topB.name, 'red') : box('trending', 'Top known bounty', 'n/a', 'see money filter', 'red'));
  }

  /* ---------- filter sidebar ---------- */
  function filterSidebar() {
    const st = BFFilters.get();

    const group = (title, ...kids) =>
      h('div', { class: 'fgroup' }, h('div', { class: 'fgroup-title' }, title), ...kids);

    const radioRow = (name, options, current, onchange) =>
      h('div', { class: 'radio-row' },
        options.map(([val, label]) =>
          h('label', { class: 'radio-pill' + (current === val ? ' active' : '') },
            h('input', { type: 'radio', name, value: val, checked: current === val, onchange: () => onchange(val) }),
            label)));

    const checkRow = (name, checked, label, sub, onchange) =>
      h('label', { class: 'check-row' + (checked ? ' checked' : '') },
        h('input', { type: 'checkbox', checked, onchange: e => onchange(e.target.checked) }),
        h('span', { class: 'check-label' }, label, sub ? h('span', { class: 'check-sub' }, sub) : null));

    const sidebar = h('aside', { class: 'filter-sidebar', id: 'filterSidebar' });

    // --- money ---
    sidebar.append(group('Rewards',
      radioRow('reward', [
        ['any', 'All'], ['bounty', 'Bounties'], ['vdp', 'VDP'], ['swag', 'Swag']
      ], st.reward, v => BFFilters.patch({ reward: v })),
      h('div', { class: 'range-row' },
        h('label', {}, 'Min max-bounty'),
        h('select', { class: 'input select', onchange: e => BFFilters.patch({ minMaxBounty: +e.target.value }) },
          [[0, 'any amount'], [1000, '$1k+'], [5000, '$5k+'], [10000, '$10k+'], [50000, '$50k+'], [100000, '$100k+'], [1000000, '$1M+']]
            .map(([v, l]) => h('option', { value: v, selected: st.minMaxBounty === v }, l)))),
      h('div', { class: 'hint' }, 'HackerOne never publishes amounts; those programs match “Pays bounties” only.')
    ));

    // --- platform ---
    sidebar.append(group('Platform',
      h('div', { class: 'check-grid' },
        Object.entries(BF.PLATFORMS).map(([key, pl]) => {
          const on = st.platforms.includes(key);
          return h('label', { class: 'check-row' + (on ? ' checked' : '') },
            h('input', { type: 'checkbox', checked: on, onchange: e => {
              const next = e.target.checked ? [...st.platforms, key] : st.platforms.filter(x => x !== key);
              BFFilters.patch({ platforms: next });
            } }),
            h('span', { class: 'check-label' }, h('span', { class: 'p-dot', style: 'background:' + pl.color }), pl.label));
        }))
    ));

    // --- scope type ---
    sidebar.append(group('Scope type',
      h('div', { class: 'check-grid cat-grid' },
        Object.entries(BF.CATS).map(([key, c]) => {
          const on = st.cats.includes(key);
          return h('label', { class: 'check-row' + (on ? ' checked' : '') },
            h('input', { type: 'checkbox', checked: on, onchange: e => {
              const next = e.target.checked ? [...st.cats, key] : st.cats.filter(x => x !== key);
              BFFilters.patch({ cats: next });
            } }),
            h('span', { class: 'check-label' }, icon(c.icon, 12), c.label));
        }))
    ));

    // --- difficulty ---
    sidebar.append(group('Difficulty · auto-analyzed',
      radioRow('difficulty', [
        ['any', 'All'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']
      ], st.difficulty, v => BFFilters.patch({ difficulty: v }))
    ));

    // --- trust ---
    sidebar.append(group('Trust & responsiveness',
      radioRow('sh', [['any', 'Safe harbor: any'], ['full', 'Full only'], ['partial', 'Partial+Full']], st.safeHarbor, v => BFFilters.patch({ safeHarbor: v === 'partial' ? 'any' : v }) ),
      checkRow('disc', st.disclosureOnly, 'Disclosure allowed', 'publish findings after fix', v => BFFilters.patch({ disclosureOnly: v })),
      checkRow('resp', st.responsiveOnly, 'Responsive only', '≥80% eff or ≤3d first reply', v => BFFilters.patch({ responsiveOnly: v }))
    ));

    // --- tech ---
    const topTechs = techHistogram().slice(0, 18);
    sidebar.append(group('Tech detected in scope',
      h('div', { class: 'check-grid tech-grid' },
        topTechs.map(({ id, n }) => {
          const on = st.techs.includes(id);
          return h('label', { class: 'check-row small' + (on ? ' checked' : '') },
            h('input', { type: 'checkbox', checked: on, onchange: e => {
              const next = e.target.checked ? [...st.techs, id] : st.techs.filter(x => x !== id);
              BFFilters.patch({ techs: next });
            } }),
            h('span', { class: 'check-label' }, id, h('span', { class: 'count-tag' }, n)));
        }))
    ));

    // --- misc ---
    sidebar.append(group('Scope size & severity',
      h('div', { class: 'range-row' },
        h('label', {}, 'Min assets'),
        h('select', { class: 'input select', onchange: e => BFFilters.patch({ minAssets: +e.target.value }) },
          [[0, 'any'], [5, '5+'], [10, '10+'], [25, '25+'], [100, '100+']]
            .map(([v, l]) => h('option', { value: v, selected: st.minAssets === v }, l)))),
      h('div', { class: 'range-row' },
        h('label', {}, 'Accepts severity'),
        h('select', { class: 'input select', onchange: e => BFFilters.patch({ maxSeverity: e.target.value }) },
          [['any', 'any'], ['critical', 'critical'], ['high', 'high'], ['medium', 'medium']]
            .map(([v, l]) => h('option', { value: v, selected: st.maxSeverity === v }, l)))),
      h('button', { class: 'btn ghost small reset-btn', onclick: () => { BFFilters.reset(); } }, icon('rotate', 13), 'Reset all filters')
    ));

    return sidebar;
  }

  function techHistogram() {
    const counts = {};
    programs.forEach(p => p.analysis.tech.forEach(t => counts[t.id] = (counts[t.id] || 0) + 1));
    return Object.entries(counts).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  }

  /* ---------- main area: toolbar + grid ---------- */
  function mainArea() {
    const st = BFFilters.get();
    const main = h('div', { class: 'main-area' });

    // presets
    const presets = buildPresets();

    const toolbar = h('div', { class: 'toolbar' },
      h('div', { class: 'search-wrap' },
        h('span', { class: 'search-ic' }, icon('search', 15)),
        h('input', {
          id: 'searchInput', class: 'input search-input', type: 'search',
          placeholder: 'Search programs, companies, domains…',
          value: st.q,
          oninput: e => { clearTimeout(main._t); main._t = setTimeout(() => BFFilters.patch({ q: e.target.value }), 160); }
        })),
      h('div', { class: 'toolbar-right' },
        h('button', { class: 'btn ghost small', title: 'Random program', onclick: () => roulette() }, icon('shuffle', 14), 'Surprise me'),
        h('select', { id: 'sortSelect', class: 'input select sort-select', onchange: e => BFFilters.patch({ sort: e.target.value }) },
          Object.entries(BFFilters.SORTS).map(([k, s]) => h('option', { value: k, selected: st.sort === k }, s.label))),
        h('button', { class: 'btn ghost small filters-toggle', onclick: () => document.body.classList.toggle('filters-open') }, icon('sliders', 14), 'Filters'))
    );

    main.append(presets, toolbar);
    const resultMeta = h('div', { class: 'result-meta', id: 'resultMeta' });
    const grid = h('div', { class: 'card-grid', id: 'cardGrid' });
    const loadMore = h('div', { class: 'load-more-wrap', id: 'loadMoreWrap' });
    main.append(resultMeta, grid, loadMore);
    return main;
  }

  function refreshResults() {
    const grid = document.getElementById('cardGrid');
    const meta = document.getElementById('resultMeta');
    const lmWrap = document.getElementById('loadMoreWrap');
    if (!grid) return;

    const st = BFFilters.get();
    const results = BFFilters.run(programs);
    visibleCount = Math.min(PAGE, results.length);

    grid.innerHTML = '';
    results.slice(0, visibleCount).forEach(p => grid.append(programCard(p)));

    meta.innerHTML = '';
    const bits = [];
    if (st.q) bits.push('“' + st.q + '”');
    if (st.preset) bits.push(BFFilters.PRESETS[st.preset].label);
    meta.append(...[
      h('span', { class: 'result-count' }, results.length.toLocaleString() + ' programs'),
      bits.length ? h('span', { class: 'result-filters' }, '· ' + bits.join(' + ')) : null,
      bits.length ? h('span', { class: 'result-reset', onclick: () => BFFilters.reset() }, 'Clear') : null,
      results.length === 0 ? h('span', { class: 'result-filters' }, '· try relaxing filters') : null
    ].filter(Boolean)); // native .append(null) renders literal "null"; filter first

    lmWrap.innerHTML = '';
    if (results.length > visibleCount) {
      lmWrap.append(
        h('button', { class: 'btn load-more', onclick: () => {
          visibleCount = Math.min(visibleCount + PAGE, results.length);
          grid.innerHTML = '';
          results.slice(0, visibleCount).forEach(p => grid.append(programCard(p)));
          if (results.length <= visibleCount) lmWrap.innerHTML = '';
        } }, 'Load ' + Math.min(PAGE, results.length - visibleCount) + ' more · ' + (results.length - visibleCount) + ' remaining')
      );
    }
  }

  function roulette() {
    const results = BFFilters.run(programs);
    if (!results.length) return;
    const pick = results[Math.floor(Math.random() * results.length)];
    BFApp.go('#/program/' + encodeURIComponent(pick.id));
  }

  /* ============================================================
     PROGRAM DETAIL
     ============================================================ */
  function programDetail(id) {
    const p = byId(id);
    if (!p) return h('div', { class: 'view' }, h('div', { class: 'card pad' },
      h('h2', {}, 'Program not found'), h('p', { class: 'dim' }, 'It may have been removed from the dataset.'),
      h('a', { class: 'btn', href: '#/' }, icon('arrow-left', 14), 'Back to dashboard')));

    const a = p.analysis;
    const view = h('div', { class: 'view detail-view' });
    const bookmarked = BFStore.isBookmarked(p.id);

    view.append(h('a', { class: 'back-link', href: '#/' }, icon('arrow-left', 14), 'All programs'));

    // ---- header ----
    view.append(h('div', { class: 'detail-head card' },
      h('div', { class: 'detail-head-main' },
        h('div', { class: 'detail-badges' },
          platformBadge(p), difficultyBadge(a),
          p.offersBounties ? h('span', { class: 'badge pays' }, icon('dollar', 11), 'Pays bounties') : h('span', { class: 'badge vdp-badge' }, icon('shield', 11), 'VDP'),
          p.offersSwag ? h('span', { class: 'badge swag' }, icon('gift', 11), 'Swag') : null,
          p.managed ? h('span', { class: 'badge managed' }, 'Managed') : null,
          p.bountySplitting ? h('span', { class: 'badge split', title: 'Allows bounty splitting' }, 'Split OK') : null,
          p.submissionState !== 'open' ? h('span', { class: 'badge closed' }, p.submissionState) : null),
        h('h1', { class: 'detail-name' }, p.name),
        h('div', { class: 'detail-actions' },
          p.url ? h('a', { class: 'btn primary', href: p.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open program', icon('arrow-up-right', 13)) : null,
          p.website ? h('a', { class: 'btn ghost', href: p.website, target: '_blank', rel: 'noopener noreferrer' }, 'Company site', icon('arrow-up-right', 13)) : null,
          h('button', { class: 'btn ghost bm-big' + (bookmarked ? ' active' : ''), onclick: e => { BFStore.toggleBookmark(p.id); e.currentTarget.classList.toggle('active'); } }, icon('star', 14), bookmarked ? 'Saved' : 'Bookmark'))),
      h('div', { class: 'detail-bounty-box' },
        p.bountyKnown && p.maxBountyUSD
          ? [h('div', { class: 'db-sub' }, 'Max bounty'),
             h('div', { class: 'db-max' }, money(p.maxBountyUSD)),
             p.minBountyUSD ? h('div', { class: 'db-min' }, 'min ' + money(p.minBountyUSD) + (p.bountyApprox ? ' · approx (verify)' : '')) : (p.bountyApprox ? h('div', { class: 'db-min' }, 'approx: verify on program page') : null)]
          : p.offersBounties
            ? [h('div', { class: 'db-sub' }, 'Rewards'), h('div', { class: 'db-max text' }, icon('banknote', 22), 'Cash bounties'), h('div', { class: 'db-min' }, 'amount varies by severity')]
            : [h('div', { class: 'db-sub' }, 'Rewards'), h('div', { class: 'db-max text' }, icon('shield', 22), p.offersSwag ? 'VDP + swag' : 'VDP'), h('div', { class: 'db-min' }, p.offersSwag ? 'swag + thanks' : 'thanks / points only')],
        (p.responseEfficiency != null || p.avgFirstResponseDays != null)
          ? h('div', { class: 'db-divider' }) : null,
        p.responseEfficiency != null ? h('div', { class: 'db-eff' }, icon('zap', 13), p.responseEfficiency + '% response efficiency') : null,
        p.avgFirstResponseDays != null ? h('div', { class: 'db-eff' }, icon('clock', 13), '~' + (p.avgFirstResponseDays < 1 ? '<1' : Math.round(p.avgFirstResponseDays)) + 'd average first reply') : null)
    ));

    if (p.summary) view.append(h('div', { class: 'card pad summary-card' }, h('h3', {}, 'About'), h('p', {}, p.summary)));

    // ---- two columns ----
    const cols = h('div', { class: 'detail-cols' });

    // LEFT: scope
    const left = h('div', { class: 'detail-left' });
    left.append(h('div', { class: 'section-title' },
      icon('folder', 14), 'Scope ',
      h('span', { class: 'count' }, '· ' + a.total.toLocaleString() + ' in / ' + (p.oos.length || 0) + ' out')));

    // category distribution
    const maxCat = Math.max(...a.topCats.map(c => c.count), 1);
    left.append(h('div', { class: 'card pad cat-dist' },
      h('h4', { class: 'card-h' }, icon('layers', 14), 'Attack surface'),
      a.topCats.map(({ cat, count }) =>
        h('div', { class: 'cat-dist-row' },
          h('span', { class: 'cd-label' }, icon((BF.CATS[cat] || BF.CATS.other).icon, 12), (BF.CATS[cat] || BF.CATS.other).label),
          bar('', count, maxCat, BF.CATS[cat].color, count)))));

    // scope tables with in/out tabs
    const scopeCard = h('div', { class: 'card pad scope-card' });
    let which = 'in';
    const tabs = h('div', { class: 'tab-row' },
      h('button', { class: 'tab active', onclick: e => { which = 'in'; tabRender(); } }, icon('circle-check', 13), 'In scope'),
      h('button', { class: 'tab', onclick: e => { which = 'oos'; tabRender(); } }, icon('ban', 13), 'Out of scope'),
      a.bountyEligibleAssets ? h('span', { class: 'tab-info', title: 'Assets flagged eligible for bounty' }, icon('dollar', 11), a.bountyEligibleAssets + ' bounty-eligible') : null);
    const scopeHost = h('div', {});
    function tabRender() {
      tabs.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', (i === 0) === (which === 'in')));
      scopeHost.innerHTML = '';
      scopeHost.append(scopeTable(p, which));
    }
    scopeCard.append(tabs, scopeHost);
    tabRender();
    left.append(scopeCard);
    cols.append(left);

    // RIGHT: analysis panel
    const right = h('div', { class: 'detail-right' });

    // difficulty + why
    right.append(h('div', { class: 'card pad analysis-card' },
      h('h4', { class: 'card-h' }, icon('activity', 14), 'Auto analysis'),
      h('div', { class: 'gauge-row' },
        gauge(a.difficulty.score, a.difficulty.level),
        h('div', { class: 'gauge-side' },
          h('div', { class: 'diff-label', style: 'color:' + BF.DIFFICULTY[a.difficulty.level].color }, BF.DIFFICULTY[a.difficulty.level].label),
          h('div', { class: 'dim small' }, 'difficulty score'),
          a.skills.length ? h('div', { class: 'skills-needed' }, 'skills that apply:', a.skills.map(s => h('span', { class: 'chip skill-chip' }, icon(BF.SKILLS[s] ? BF.SKILLS[s].icon : 'help', 11), BF.SKILLS[s] ? BF.SKILLS[s].label : s))) : null)),
      h('div', { class: 'why-list' },
        h('div', { class: 'why-title' }, 'Why this rating'),
        a.why.map(w => h('div', { class: 'why-item' }, w)))
    ));

    // vuln classes
    if (a.vulnClasses.length) {
      right.append(h('div', { class: 'card pad' },
        h('h4', { class: 'card-h' }, icon('bug', 14), 'What to hunt here'),
        h('div', { class: 'vuln-list' },
          a.vulnClasses.map(([name, hint]) =>
            h('div', { class: 'vuln-item' },
              h('span', { class: 'vuln-name' }, name),
              h('span', { class: 'vuln-hint' }, hint))))));
    }

    // tech stack
    if (a.tech.length) {
      right.append(h('div', { class: 'card pad' },
        h('h4', { class: 'card-h' }, icon('code', 14), 'Tech fingerprint'),
        h('div', { class: 'chips-wrap' }, a.tech.map(techChip)),
        h('div', { class: 'dim small' }, 'detected from scope names & descriptions')));
    }

    // STUDENT PLAYBOOK
    right.append(h('div', { class: 'card pad playbook-card' },
      h('h4', { class: 'card-h' }, icon('grad-cap', 14), 'Your playbook'),
      h('div', { class: 'pb-block' }, h('div', { class: 'pb-title' }, h('span', { class: 'pb-num' }, '01'), 'Recon'), a.playbook.recon.length
        ? a.playbook.recon.map(([t, d]) => h('div', { class: 'pb-item' }, h('span', { class: 'pb-step' }, t), h('span', { class: 'pb-desc mono' }, d)))
        : h('div', { class: 'dim' }, 'No extra recon steps. Jump straight in.')),
      h('div', { class: 'pb-block' }, h('div', { class: 'pb-title' }, h('span', { class: 'pb-num' }, '02'), 'Attack'), a.playbook.attack.length
        ? a.playbook.attack.map(([t, d]) => h('div', { class: 'pb-item' }, h('span', { class: 'pb-step' }, t), h('span', { class: 'pb-desc' }, d)))
        : h('div', { class: 'dim' }, 'General web methodology applies.')),
      h('div', { class: 'pb-block' }, h('div', { class: 'pb-title' }, h('span', { class: 'pb-num' }, '03'), 'Free toolkit'),
        h('div', { class: 'chips-wrap' }, a.playbook.tools.map(t => h('span', { class: 'chip tool-chip' }, t)))),
      h('div', { class: 'pb-block' }, h('div', { class: 'pb-title' }, h('span', { class: 'pb-num' }, '04'), 'Rules & expectations'),
        h('div', { class: 'pb-rules' }, a.playbook.rules.map(r => h('div', { class: 'pb-rule' }, icon('alert', 13), h('span', {}, r)))),
        h('div', { class: 'pb-expect' }, icon('flag', 13), h('span', {}, a.playbook.expectation)))
    ));

    cols.append(right);
    view.append(cols);
    return view;
  }

  /* ============================================================
     STUDENT MODE
     ============================================================ */
  function studentMode() {
    const st = BFFilters.get();
    const view = h('div', { class: 'view student-view' });

    view.append(h('div', { class: 'section-title big' }, icon('grad-cap', 15), 'Student Mode'));
    view.append(h('p', { class: 'section-sub' }, 'Find programs that match your current skill level: pick a level, tick what you can already do, and BountyFlow ranks the programs where you can actually land a report today.'));

    // level cards
    const levels = [
      ['beginner', 'sprout', 'Beginner', 'New to bug bounty. Broad scopes, forgiving programs, low competition.'],
      ['intermediate', 'trending', 'Intermediate', 'Comfortable with the toolkit. Ready for real competition and logic bugs.'],
      ['advanced', 'flame', 'Advanced', 'Deep skills. Web3, hardware, network & code review welcome.']
    ];
    view.append(h('div', { class: 'level-cards' },
      levels.map(([lv, ic, title, desc]) =>
        h('div', {
          class: 'level-card card' + (st.studentLevel === lv ? ' active' : ''),
          dataset: { level: lv },
          onclick: () => { BFFilters.patch({ studentLevel: st.studentLevel === lv ? null : lv }); }
        },
          h('div', { class: 'level-icon' }, icon(ic, 18)),
          h('div', { class: 'level-name' }, title),
          h('div', { class: 'level-desc' }, desc)))));

    // skills
    view.append(h('div', { class: 'card pad skills-card' },
      h('h4', { class: 'card-h' }, icon('zap', 14), 'What can you do today?'),
      h('div', { class: 'skills-grid' },
        Object.entries(BF.SKILLS).map(([k, s]) => {
          const on = st.studentSkills.includes(k);
          return h('label', { class: 'skill-tile' + (on ? ' active' : '') },
            h('input', { type: 'checkbox', checked: on, onchange: e => {
              const next = e.target.checked ? [...st.studentSkills, k] : st.studentSkills.filter(x => x !== k);
              BFFilters.patch({ studentSkills: next });
            } }),
            h('span', { class: 'skill-icon' }, icon(s.icon, 15)),
            h('span', { class: 'skill-name' }, s.label));
        })),
      h('div', { class: 'hint' }, 'Nothing selected = no skill filtering. Matching ranks programs where your skills actually apply.')));

    // learning path
    if (st.studentSkills.length) {
      const path = BFAnalyzer.learningPath(programs, st.studentSkills);
      if (path.length) {
        view.append(h('div', { class: 'card pad learn-card' },
          h('h4', { class: 'card-h' }, icon('trending', 14), 'Level-up path: learn these to unlock more programs'),
          path.map(({ skill, unlocks, advice }) =>
            h('div', { class: 'learn-row' },
              h('span', { class: 'learn-skill' }, icon(BF.SKILLS[skill] ? BF.SKILLS[skill].icon : 'help', 14), BF.SKILLS[skill] ? BF.SKILLS[skill].label : skill),
              h('span', { class: 'learn-unlock' }, '+' + unlocks + ' programs'),
              h('span', { class: 'learn-advice' }, advice)))));
      }
    }

    // matched programs
    const matched = programs.map(p => ({ p, m: BFAnalyzer.skillMatch(p, st.studentSkills) }))
      .filter(x => st.studentSkills.length ? x.m != null : true)
      .filter(x => st.studentLevel ? x.p.analysis.difficulty.level === st.studentLevel : true)
      .sort((x, y) => (y.m || 0) - (x.m || 0));

    view.append(h('div', { class: 'section-title' },
      icon('target', 14), 'Matched programs ',
      h('span', { class: 'count' }, (st.studentLevel ? BF.DIFFICULTY[st.studentLevel].label + ' · ' : '') + matched.length)));

    const grid = h('div', { class: 'card-grid' });
    matched.slice(0, 36).forEach(({ p }) => grid.append(programCard(p)));
    view.append(grid);
    if (!matched.length) view.append(h('div', { class: 'card pad dim' }, 'No programs match. Loosen your selections.'));
    return view;
  }

  /* ============================================================
     SCOPE EXPLORER
     ============================================================ */
  function explorer() {
    const view = h('div', { class: 'view explorer-view' });
    view.append(h('div', { class: 'section-title big' }, icon('crosshair', 15), 'Scope Explorer'));
    view.append(h('p', { class: 'section-sub' }, 'Check whether a domain is covered by any bounty program before you start hunting: exact matches and wildcard coverage, live from the dataset.'));

    let results = null;
    const out = h('div', { class: 'explorer-out' });

    function runSearch(q) {
      results = BFAnalyzer.domainCoveredBy(q, programs);
      out.innerHTML = '';
      if (!q) return;
      if (results.length) {
        out.append(h('div', { class: 'explorer-found' },
          icon('circle-check', 16),
          (results.length === 1 ? '1 program covers ' : results.length + ' programs cover '),
          h('span', { class: 'hl' }, q.toLowerCase())));
        const grid = h('div', { class: 'card-grid' });
        results.slice(0, 24).forEach(({ p, via }) => {
          const card = programCard(p);
          card.append(h('div', { class: 'via-row' }, 'via', h('span', { class: 'mono' }, via)));
          grid.append(card);
        });
        out.append(grid);
        if (results.length > 24) out.append(h('div', { class: 'dim pad' }, '…and ' + (results.length - 24) + ' more'));
      } else {
        out.append(h('div', { class: 'explorer-none card pad' },
          h('div', { class: 'big-icon' }, icon('ban', 24)),
          h('h3', {}, 'Not covered by any program here'),
          h('p', { class: 'dim' }, 'No in-scope target or wildcard matches this domain in the current dataset. Testing it would be OUT of scope for all listed programs. Do not test it.')));
      }
    }

    view.append(h('div', { class: 'explorer-bar' },
      h('span', { class: 'search-ic' }, icon('search', 15)),
      h('input', {
        class: 'input explorer-input', type: 'search', placeholder: 'example.com or sub.example.com…',
        oninput: e => { clearTimeout(view._t); view._t = setTimeout(() => runSearch(e.target.value.trim()), 250); }
      })));
    view.append(out);
    view.append(h('div', { class: 'card pad hint-card' },
      h('h4', { class: 'card-h' }, icon('info', 14), 'How wildcard matching works'),
      h('p', { class: 'dim' }, 'A program with *.example.com in scope covers every subdomain of example.com. This explorer checks the live dataset for both exact matches and wildcard coverage, great for “who owns this asset?” questions before you start hunting.')));
    return view;
  }

  /* ============================================================
     BOOKMARKS
     ============================================================ */
  function bookmarks() {
    const view = h('div', { class: 'view bookmarks-view' });
    const ids = BFStore.bookmarks();
    const list = programs.filter(p => ids.includes(p.id));

    view.append(h('div', { class: 'section-title big' }, icon('bookmark', 15), 'Bookmarks ', h('span', { class: 'count' }, list.length + ' saved')));
    if (!list.length) {
      view.append(h('div', { class: 'card pad empty-bookmarks' },
        h('div', { class: 'big-icon' }, icon('star', 22)),
        h('h3', {}, 'No bookmarks yet'),
        h('p', { class: 'dim' }, 'Hit the star on any program card to save it here. Stored in your browser only.')));
      return view;
    }
    const grid = h('div', { class: 'card-grid' });
    list.forEach(p => grid.append(programCard(p)));
    view.append(grid);
    return view;
  }

  return { setPrograms, dashboard, refreshResults, syncDashboardChrome, programDetail, studentMode, explorer, bookmarks, roulette };
})();
