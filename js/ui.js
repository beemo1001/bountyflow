/* ============================================================
   BountyFlow · ui.js
   Shared rendering helpers: DOM builder, SVG icon system,
   badges, program cards, scope tables, gauges, money formatting.
   ============================================================ */

const BFUI = (() => {
  'use strict';

  /* ---------- tiny DOM helper ---------- */
  const BOOL_PROPS = new Set(['checked', 'disabled', 'selected', 'hidden', 'readonly', 'multiple', 'autofocus', 'required', 'open']);
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (typeof v === 'boolean') {
          // setAttribute('checked', false) would render checked="false" → TRUE. Use properties.
          if (v && BOOL_PROPS.has(k)) el[k] = true;
          else if (v) el.setAttribute(k, '');
        }
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(c));
    }
    return el;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- SVG icon system (Lucide-style, stroke-based) ---------- */
  const ICONS = {
    'search': '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'circle-check': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
    'ban': '<circle cx="12" cy="12" r="9"/><path d="m5.3 5.3 13.4 13.4"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'arrow-up-right': '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    'sliders': '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><circle cx="12" cy="4" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="20" r="2"/>',
    'shuffle': '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
    'refresh': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'rotate': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    'grid': '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
    'grad-cap': '<path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    'crosshair': '<circle cx="12" cy="12" r="9"/><path d="M21 12h-4"/><path d="M7 12H3"/><path d="M12 7V3"/><path d="M12 21v-4"/>',
    'dollar': '<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    'gift': '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'globe': '<circle cx="12" cy="12" r="9"/><path d="M12 3a13.5 13.5 0 0 0 0 18"/><path d="M12 3a13.5 13.5 0 0 1 0 18"/><path d="M3 12h18"/>',
    'plug': '<path d="M12 22v-4"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    'target': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    'smartphone': '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    'monitor': '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    'radio': '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/>',
    'cpu': '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M15 2v2.5"/><path d="M15 19.5V22"/><path d="M2 15h2.5"/><path d="M2 9h2.5"/><path d="M19.5 15H22"/><path d="M19.5 9H22"/><path d="M9 2v2.5"/><path d="M9 19.5V22"/>',
    'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'brain': '<path d="M12 5a3 3 0 1 0-5.99.125 4 4 0 0 0-2.53 5.77 4 4 0 0 0 .55 6.59A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.99.125 4 4 0 0 1 2.53 5.77 4 4 0 0 1-.55 6.59A4 4 0 1 1 12 18Z"/>',
    'help': '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    'puzzle': '<path d="M19.44 7.85a1 1 0 0 0 .29.88l1.57 1.57a1.97 1.97 0 0 1 0 2.79l-1.61 1.61a.98.98 0 0 1-.84.28c-.47-.07-.8-.48-.96-.93a2.5 2.5 0 1 0-3.22 3.22c.45.16.86.49.93.96a.98.98 0 0 1-.28.84l-1.61 1.61a1.97 1.97 0 0 1-2.79 0l-1.57-1.57a1 1 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.47-.18.9-.53.97-1.02a1 1 0 0 0-.29-.88L2.71 13.7a1.97 1.97 0 0 1 0-2.79l1.61-1.61c.24-.24.58-.35.92-.28.51.08.88.53 1.07 1.01a2.5 2.5 0 1 0 3.26-3.26c-.48-.19-.93-.56-1.01-1.07-.07-.34.04-.68.28-.92l1.53-1.53a1.97 1.97 0 0 1 2.79 0l1.57 1.57c.23.23.55.33.87.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.47.18-.9.53-.97 1.02Z"/>',
    'book': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    'bug': '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    'alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    'trending': '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
    'folder': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'info': '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'sprout': '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    'code': '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    'activity': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'list': '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    'banknote': '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>'
  };

  function icon(name, size = 16, cls = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', ('ic ' + cls).trim());
    svg.innerHTML = ICONS[name] || ICONS.help;
    return svg;
  }

  /* ---------- formatters ---------- */
  function money(usd) {
    if (!usd && usd !== 0) return null;
    if (usd >= 1000000) return '$' + (usd / 1000000).toFixed(usd % 1000000 === 0 ? 0 : 1) + 'M';
    if (usd >= 1000) return '$' + Math.round(usd / 1000) + 'k';
    return '$' + usd;
  }

  function timeAgo(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const hr = Math.floor(m / 60);
    if (hr < 24) return hr + 'h ago';
    return Math.floor(hr / 24) + 'd ago';
  }

  /* ---------- badges & chips ---------- */
  function platformBadge(p) {
    const pl = BF.PLATFORMS[p.platform];
    return h('span', { class: 'badge platform platform-' + p.platform, title: pl.label },
      h('span', { class: 'badge-dot' }), pl.short);
  }

  function difficultyBadge(a) {
    const d = BF.DIFFICULTY[a.difficulty.level];
    return h('span', { class: 'badge diff diff-' + a.difficulty.level, title: 'Difficulty ' + a.difficulty.score + '/100 · ' + a.why.slice(0, 3).join(' · ') },
      h('span', { class: 'badge-dot' }), d.label, h('span', { class: 'diff-score' }, a.difficulty.score));
  }

  function catChip(cat, count, clickable) {
    const c = BF.CATS[cat] || BF.CATS.other;
    const attrs = { class: 'chip cat-chip' + (clickable ? ' clickable' : ''), title: c.label + (count ? ' · ' + count + ' assets' : '') };
    if (clickable) {
      attrs.onclick = () => { BFFilters.patch({ cats: [cat] }); window.BFApp.go('#/'); };
    }
    return h('span', attrs, icon(c.icon, 11), c.label + (count ? ' ' + count : ''));
  }

  function techChip(t) {
    return h('span', { class: 'chip tech-chip', title: t.group }, t.id);
  }

  /* ---------- difficulty gauge (SVG arc) ---------- */
  function gauge(score, level) {
    const color = BF.DIFFICULTY[level].color;
    const r = 44, cx = 55, cy = 55;
    const frac = score / 100;
    const start = Math.PI * 0.75, end = start + Math.PI * 1.5 * frac;
    const arc = (a, b) => {
      const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a);
      const x2 = cx + r * Math.cos(b), y2 = cy + r * Math.sin(b);
      const large = b - a > Math.PI ? 1 : 0;
      return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 110 110');
    svg.setAttribute('class', 'gauge');
    svg.innerHTML =
      `<path d="${arc(start, start + Math.PI * 1.5)}" fill="none" stroke="#1b2740" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="${arc(start, Math.max(start + 0.01, end))}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>` +
      `<text x="55" y="53" text-anchor="middle" fill="#e9eef7" font-size="23" font-weight="600" font-family="'IBM Plex Mono', monospace">${score}</text>` +
      `<text x="55" y="70" text-anchor="middle" fill="#66748f" font-size="9" letter-spacing="2">/100</text>`;
    return svg;
  }

  /* ---------- horizontal bar (stats) ---------- */
  function bar(label, value, max, color, valueLabel) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return h('div', { class: 'bar-row' },
      h('span', { class: 'bar-label' }, label),
      h('div', { class: 'bar-track' },
        h('div', { class: 'bar-fill', style: `width:${Math.max(pct, 2)}%;background:${color || 'var(--accent)'};` })),
      h('span', { class: 'bar-value' }, valueLabel != null ? valueLabel : value));
  }

  /* ============================================================
     PROGRAM CARD (dashboard grid)
     ============================================================ */
  function programCard(p, opts) {
    const a = p.analysis;
    const bookmarked = BFStore.isBookmarked(p.id);

    const bountyBox = p.bountyKnown && p.maxBountyUSD
      ? h('div', { class: 'card-bounty' },
          h('span', { class: 'bounty-label' }, 'Max bounty'),
          h('div', { class: 'bounty-row' },
            h('span', { class: 'bounty-max' }, money(p.maxBountyUSD)),
            p.minBountyUSD ? h('span', { class: 'bounty-min' }, 'min ' + money(p.minBountyUSD)) : null,
            p.bountyApprox ? h('span', { class: 'bounty-approx', title: 'Approximate public figure: verify on program page' }, '≈') : null))
      : p.offersBounties
        ? h('div', { class: 'card-bounty' },
            h('span', { class: 'bounty-label' }, 'Rewards'),
            h('div', { class: 'bounty-row' },
              h('span', { class: 'bounty-unknown' }, icon('dollar', 14), 'Cash bounties'),
              h('span', { class: 'bounty-note' }, 'amount varies')))
        : h('div', { class: 'card-bounty vdp' },
            h('span', { class: 'bounty-label' }, 'Rewards'),
            h('div', { class: 'bounty-row' },
              h('span', { class: 'bounty-unknown' }, icon(p.offersSwag ? 'gift' : 'shield', 14), p.offersSwag ? 'VDP + swag' : 'VDP'),
              h('span', { class: 'bounty-note' }, 'no cash')));

    const metaIcons = [];
    if (p.responseEfficiency != null) metaIcons.push(h('span', { class: 'meta-eff ' + (p.responseEfficiency >= 80 ? 'good' : ''), title: 'Response efficiency' }, icon('zap', 12), p.responseEfficiency + '%'));
    if (p.safeHarbor === 'full') metaIcons.push(h('span', { title: 'Full safe harbor: legal protection' }, icon('shield-check', 12)));
    if (p.allowsDisclosure) metaIcons.push(h('span', { title: 'Disclosure allowed' }, icon('megaphone', 12)));

    const card = h('article', {
      class: 'card program-card level-' + a.difficulty.level,
      dataset: { id: p.id },
      onclick: (e) => { if (!e.target.closest('.card-actions, a')) BFApp.go('#/program/' + encodeURIComponent(p.id)); }
    },
      h('div', { class: 'card-top' },
        platformBadge(p),
        h('div', { class: 'card-actions' },
          h('button', {
            class: 'icon-btn bm-btn' + (bookmarked ? ' active' : ''),
            title: bookmarked ? 'Remove bookmark' : 'Bookmark program',
            onclick: (e) => { e.stopPropagation(); BFStore.toggleBookmark(p.id); e.currentTarget.classList.toggle('active'); }
          }, icon('star', 14))
        )
      ),
      h('h3', { class: 'card-name', title: p.name }, p.name),
      bountyBox,
      h('p', { class: 'card-line' }, a.oneLiner),
      h('div', { class: 'card-cats' },
        a.topCats.slice(0, 4).map(({ cat, count }) => catChip(cat, count, true)),
        a.total > 0 ? h('span', { class: 'chip count-chip' }, a.total + ' assets') : null),
      h('div', { class: 'card-foot' },
        h('div', { class: 'card-foot-left' },
          difficultyBadge(a),
          a.tech.length ? h('span', { class: 'meta-icons', title: a.tech.slice(0, 10).map(t => t.id).join(', ') }, icon('code', 12), a.tech.slice(0, 2).map(t => t.id).join(' · ')) : null,
          metaIcons.length ? h('span', { class: 'meta-icons' }, metaIcons) : null),
        h('a', { class: 'card-link', href: p.url, target: '_blank', rel: 'noopener noreferrer', onclick: e => e.stopPropagation() },
          'Open', icon('arrow-up-right', 11))
      )
    );

    return card;
  }

  /* ============================================================
     SCOPE TABLE (program detail view): paginated
     ============================================================ */
  function scopeTable(p, which) {
    const items = which === 'oos' ? p.oos : p.scope;
    const PER = 50;
    let page = 1, q = '';

    function rows() {
      const filtered = q
        ? items.filter(t => (t.t + ' ' + (t.n || '')).toLowerCase().includes(q.toLowerCase()))
        : items;
      return filtered;
    }

    function render() {
      const filtered = rows();
      const pages = Math.max(1, Math.ceil(filtered.length / PER));
      if (page > pages) page = pages;
      const slice = filtered.slice((page - 1) * PER, page * PER);

      root.innerHTML = '';
      root.append(
        h('div', { class: 'scope-toolbar' },
          h('input', {
            class: 'scope-search input', type: 'search', placeholder: 'Filter ' + filtered.length + ' assets…',
            value: q,
            oninput: e => { q = e.target.value; page = 1; render(); e.target.focus(); }
          }),
          h('span', { class: 'scope-count' }, filtered.length.toLocaleString() + ' / ' + items.length.toLocaleString())
        )
      );

      if (!slice.length) {
        root.append(h('div', { class: 'empty-note' }, which === 'oos' ? 'No out-of-scope items listed.' : 'No in-scope assets match.'));
        return;
      }

      const table = h('table', { class: 'scope-table' },
        h('thead', {}, h('tr', {},
          h('th', {}, 'Type'),
          h('th', {}, 'Target'),
          which === 'in' ? h('th', { title: 'Eligible for bounty' }, icon('dollar', 11)) : null,
          which === 'in' ? h('th', { title: 'Max severity accepted' }, 'Sev') : null,
          h('th', {}, 'Notes')
        )));
      const tbody = h('tbody', {});
      slice.forEach(t => {
        const c = BF.CATS[t.cat] || BF.CATS.other;
        tbody.append(h('tr', {},
          h('td', {}, h('span', { class: 'chip cat-chip' }, icon(c.icon, 11), c.label)),
          h('td', { class: 'tgt' }, h('span', { class: 'mono' }, t.t || 'n/a')),
          which === 'in' ? h('td', {}, t.b ? h('span', { class: 'bounty-yes', title: 'Bounty eligible' }, icon('dollar', 13)) : h('span', { class: 'dim', title: 'Submission eligible only' }, '·')) : null,
          which === 'in' ? h('td', {}, t.s ? h('span', { class: 'sev sev-' + t.s }, t.s) : h('span', { class: 'dim' }, 'n/a')) : null,
          h('td', { class: 'note' }, t.n ? t.n.slice(0, 220) : '')
        ));
      });
      table.append(tbody);
      root.append(table);

      if (pages > 1) {
        root.append(h('div', { class: 'pager' },
          h('button', { class: 'btn small', disabled: page === 1, onclick: () => { page--; render(); root.scrollIntoView({ block: 'start' }); } }, icon('chevron-left', 13), 'Prev'),
          h('span', { class: 'pager-info' }, 'page ' + page + ' / ' + pages),
          h('button', { class: 'btn small', disabled: page === pages, onclick: () => { page++; render(); root.scrollIntoView({ block: 'start' }); } }, 'Next', icon('chevron-right', 13))
        ));
      }
    }

    const root = h('div', { class: 'scope-wrap' });
    render();
    return root;
  }

  return { h, esc, icon, money, timeAgo, platformBadge, difficultyBadge, catChip, techChip, gauge, bar, programCard, scopeTable };
})();
