/* ============================================================
   BountyFlow · views.js
   Programs (search + filters + list), New programs feed,
   Program detail, Skill match, Scope check, Saved.
   ============================================================ */

const BFViews = (() => {
  'use strict';
  const { h, icon, money, gauge, bar, programRow, miniCard, platformTag, levelTag, newTag, rewardText, catLabel, techChip, dayLabel, bookmarkBtn, scopeTable } = BFUI;

  let programs = [];
  let feedMeta = { baseline: null };
  const setPrograms = (list, meta) => { programs = list; if (meta) feedMeta = meta; };
  const byId = id => programs.find(p => p.id === id);
  const newest = () => programs.filter(p => p.firstSeen).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || (b.maxBountyUSD || 0) - (a.maxBountyUSD || 0));

  function pageHead(eyebrow, title, lead, right) {
    return h('div', { class: 'page-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, eyebrow), h('h1', { class: 'display h1' }, title), lead ? h('p', { class: 'lead' }, lead) : null),
      right || null);
  }

  function listHeader() {
    return h('div', { class: 'plist-head' },
      h('span', {}, 'Program'), h('span', {}, 'Reward'), h('span', {}, 'Level'), h('span', {}));
  }

  /* ============================================================
     PROGRAMS
     ============================================================ */
  let visible = 0;
  const PAGE = 30;

  function dashboard() {
    const paying = programs.filter(p => p.offersBounties).length;
    const weekNew = programs.filter(p => p.firstSeen && daysSince(p.firstSeen) <= 7).length;

    const view = h('div', { class: 'view' });
    view.append(pageHead('Bug bounty radar', 'Find your next target',
      'Every public bug bounty and disclosure program in one place. Scopes analyzed, difficulty rated, and a playbook for each one.',
      h('div', { class: 'kpis' },
        kpi(programs.length.toLocaleString(), 'programs'),
        kpi(paying.toLocaleString(), 'pay cash'),
        kpi(String(weekNew), 'new this week', true))));

    const fresh = newest().filter(p => p.isNew);
    if (fresh.length) {
      const strip = fresh.filter(p => p.offersBounties).concat(fresh.filter(p => !p.offersBounties)).slice(0, 4);
      view.append(h('section', { class: 'new-strip' },
        h('div', { class: 'section-head' },
          h('h2', {}, 'Just launched'),
          h('a', { class: 'more', href: '#/new' }, 'All ' + fresh.length + ' new programs', icon('arrow-right', 14))),
        h('div', { class: 'mini-grid' }, strip.map(miniCard))));
    }

    view.append(h('section', { class: 'browse' },
      h('div', { class: 'toolbar' },
        h('div', { class: 'search grow' }, icon('search', 16),
          h('input', {
            id: 'searchInput', class: 'input', type: 'search', placeholder: 'Search by company, platform or domain',
            value: BFFilters.get().q, 'aria-label': 'Search programs',
            oninput: e => { clearTimeout(view._t); view._t = setTimeout(() => BFFilters.patch({ q: e.target.value.trim() }), 160); }
          })),
        h('div', { id: 'filterBar', class: 'filter-bar' })),
      h('div', { id: 'activeBar', class: 'active-bar' }),
      h('div', { id: 'resultMeta', class: 'result-meta' }),
      h('div', { class: 'plist card' }, listHeader(), h('div', { id: 'rows' })),
      h('div', { id: 'loadMore', class: 'load-more' })));
    return view;
  }

  function kpi(v, l, accent) {
    return h('div', { class: 'kpi' + (accent ? ' accent' : '') }, h('b', {}, v), h('span', {}, l));
  }

  /* ---------- filter bar (popovers) ---------- */
  let openPop = null;
  document.addEventListener('click', e => { if (!e.target.closest('.pop')) openPop = null; });

  function pop(id, label, count, build, right) {
    const el = h('div', { class: 'pop' + (openPop === id ? ' open' : ''), dataset: { pop: id } },
      h('button', {
        class: 'btn sm outline' + (count ? ' has' : ''), type: 'button',
        onclick: e => {
          e.stopPropagation();
          const was = el.classList.contains('open');
          document.querySelectorAll('.pop.open').forEach(p => p.classList.remove('open'));
          el.classList.toggle('open', !was);
          openPop = was ? null : id;
        }
      }, label, count ? h('span', { class: 'pill' }, count) : null, icon('chevron-down', 14)),
      h('div', { class: 'pop-panel' + (right ? ' right' : ''), onclick: e => e.stopPropagation() }, build()));
    return el;
  }

  const opt = (on, label, onclick, count) =>
    h('button', { class: 'opt' + (on ? ' on' : ''), type: 'button', onclick }, h('span', { class: 'box' }), label, count != null ? h('span', { class: 'count' }, count) : null);
  const radio = (on, label, onclick) =>
    h('button', { class: 'opt radio' + (on ? ' on' : ''), type: 'button', onclick }, h('span', { class: 'box' }), label);
  const toggleIn = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  function renderFilterBar() {
    const bar = document.getElementById('filterBar');
    if (!bar) return;
    const st = BFFilters.get();
    bar.innerHTML = '';

    const catCounts = {};
    programs.forEach(p => Object.keys(p.analysis.catCounts).forEach(c => { if (p.analysis.catCounts[c] > 0) catCounts[c] = (catCounts[c] || 0) + 1; }));
    const platCounts = {};
    programs.forEach(p => { platCounts[p.platform] = (platCounts[p.platform] || 0) + 1; });

    bar.append(
      pop('reward', 'Reward', (st.reward !== 'any' ? 1 : 0) + (st.minMaxBounty ? 1 : 0), () => [
        h('div', { class: 'pop-label' }, 'Type'),
        [['any', 'Any reward'], ['bounty', 'Cash bounties'], ['vdp', 'No cash (VDP)'], ['swag', 'Swag']].map(([v, l]) =>
          radio(st.reward === v, l, () => BFFilters.patch({ reward: v }))),
        h('div', { class: 'pop-label' }, 'Top bounty at least'),
        [[0, 'Any amount'], [1000, '$1k'], [5000, '$5k'], [10000, '$10k'], [50000, '$50k'], [100000, '$100k']].map(([v, l]) =>
          radio(st.minMaxBounty === v, l, () => BFFilters.patch({ minMaxBounty: v }))),
        h('p', { class: 'pop-note' }, 'HackerOne does not publish amounts, so its programs drop out when you set a minimum.')
      ]),
      pop('platform', 'Platform', st.platforms.length, () =>
        Object.entries(BF.PLATFORMS).map(([k, pl]) =>
          opt(st.platforms.includes(k), pl.label, () => BFFilters.patch({ platforms: toggleIn(st.platforms, k) }), platCounts[k] || 0))),
      pop('scope', 'Scope', st.cats.length, () =>
        Object.keys(BF.CATS).filter(c => catCounts[c]).map(c =>
          opt(st.cats.includes(c), catLabel(c), () => BFFilters.patch({ cats: toggleIn(st.cats, c) }), catCounts[c]))),
      pop('level', 'Level', st.difficulty !== 'any' ? 1 : 0, () =>
        [['any', 'Any level'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([v, l]) =>
          radio(st.difficulty === v, l, () => BFFilters.patch({ difficulty: v })))),
      pop('more', 'More', (st.safeHarbor !== 'any' ? 1 : 0) + (st.disclosureOnly ? 1 : 0) + (st.responsiveOnly ? 1 : 0) + st.techs.length + (st.minAssets ? 1 : 0), () => [
        h('div', { class: 'pop-label' }, 'Trust'),
        opt(st.safeHarbor === 'full', 'Full safe harbor', () => BFFilters.patch({ safeHarbor: st.safeHarbor === 'full' ? 'any' : 'full' })),
        opt(st.responsiveOnly, 'Fast triage', () => BFFilters.patch({ responsiveOnly: !st.responsiveOnly })),
        opt(st.disclosureOnly, 'Public disclosure allowed', () => BFFilters.patch({ disclosureOnly: !st.disclosureOnly })),
        h('div', { class: 'pop-label' }, 'Scope size'),
        [[0, 'Any size'], [10, '10+ targets'], [50, '50+ targets']].map(([v, l]) => radio(st.minAssets === v, l, () => BFFilters.patch({ minAssets: v }))),
        h('div', { class: 'pop-label' }, 'Tech in scope'),
        techHistogram().slice(0, 12).map(({ id, n }) => opt(st.techs.includes(id), id, () => BFFilters.patch({ techs: toggleIn(st.techs, id) }), n))
      ], true),
      h('select', { class: 'select sort', 'aria-label': 'Sort', onchange: e => BFFilters.patch({ sort: e.target.value }) },
        Object.entries(BFFilters.SORTS).map(([k, s]) => h('option', { value: k, selected: st.sort === k }, s.label))));
  }

  function techHistogram() {
    const counts = {};
    programs.forEach(p => p.analysis.tech.forEach(t => counts[t.id] = (counts[t.id] || 0) + 1));
    return Object.entries(counts).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  }

  function activeChips() {
    const st = BFFilters.get();
    const D = BFFilters.DEFAULTS;
    const chips = [];
    const add = (label, patch) => chips.push(h('button', { class: 'chip on', type: 'button', onclick: () => BFFilters.patch(Object.assign({ preset: null }, patch)) }, label, h('span', { class: 'x' }, '×')));
    if (st.reward !== 'any') add({ bounty: 'Cash bounties', vdp: 'VDP', swag: 'Swag' }[st.reward], { reward: 'any' });
    if (st.minMaxBounty) add('≥ ' + money(st.minMaxBounty), { minMaxBounty: 0 });
    st.platforms.forEach(p => add(BF.PLATFORMS[p].label, { platforms: st.platforms.filter(x => x !== p) }));
    st.cats.forEach(c => add(catLabel(c), { cats: st.cats.filter(x => x !== c) }));
    if (st.difficulty !== 'any') add(BF.DIFFICULTY[st.difficulty].label, { difficulty: 'any' });
    if (st.safeHarbor !== 'any') add('Safe harbor', { safeHarbor: 'any' });
    if (st.responsiveOnly) add('Fast triage', { responsiveOnly: false });
    if (st.disclosureOnly) add('Disclosure', { disclosureOnly: false });
    if (st.minAssets) add(st.minAssets + '+ targets', { minAssets: 0 });
    st.techs.forEach(t => add(t, { techs: st.techs.filter(x => x !== t) }));
    if (st.q) add('“' + st.q + '”', { q: '' });
    return { chips, any: chips.length > 0, D };
  }

  function renderActiveBar() {
    const el = document.getElementById('activeBar');
    if (!el) return;
    el.innerHTML = '';
    const { chips, any } = activeChips();
    if (any) {
      el.append(...chips, h('button', { class: 'btn xs ghost', type: 'button', onclick: () => { BFFilters.reset(); const i = document.getElementById('searchInput'); if (i) i.value = ''; } }, 'Clear all'));
    } else {
      el.append(h('span', { class: 'muted small' }, 'Quick views:'),
        ...Object.entries(BFFilters.PRESETS).map(([k, p]) => h('button', { class: 'chip', type: 'button', title: p.title, onclick: () => BFFilters.applyPreset(k) }, p.label)));
    }
  }

  function syncDashboardChrome() { renderFilterBar(); renderActiveBar(); }

  function refreshResults() {
    const rows = document.getElementById('rows');
    if (!rows) return;
    syncDashboardChrome();
    const results = BFFilters.run(programs);
    visible = Math.min(PAGE, results.length);
    const meta = document.getElementById('resultMeta');
    meta.textContent = results.length.toLocaleString() + (results.length === 1 ? ' program' : ' programs');

    const paint = () => {
      rows.innerHTML = '';
      if (!results.length) {
        rows.append(h('div', { class: 'empty' }, icon('search', 28), h('h3', {}, 'No programs match'), h('p', {}, 'Remove a filter or try a broader search.')));
      }
      results.slice(0, visible).forEach(p => rows.append(programRow(p)));
      const lm = document.getElementById('loadMore');
      lm.innerHTML = '';
      if (results.length > visible) {
        lm.append(h('button', { class: 'btn', type: 'button', onclick: () => { visible = Math.min(visible + PAGE, results.length); paint(); } },
          'Show more', h('span', { class: 'muted' }, (results.length - visible) + ' left')));
      }
    };
    paint();
  }

  function roulette() {
    const results = BFFilters.run(programs);
    if (!results.length) return;
    BFApp.go('#/program/' + encodeURIComponent(results[Math.floor(Math.random() * results.length)].id));
  }

  /* ============================================================
     NEW PROGRAMS FEED
     ============================================================ */
  let newPaidOnly = false;
  function newFeed() {
    const view = h('div', { class: 'view' });
    const all = newest();
    const since = feedMeta.baseline ? dayLabel(feedMeta.baseline) : null;
    view.append(pageHead('New programs', 'Fresh launches',
      'Programs that appeared on HackerOne, Bugcrowd, Intigriti and YesWeHack recently. New programs have the least competition: this is where beginners land their first valid reports.',
      h('div', { class: 'seg' },
        h('button', { class: newPaidOnly ? '' : 'on', onclick: () => { newPaidOnly = false; BFApp.rerender(); } }, 'All'),
        h('button', { class: newPaidOnly ? 'on' : '', onclick: () => { newPaidOnly = true; BFApp.rerender(); } }, 'Paid only'))));

    const list = all.filter(p => !newPaidOnly || p.offersBounties);
    if (!list.length) {
      view.append(h('div', { class: 'card empty' }, icon('calendar', 28), h('h3', {}, 'Nothing new yet'),
        h('p', {}, 'The tracker checks for new programs twice a day. Check back soon.')));
      return view;
    }
    const groups = new Map();
    list.forEach(p => { const k = p.firstSeen; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
    for (const [day, items] of groups) {
      view.append(h('div', { class: 'day-group' },
        h('div', { class: 'day-label' }, h('span', { class: 'mono' }, day), h('span', { class: 'muted' }, dayLabel(day) + ' · ' + items.length + (items.length === 1 ? ' program' : ' programs'))),
        h('div', { class: 'plist card' }, items.map(p => programRow(p)))));
    }
    if (since) view.append(h('p', { class: 'muted small center' }, 'Tracking new programs since ' + feedMeta.baseline + '.'));
    return view;
  }

  /* ============================================================
     PROGRAM DETAIL
     ============================================================ */
  let detailTab = 'overview';
  function programDetail(id, tab) {
    const p = byId(id);
    if (!p) return h('div', { class: 'view' }, h('div', { class: 'card empty' }, icon('search', 28),
      h('h3', {}, 'Program not found'), h('p', {}, 'It may have closed or left the dataset.'),
      h('a', { class: 'btn', href: '#/' }, icon('arrow-left', 14), 'All programs')));
    detailTab = tab || 'overview';
    const a = p.analysis;
    const rw = rewardText(p);
    const view = h('div', { class: 'view detail' });

    view.append(h('a', { class: 'back', href: '#/' }, icon('arrow-left', 14), 'All programs'));

    view.append(h('div', { class: 'dhead' },
      h('div', { class: 'dhead-main' },
        h('div', { class: 'row wrap-row' }, platformTag(p), levelTag(a), newTag(p),
          p.safeHarbor === 'full' ? h('span', { class: 'tag info' }, 'Safe harbor') : null,
          p.managed ? h('span', { class: 'tag' }, 'Managed') : null,
          p.submissionState && p.submissionState !== 'open' ? h('span', { class: 'tag warn' }, p.submissionState) : null),
        h('h1', { class: 'dname' }, p.name),
        p.firstSeen ? h('p', { class: 'muted small' }, 'First seen ' + p.firstSeen + ' (' + dayLabel(p.firstSeen) + ')') : null,
        h('div', { class: 'row wrap-row' },
          p.url ? h('a', { class: 'btn primary', href: p.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open program page', icon('external', 14)) : null,
          p.website ? h('a', { class: 'btn', href: p.website, target: '_blank', rel: 'noopener noreferrer' }, 'Company site') : null,
          bookmarkBtn(p))),
      h('div', { class: 'dreward card' },
        h('span', { class: 'eyebrow' }, 'Reward'),
        h('b', { class: rw.cls }, rw.main),
        h('span', { class: 'muted small' }, rw.sub),
        p.responseEfficiency != null ? h('span', { class: 'small dim' }, p.responseEfficiency + '% response efficiency') : null,
        p.avgFirstResponseDays != null ? h('span', { class: 'small dim' }, '~' + (p.avgFirstResponseDays < 1 ? '<1' : Math.round(p.avgFirstResponseDays)) + ' days to first reply') : null)));

    const tabs = [['overview', 'Overview'], ['scope', 'Scope · ' + a.total], ['playbook', 'Playbook']];
    const body = h('div', {});
    const tabBar = h('div', { class: 'tabs' }, tabs.map(([k, l]) =>
      h('button', { class: k === detailTab ? 'active' : '', type: 'button', onclick: () => { detailTab = k; paint(); } }, l)));
    view.append(tabBar, body);

    function paint() {
      tabBar.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', tabs[i][0] === detailTab));
      body.innerHTML = '';
      if (detailTab === 'overview') body.append(overview());
      else if (detailTab === 'scope') body.append(scopeTab());
      else body.append(playbook());
    }

    function overview() {
      const g = h('div', { class: 'grid-2' });
      g.append(h('div', { class: 'card pad' },
        h('div', { class: 'card-title' }, icon('activity', 15), 'Difficulty'),
        h('div', { class: 'gauge-row' }, gauge(a.difficulty.score, a.difficulty.level),
          h('div', {}, h('div', { class: 'h3' }, BF.DIFFICULTY[a.difficulty.level].label),
            h('ul', { class: 'why' }, a.why.slice(0, 5).map(w => h('li', {}, w)))))));
      g.append(h('div', { class: 'card pad' },
        h('div', { class: 'card-title' }, icon('layers', 15), 'Attack surface'),
        a.topCats.length ? a.topCats.slice(0, 6).map(({ cat, count }) => bar(catLabel(cat), count, Math.max(...a.topCats.map(c => c.count)), count))
          : h('p', { class: 'muted' }, 'Scope is described on the program page.'),
        a.tech.length ? h('div', { class: 'tech-row' }, h('span', { class: 'muted small' }, 'Tech spotted:'), a.tech.slice(0, 10).map(techChip)) : null));
      const out = h('div', { class: 'stack' });
      if (p.summary) out.append(h('div', { class: 'card pad' }, h('div', { class: 'card-title' }, icon('info', 15), 'About'), h('p', { class: 'dim' }, p.summary)));
      out.append(g);
      if (a.vulnClasses.length) {
        out.append(h('div', { class: 'card pad' }, h('div', { class: 'card-title' }, icon('bug', 15), 'What to hunt here'),
          h('div', { class: 'hunt' }, a.vulnClasses.map(([n, hint]) => h('div', {}, h('b', {}, n), h('span', { class: 'dim small' }, hint))))));
      }
      return out;
    }

    function scopeTab() {
      let which = 'in';
      const wrap = h('div', { class: 'card pad' });
      const seg = h('div', { class: 'seg' },
        h('button', { class: 'on', type: 'button', onclick: () => set('in') }, 'In scope · ' + p.scope.length),
        h('button', { type: 'button', onclick: () => set('oos') }, 'Out of scope · ' + p.oos.length));
      const host = h('div', {});
      function set(w) { which = w; seg.children[0].classList.toggle('on', w === 'in'); seg.children[1].classList.toggle('on', w === 'oos'); host.innerHTML = ''; host.append(scopeTable(p, which)); }
      wrap.append(h('div', { class: 'row wrap-row', style: 'margin-bottom:14px' }, seg, h('span', { class: 'spacer' }),
        a.bountyEligibleAssets ? h('span', { class: 'muted small' }, a.bountyEligibleAssets + ' bounty-eligible targets') : null), host);
      set('in');
      return wrap;
    }

    function playbook() {
      const pb = a.playbook;
      const step = (n, title, content) => h('div', { class: 'pb-step card pad' },
        h('div', { class: 'pb-num' }, n), h('div', { class: 'pb-body' }, h('h3', { class: 'h3' }, title), content));
      return h('div', { class: 'stack' },
        step('01', 'Recon', pb.recon.length ? h('div', { class: 'pb-list' }, pb.recon.map(([t, d]) => h('div', {}, h('b', {}, t), h('code', {}, d)))) : h('p', { class: 'muted' }, 'Small, fixed scope: skip recon and start testing.')),
        step('02', 'Attack', pb.attack.length ? h('div', { class: 'pb-list' }, pb.attack.map(([t, d]) => h('div', {}, h('b', {}, t), h('span', { class: 'dim' }, d)))) : h('p', { class: 'muted' }, 'General web methodology applies.')),
        step('03', 'Free toolkit', h('div', { class: 'row wrap-row' }, pb.tools.map(t => h('span', { class: 'tag' }, t)))),
        step('04', 'Rules', h('div', {}, h('ul', { class: 'why' }, pb.rules.map(r => h('li', {}, r))), h('div', { class: 'note' }, icon('flag', 15), h('span', {}, pb.expectation)))));
    }

    paint();
    return view;
  }

  /* ============================================================
     SKILL MATCH
     ============================================================ */
  function studentMode() {
    const st = BFFilters.get();
    const view = h('div', { class: 'view' });
    view.append(pageHead('Skill match', 'Programs that fit you',
      'Pick your level and what you can already do. BountyFlow ranks the programs where those skills actually apply.'));

    view.append(h('div', { class: 'card pad stack' },
      h('div', {}, h('div', { class: 'pop-label', style: 'padding-left:0' }, 'Your level'),
        h('div', { class: 'seg' }, [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([lv, l]) =>
          h('button', { class: st.studentLevel === lv ? 'on' : '', type: 'button', onclick: () => BFFilters.patch({ studentLevel: st.studentLevel === lv ? null : lv }) }, l)))),
      h('div', {}, h('div', { class: 'pop-label', style: 'padding-left:0' }, 'What you can do today'),
        h('div', { class: 'row wrap-row' }, Object.entries(BF.SKILLS).map(([k, s]) =>
          h('button', { class: 'chip' + (st.studentSkills.includes(k) ? ' on' : ''), type: 'button', onclick: () => BFFilters.patch({ studentSkills: toggleIn(st.studentSkills, k) }) }, s.label))))));

    if (st.studentSkills.length) {
      const path = BFAnalyzer.learningPath(programs, st.studentSkills);
      if (path.length) {
        view.append(h('div', { class: 'card pad' }, h('div', { class: 'card-title' }, icon('trending', 15), 'Learn next to unlock more programs'),
          h('div', { class: 'learn' }, path.map(({ skill, unlocks, advice }) =>
            h('div', {}, h('b', {}, BF.SKILLS[skill] ? BF.SKILLS[skill].label : skill), h('span', { class: 'tag red' }, '+' + unlocks), h('span', { class: 'dim small' }, advice))))));
      }
    }

    const matched = programs.map(p => ({ p, m: BFAnalyzer.skillMatch(p, st.studentSkills) }))
      .filter(x => st.studentSkills.length ? x.m != null : true)
      .filter(x => st.studentLevel ? x.p.analysis.difficulty.level === st.studentLevel : true)
      .sort((x, y) => (y.m || 0) - (x.m || 0) || (y.p.offersBounties - x.p.offersBounties));

    view.append(h('div', { class: 'section-head', style: 'margin-top:28px' }, h('h2', {}, matched.length.toLocaleString() + ' matching programs'),
      matched.length > 40 ? h('span', { class: 'muted small' }, 'showing the best 40') : null));
    view.append(matched.length
      ? h('div', { class: 'plist card' }, listHeader(), matched.slice(0, 40).map(({ p }) => programRow(p)))
      : h('div', { class: 'card empty' }, h('h3', {}, 'No matches'), h('p', {}, 'Untick a skill or change level.')));
    return view;
  }

  /* ============================================================
     SCOPE CHECK
     ============================================================ */
  function explorer() {
    const view = h('div', { class: 'view' });
    view.append(pageHead('Scope check', 'Is this domain in scope?',
      'Before you touch a target, check whether any program covers it. Matches exact targets and wildcards like *.example.com.'));
    const out = h('div', { style: 'margin-top:20px' });
    function run(q) {
      out.innerHTML = '';
      if (!q) return;
      const res = BFAnalyzer.domainCoveredBy(q, programs);
      if (res.length) {
        out.append(h('div', { class: 'note ok' }, icon('circle-check', 16), h('span', {}, res.length + (res.length === 1 ? ' program covers ' : ' programs cover '), h('b', { class: 'mono' }, q.toLowerCase()), '. Read the policy before testing.')),
          h('div', { class: 'plist card', style: 'margin-top:14px' }, res.slice(0, 30).map(({ p, via }) => programRow(p, h('span', { class: 'tag' }, 'via ' + via)))));
      } else {
        out.append(h('div', { class: 'note red' }, icon('ban', 16), h('span', {}, h('b', {}, 'Not covered. '), 'No listed program has this domain in scope. Testing it is unauthorized: do not test it.')));
      }
    }
    view.append(h('div', { class: 'search big-search' }, icon('search', 18),
      h('input', { class: 'input', type: 'search', placeholder: 'example.com or api.example.com', autofocus: true, 'aria-label': 'Domain',
        oninput: e => { clearTimeout(view._t); view._t = setTimeout(() => run(e.target.value.trim()), 220); } })), out);
    return view;
  }

  /* ============================================================
     SAVED
     ============================================================ */
  function bookmarks() {
    const view = h('div', { class: 'view' });
    const ids = BFStore.bookmarks();
    const list = programs.filter(p => ids.includes(p.id));
    view.append(pageHead('Saved', 'Your shortlist', 'Programs you starred. Stored in this browser only.'));
    view.append(list.length
      ? h('div', { class: 'plist card' }, listHeader(), list.map(p => programRow(p)))
      : h('div', { class: 'card empty' }, icon('star', 28), h('h3', {}, 'Nothing saved yet'), h('p', {}, 'Hit the star on any program to keep it here.')));
    return view;
  }

  function daysSince(iso) { return Math.round((Date.now() - new Date(iso + 'T12:00:00Z').getTime()) / 86400000); }

  return { setPrograms, dashboard, refreshResults, syncDashboardChrome, programDetail, newFeed, studentMode, explorer, bookmarks, roulette, daysSince };
})();
