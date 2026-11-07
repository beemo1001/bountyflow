/* ============================================================
   BountyFlow · config.js
   Global constants & data source configuration.
   Zero APIs, zero keys: everything below is public static JSON.
   ============================================================ */

const BF = (() => {
  'use strict';

  // Primary + mirror sources for arkadiyt/bounty-targets-data (auto-updated every 30 min upstream)
  const SOURCES = {
    hackerone: [
      'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/master/data/hackerone_data.json',
      'https://cdn.jsdelivr.net/gh/arkadiyt/bounty-targets-data@master/data/hackerone_data.json'
    ],
    bugcrowd: [
      'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/master/data/bugcrowd_data.json',
      'https://cdn.jsdelivr.net/gh/arkadiyt/bounty-targets-data@master/data/bugcrowd_data.json'
    ],
    intigriti: [
      'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/master/data/intigriti_data.json',
      'https://cdn.jsdelivr.net/gh/arkadiyt/bounty-targets-data@master/data/intigriti_data.json'
    ],
    yeswehack: [
      'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/master/data/yeswehack_data.json',
      'https://cdn.jsdelivr.net/gh/arkadiyt/bounty-targets-data@master/data/yeswehack_data.json'
    ]
  };

  // Approximate FX for normalizing bounty currencies to USD (filters only; display keeps original)
  const FX = { USD: 1, EUR: 1.08, GBP: 1.27 };

  const CACHE = {
    DB_NAME: 'bountyflow',
    STORE: 'cache',
    KEY: 'programs-v1',       // bump when normalizePrograms() output shape changes
    TTL_MS: 24 * 60 * 60 * 1000 // 24h
  };

  // Canonical scope categories (icon = name rendered by BFUI.icon)
  const CATS = {
    web:      { label: 'Web',       icon: 'globe',      color: '#3b82f6' },
    api:      { label: 'API',       icon: 'plug',       color: '#06b6d4' },
    wildcard: { label: 'Wildcard',  icon: 'target',     color: '#8b5cf6' },
    mobile:   { label: 'Mobile',    icon: 'smartphone', color: '#f59e0b' },
    desktop:  { label: 'Desktop',   icon: 'monitor',    color: '#a78bfa' },
    network:  { label: 'Network',   icon: 'radio',      color: '#10b981' },
    iot:      { label: 'IoT',       icon: 'cpu',        color: '#f97316' },
    hardware: { label: 'Hardware',  icon: 'wrench',     color: '#ef4444' },
    source:   { label: 'Source',    icon: 'box',        color: '#64748b' },
    web3:     { label: 'Web3',      icon: 'link',       color: '#eab308' },
    ai:       { label: 'AI/ML',     icon: 'brain',      color: '#ec4899' },
    other:    { label: 'Other',     icon: 'help',       color: '#94a3b8' }
  };

  const PLATFORMS = {
    hackerone: { label: 'HackerOne', short: 'H1',  color: '#d8d8de' },
    bugcrowd:  { label: 'Bugcrowd',  short: 'BC',  color: '#f28c5a' },
    intigriti: { label: 'Intigriti', short: 'INT', color: '#6fd3c2' },
    yeswehack: { label: 'YesWeHack', short: 'YWH', color: '#f5d26b' },
    direct:    { label: 'Direct',    short: 'DIR', color: '#ff4458' }
  };

  const DIFFICULTY = {
    beginner:     { label: 'Beginner',     color: '#3ddc97', min: 0,  max: 33 },
    intermediate: { label: 'Intermediate', color: '#f5b942', min: 34, max: 66 },
    advanced:     { label: 'Advanced',     color: '#ff4458', min: 67, max: 100 }
  };

  // Skill taxonomy used by Student Mode (icon = name rendered by BFUI.icon)
  const SKILLS = {
    recon:     { label: 'Recon & OSINT',        icon: 'search' },
    web:       { label: 'Web app testing',       icon: 'globe' },
    api:       { label: 'API testing',           icon: 'plug' },
    xss:       { label: 'XSS',                   icon: 'zap' },
    sqli:      { label: 'SQLi',                  icon: 'database' },
    logic:     { label: 'Business logic',        icon: 'puzzle' },
    mobile:    { label: 'Mobile (Android/iOS)',  icon: 'smartphone' },
    network:   { label: 'Network & infra',       icon: 'radio' },
    code:      { label: 'Code review',           icon: 'book' },
    web3:      { label: 'Web3 / Solidity',       icon: 'link' },
    hardware:  { label: 'Hardware / IoT',        icon: 'wrench' }
  };

  // How long a program counts as "new" (days since first seen)
  const NEW_DAYS = 14;

  return { SOURCES, FX, CACHE, CATS, PLATFORMS, DIFFICULTY, SKILLS, NEW_DAYS };
})();
