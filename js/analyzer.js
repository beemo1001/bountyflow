/* ============================================================
   BountyFlow · analyzer.js
   100% client-side, deterministic, explainable program analysis.
   For every program: category stats → tech fingerprint → vuln
   mapping → difficulty score (with WHY reasons) → student playbook.
   No AI APIs. Every rule below is editable by the site owner.
   ============================================================ */

const BFAnalyzer = (() => {
  'use strict';

  /* ---------------------------------------------------------
     1. TECHNOLOGY FINGERPRINTING
     Matched against scope targets + per-asset notes + program name.
     --------------------------------------------------------- */
  const TECH = [
    // CMS & platforms
    { id: 'wordpress',  re: /\bwordpress\b/i,               group: 'CMS' },
    { id: 'drupal',     re: /\bdrupal\b/i,                  group: 'CMS' },
    { id: 'joomla',     re: /\bjoomla\b/i,                  group: 'CMS' },
    { id: 'magento',    re: /\bmagento\b/i,                 group: 'CMS' },
    { id: 'shopify',    re: /\bshopify\b/i,                 group: 'CMS' },
    { id: 'salesforce', re: /\bsalesforce\b|\bsfdc\b/i,     group: 'CMS' },
    { id: 'sap',        re: /\bsap\b(?! ?[a-z])/i,          group: 'CMS' },
    { id: 'sharepoint', re: /\bsharepoint\b/i,              group: 'CMS' },
    // Cloud & infra
    { id: 'aws',        re: /\baws\b|amazon ?web ?services|\.amazonaws\.com/i, group: 'Cloud' },
    { id: 'gcp',        re: /\bgcp\b|google ?cloud|\.appspot\.com/i,           group: 'Cloud' },
    { id: 'azure',      re: /\bazure\b|\.cloudapp\.net|\.azurewebsites\.net/i, group: 'Cloud' },
    { id: 'kubernetes', re: /\bkubernetes\b|\bk8s\b/i,      group: 'Infra' },
    { id: 'docker',     re: /\bdocker\b/i,                  group: 'Infra' },
    { id: 'terraform',  re: /\bterraform\b/i,               group: 'Infra' },
    { id: 'jenkins',    re: /\bjenkins\b/i,                 group: 'Infra' },
    { id: 'github-actions', re: /github actions|\bgha\b/i,  group: 'Infra' },
    { id: 'gitlab',     re: /\bgitlab\b/i,                  group: 'Infra' },
    { id: 'jira',       re: /\bjira\b/i,                    group: 'Infra' },
    { id: 'confluence', re: /\bconfluence\b/i,              group: 'Infra' },
    { id: 'kibana',     re: /\bkibana\b/i,                  group: 'Infra' },
    { id: 'grafana',    re: /\bgrafana\b/i,                 group: 'Infra' },
    { id: 'prometheus', re: /\bprometheus\b/i,              group: 'Infra' },
    { id: 'elasticsearch', re: /\belastic ?search\b/i,      group: 'Data' },
    { id: 'kafka',      re: /\bkafka\b/i,                   group: 'Data' },
    { id: 'rabbitmq',   re: /\brabbitmq\b/i,                group: 'Data' },
    { id: 'mongodb',    re: /\bmongodb?\b|\bmongo atlas\b/i, group: 'Data' },
    { id: 'postgres',   re: /\bpostgres(ql)?\b/i,           group: 'Data' },
    { id: 'mysql',      re: /\bmysql\b|\bmariadb\b/i,       group: 'Data' },
    { id: 'redis',      re: /\bredis\b/i,                   group: 'Data' },
    { id: 'memcached',  re: /\bmemcached\b/i,               group: 'Data' },
    // API & services
    { id: 'graphql',    re: /\bgraphql\b/i,                 group: 'API' },
    { id: 'rest-api',   re: /\brest( ?api)?\b/i,            group: 'API' },
    { id: 'grpc',       re: /\bgrpc\b/i,                    group: 'API' },
    { id: 'soap',       re: /\bsoap\b/i,                    group: 'API' },
    { id: 'websocket',  re: /\bwebsocket|\bws\b(?=[ .\/:])/i, group: 'API' },
    { id: 'oauth',      re: /\boauth(2)?\b/i,               group: 'Auth' },
    { id: 'sso',        re: /\bsso\b|single sign ?on/i,     group: 'Auth' },
    { id: 'saml',       re: /\bsaml\b/i,                    group: 'Auth' },
    { id: 'jwt',        re: /\bjwt\b|json web token/i,      group: 'Auth' },
    { id: 'okta',       re: /\bokta\b/i,                    group: 'Auth' },
    { id: 'auth0',      re: /\bauth0\b/i,                   group: 'Auth' },
    { id: 'ldap',       re: /\bldap\b/i,                    group: 'Auth' },
    { id: 'kerberos',   re: /\bkerberos\b/i,                group: 'Auth' },
    // Frontend & languages
    { id: 'react',      re: /\breact(\.js)?\b/i,            group: 'Frontend' },
    { id: 'angular',    re: /\bangular\b/i,                 group: 'Frontend' },
    { id: 'vue',        re: /\bvue(\.js)?\b/i,              group: 'Frontend' },
    { id: 'nodejs',     re: /\bnode(\.js|js)?\b/i,          group: 'Backend' },
    { id: 'php',        re: /\bphp\b|laravel|symfony/i,     group: 'Backend' },
    { id: 'java',       re: /\bjava\b|\bspring ?boot\b|tomcat|websphere|struts/i, group: 'Backend' },
    { id: 'dotnet',     re: /\.?net\b|asp\.net|c#|iis\b/i,  group: 'Backend' },
    { id: 'python',     re: /\bpython\b|django|flask|fastapi/i, group: 'Backend' },
    { id: 'ruby',       re: /\bruby\b|\brails\b/i,          group: 'Backend' },
    { id: 'golang',     re: /\bgolang? language|\bgolang\b/i, group: 'Backend' },
    // Mobile
    { id: 'android',    re: /\bandroid\b|\bapk\b/i,         group: 'Mobile' },
    { id: 'ios',        re: /\bios\b|\bipa\b|testflight|swift\b/i, group: 'Mobile' },
    { id: 'flutter',    re: /\bflutter\b/i,                 group: 'Mobile' },
    { id: 'react-native', re: /react native/i,              group: 'Mobile' },
    // Web3
    { id: 'solidity',   re: /\bsolidity\b/i,                group: 'Web3' },
    { id: 'evm',        re: /\bevm\b|ethereum|smart contract|\bdefi\b|\bnft\b|\bdapp\b/i, group: 'Web3' },
    { id: 'solana',     re: /\bsolana\b/i,                  group: 'Web3' },
    { id: 'polygon',    re: /\bpolygon\b/i,                 group: 'Web3' },
    // Networking & protocols
    { id: 'vpn',        re: /\bvpn\b/i,                     group: 'Network' },
    { id: 'ssh',        re: /\bssh\b/i,                     group: 'Network' },
    { id: 'rdp',        re: /\brdp\b|remote desktop/i,      group: 'Network' },
    { id: 'mqtt',       re: /\bmqtt\b/i,                    group: 'Network' },
    { id: 'bluetooth',  re: /bluetooth|\bble\b(?!ss)/i,     group: 'Network' },
    { id: 'nfc',        re: /\bnfc\b/i,                     group: 'Network' },
    { id: 'tor',        re: /\btor\b|\.onion\b/i,           group: 'Network' },
    // Security & edge
    { id: 'cloudflare', re: /cloudflare/i,                  group: 'Edge' },
    { id: 'akamai',     re: /akamai/i,                      group: 'Edge' },
    { id: 'waf',        re: /\bwaf\b|web application firewall/i, group: 'Edge' },
    { id: 'cdn',        re: /\bcdn\b/i,                     group: 'Edge' },
    // Payments & SaaS
    { id: 'stripe',     re: /\bstripe\b/i,                  group: 'Payments' },
    { id: 'paypal',     re: /\bpaypal\b/i,                  group: 'Payments' },
    { id: 'sendgrid',   re: /sendgrid/i,                    group: 'SaaS' },
    { id: 'twilio',     re: /twilio/i,                      group: 'SaaS' },
    { id: 'zendesk',    re: /zendesk/i,                     group: 'SaaS' },
    { id: 'hubspot',    re: /hubspot/i,                     group: 'SaaS' },
    { id: 'firebase',   re: /firebase/i,                    group: 'SaaS' },
    { id: 'supabase',   re: /supabase/i,                    group: 'SaaS' }
  ];

  /* ---------------------------------------------------------
     2. VULNERABILITY CLASS MAPPING per category
     --------------------------------------------------------- */
  const VULNS = {
    web: [
      ['XSS', 'Reflected, stored & DOM-based: hunt unfiltered sinks'],
      ['SQL Injection', 'Look for error-based & blind SQLi in old parameters'],
      ['IDOR', 'Swap object IDs in requests to access other users data'],
      ['SSRF', 'Find URL-fetching features (import, preview, webhook)'],
      ['CSRF', 'State-changing actions without anti-CSRF tokens'],
      ['Open Redirect', 'Redirect parameters, especially in login flows'],
      ['Info Disclosure', 'Exposed configs, backups, .git, API keys'],
      ['Business Logic', 'Price tampering, race conditions, flow bypasses'],
      ['Auth Bypass', 'Registration, password reset & MFA logic flaws'],
      ['RCE', 'Template injection, deserialization, file upload chains']
    ],
    api: [
      ['BOLA / IDOR', 'Object-level authorization: the #1 API bug'],
      ['BFLA', 'Function-level authorization: call admin endpoints'],
      ['Broken Authentication', 'Token leaks, weak JWT verification'],
      ['Mass Assignment', 'Send extra fields like "role":"admin"'],
      ['Rate Limiting', 'Brute-force, enumeration, SMS/email bombing'],
      ['Excessive Data Exposure', 'APIs returning more than the UI shows'],
      ['Injection', 'GraphQL/REST query injection, NoSQL operators']
    ],
    wildcard: [
      ['Subdomain Takeover', 'Dangling CNAMEs to unclaimed cloud services'],
      ['Forgotten Assets', 'Old dev/staging environments exposed publicly'],
      ['Exposed Panels', 'Admin dashboards, Jenkins, Kibana without auth'],
      ['Misconfiguration', 'Bucket perms, CORS wildcards, directory listing']
    ],
    mobile: [
      ['Insecure Storage', 'Tokens/PII in plain text or weak keystore use'],
      ['Weak TLS Validation', 'Certificate pinning bypass → MITM'],
      ['Hardcoded Secrets', 'API keys & endpoints in the binary'],
      ['Deep Link Abuse', 'Hijack app links to steal tokens/actions'],
      ['IPC Issues', 'Exported activities/content providers leaking data']
    ],
    desktop: [
      ['Memory Corruption', 'Fuzz file parsers & IPC surfaces'],
      ['Insecure Deserialization', 'Config & update file parsing'],
      ['DLL Hijacking', 'Search-order abuse for privilege escalation'],
      ['Logic Flaws', 'Update mechanisms, license bypasses']
    ],
    network: [
      ['Outdated Services', 'Version-matched exploits via Nmap'],
      ['Default Credentials', 'Vendor logins never rotated'],
      ['Weak Ciphers', 'Legacy TLS/SSH protocols still enabled'],
      ['Info Leaks', 'SNMP strings, DNS zone transfers, banners']
    ],
    iot: [
      ['Firmware Analysis', 'Extract & diff firmware images'],
      ['Debug Interfaces', 'UART/JTAG shells left enabled'],
      ['MQTT Misconfig', 'Open brokers, weak ACLs'],
      ['OTA Update Flaws', 'Unsigned or downgradeable updates']
    ],
    source: [
      ['Code Review', 'Trace untrusted input to dangerous sinks'],
      ['Dependency Vulns', 'Known CVEs in outdated libraries'],
      ['Hardcoded Secrets', 'Keys & passwords committed to repos'],
      ['Logic Flaws', 'Trust-boundary violations between modules']
    ],
    web3: [
      ['Reentrancy', 'External calls re-entering state-mutating functions'],
      ['Access Control', 'Missing onlyOwner / role checks on sensitive fns'],
      ['Oracle Manipulation', 'Price feeds gamed via flash loans'],
      ['Integer Overflow', 'Unchecked math (pre-0.8 Solidity)'],
      ['Approval Abuse', 'Excessive token allowances draining wallets']
    ],
    ai: [
      ['Prompt Injection', 'Override system instructions via user input'],
      ['Indirect Injection', 'Poisoned data the model will later read'],
      ['Model Extraction', 'Steal model behavior via bulk queries'],
      ['Sensitive Data Leak', 'Training data regurgitation']
    ],
    other: [
      ['General Web Checks', 'Apply OWASP Top 10 methodology'],
      ['Config Review', 'Headers, cookies, error handling']
    ]
  };

  // Which skills apply per category (for Student Mode matching)
  const CAT_SKILLS = {
    web: ['web', 'xss', 'sqli', 'logic', 'recon'],
    api: ['api', 'logic', 'recon'],
    wildcard: ['recon', 'web'],
    mobile: ['mobile'],
    desktop: ['code', 'logic'],
    network: ['network'],
    iot: ['hardware', 'network'],
    source: ['code'],
    web3: ['web3'],
    ai: ['logic'],
    other: ['web']
  };

  /* ---------------------------------------------------------
     3. MAIN ANALYSIS
     --------------------------------------------------------- */
  function analyze(p) {
    const catCounts = {};
    let total = 0, bountyEligibleAssets = 0;
    p.scope.forEach(t => {
      catCounts[t.cat] = (catCounts[t.cat] || 0) + 1;
      total++;
      if (t.b) bountyEligibleAssets++;
    });

    // Tech fingerprint
    const text = [
      p.name,
      p.summary || '',
      ...p.scope.map(t => (t.t + ' ' + (t.n || '')).slice(0, 500))
    ].join(' \n ').slice(0, 200000);
    const techFound = [];
    for (const t of TECH) {
      if (t.re.test(text)) techFound.push({ id: t.id, group: t.group });
    }
    // URL-shape enrichment (fast heuristics no regex above catches)
    if (!techFound.some(t => t.id === 'api') && /(^|[.\/])api[.\/-]|[.\/-]api[.\/]|\/api\/|\/graphql/i.test(text)) {
      techFound.push({ id: 'api-endpoint', group: 'API' });
    }

    // Attack-surface profile (shares)
    const shares = {};
    Object.keys(catCounts).forEach(c => shares[c] = total ? catCounts[c] / total : 0);
    const topCats = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => ({ cat: c, count: n }));

    // Difficulty scoring: every delta records a human-readable WHY
    let score = 40;
    const why = [];
    const has = c => (catCounts[c] || 0) > 0;
    const share = c => shares[c] || 0;
    const n = k => catCounts[k] || 0;

    if (n('wildcard') > 0) { score -= 12; why.push('Wildcard scope → broad recon surface, easy entry point (+easy)'); }
    if (n('web') >= 50)    { score -= 12; why.push('50+ web assets → huge attack surface (+easy)'); }
    else if (n('web') >= 10) { score -= 8; why.push('10+ web assets → plenty of surface to explore (+easy)'); }
    if (!p.offersBounties) { score -= 6; why.push('VDP (no cash bounty) → far less competition, ideal practice (+easy)'); }
    if (p.safeHarbor === 'full') { score -= 4; why.push('Full safe harbor → strong legal protection for researchers (+easy)'); }
    if (p.managed && p.platform === 'hackerone') { score -= 3; why.push('Managed program → structured, well-documented rules (+easy)'); }
    if (p.offersSwag) { score -= 2; why.push('Swag rewards → relaxed, beginner-friendly attitude (+easy)'); }

    if (share('web3') > 0.3)     { score += 25; why.push('Web3-heavy scope → requires Solidity/EVM expertise (+hard)'); }
    if (share('hardware') > 0.2 || share('iot') > 0.25) { score += 18; why.push('Hardware/IoT targets → needs physical & firmware skills (+hard)'); }
    if (share('network') > 0.2)  { score += 12; why.push('Network/IP-range targets → infra testing skills required (+hard)'); }
    if (share('source') > 0.2)   { score += 10; why.push('Source-code review scope → advanced code-audit skills (+hard)'); }
    if (share('ai') > 0)         { score += 10; why.push('AI/ML attack surface → emerging, poorly documented area (+hard)'); }
    if (share('mobile') > 0.8)   { score += 8;  why.push('Mobile-only scope → needs device setup, proxying & APK tooling (+hard)'); }
    if (p.bountyKnown && p.maxBountyUSD >= 100000) { score += 8; why.push('$100k+ max bounty → professional researchers compete here (+hard)'); }
    else if (p.bountyKnown && p.maxBountyUSD >= 10000) { score += 4; why.push('$10k+ max bounty → moderate competition (+hard)'); }
    if (p.responseEfficiency != null && p.responseEfficiency < 50) { score += 5; why.push('Low response efficiency (' + p.responseEfficiency + '%) → slow feedback loop (+hard)'); }
    if (p.avgFirstResponseDays != null && p.avgFirstResponseDays > 7) { score += 4; why.push('Slow first response (~' + Math.round(p.avgFirstResponseDays) + 'd) (+hard)'); }
    if (total > 0 && total < 3)  { score += 6; why.push('Tiny scope (' + total + ' assets) → precision required (+hard)'); }

    score = Math.max(5, Math.min(95, Math.round(score)));
    const level = score <= BF.DIFFICULTY.beginner.max ? 'beginner'
                : score <= BF.DIFFICULTY.intermediate.max ? 'intermediate' : 'advanced';

    // Vulnerability classes from top categories (max 4 cats with ≥1 asset)
    const vulnClasses = [];
    for (const { cat } of topCats.slice(0, 4)) {
      (VULNS[cat] || []).forEach(v => {
        if (!vulnClasses.some(x => x[0] === v[0])) vulnClasses.push(v);
      });
    }

    // Skills applicable
    const skills = new Set();
    topCats.forEach(({ cat }) => (CAT_SKILLS[cat] || []).forEach(s => skills.add(s)));
    if (p.platform === 'yeswehack' || p.platform === 'intigriti') skills.add('web');

    const a = {
      catCounts, shares, topCats, total, bountyEligibleAssets,
      tech: techFound, difficulty: { score, level },
      vulnClasses: vulnClasses.slice(0, 12),
      skills: [...skills],
      why
    };
    a.playbook = buildPlaybook(p, a);
    a.oneLiner = buildOneLiner(p, a);
    return a;
  }

  function buildOneLiner(p, a) {
    const top = a.topCats;
    if (!top.length) return 'No in-scope assets listed. Read the policy before testing.';
    // deterministic, varied phrasing per program (stable across reloads)
    const seed = (p.id || p.name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const pick = arr => arr[seed % arr.length];
    const catLabel = c => (BF.CATS[c] || BF.CATS.other).label.toLowerCase();

    // composition: real counts + top categories
    const main = top.length === 1
      ? top[0].count + ' ' + catLabel(top[0].cat) + (top[0].count === 1 ? ' target' : pick([' targets', ' targets', ' assets']))
      : top.slice(0, 2).map(c => c.count + ' ' + catLabel(c.cat)).join(pick([' + ', ' + ', ' and '])) + ' targets';

    const bits = [main];

    if (top.length > 2) bits.push(top.length - 2 + ' more types');
    if ((a.catCounts.wildcard || 0) > 0) bits.push(pick(['wildcard recon open', 'wildcards for subdomain hunting']));
    if (a.tech.length >= 2) bits.push(a.tech.slice(0, 2).map(t => t.id).join('/') + ' stack');
    else if (a.tech.length === 1) bits.push(a.tech[0].id + ' detected');

    // difficulty context, phrased from the data itself
    if (a.difficulty.level === 'advanced' && (a.catCounts.web3 || 0) > 0) bits.push('Solidity skills required');
    if (a.difficulty.level === 'advanced' && (a.catCounts.hardware || 0) + (a.catCounts.iot || 0) > 0) bits.push('firmware & physical testing');

    return bits.slice(0, 3).join(' · ') + '.';
  }

  /* ---------------------------------------------------------
     4. STUDENT PLAYBOOK: "what you can do here"
     --------------------------------------------------------- */
  function buildPlaybook(p, a) {
    const has = c => (a.catCounts[c] || 0) > 0;
    const recon = [], attack = [], tools = [], rules = [];

    // RECON steps
    if (has('wildcard')) {
      recon.push(['Enumerate subdomains', 'subfinder -d <domain> -all | httpx -silent → live hosts', 'recon']);
      recon.push(['Hunt takeovers', 'Check dangling CNAMEs: nuclei -t takeovers/ on resolved hosts', 'recon']);
      recon.push(['Probe for exposed panels', 'ffuf with admin-panel wordlist on found subdomains', 'recon']);
    }
    if (has('web')) {
      recon.push(['Map historical URLs', 'waybackurls <domain> | sort -u → find forgotten endpoints & params', 'recon']);
      recon.push(['Fuzz hidden paths', 'ffuf -w seclists/Discovery/Web-Content -u https://target/FUZZ', 'recon']);
      recon.push(['Run safe CVE scan', 'nuclei -u https://target -severity medium,high,critical', 'recon']);
    }
    if (has('api')) {
      recon.push(['Collect API surface', 'Find docs (swagger/openapi), JS files & mobile traffic for endpoints', 'api']);
      recon.push(['Map object patterns', 'Note ID formats, roles & verbose responses per endpoint', 'api']);
    }
    if (has('mobile')) {
      recon.push(['Prepare mobile lab', 'Android emulator + Burp proxy + apktool/jadx for static analysis', 'mobile']);
      recon.push(['Inspect app traffic', 'Capture API calls, note tokens & pinning behavior', 'mobile']);
    }
    if (has('network')) {
      recon.push(['Service enumeration', 'nmap -sV with PERMISSION: respect program rate limits', 'network']);
    }
    if (has('web3')) {
      recon.push(['Read the contracts', 'Source code on explorer; map external calls & state changes', 'web3']);
      recon.push(['Check known bug patterns', 'reentrancy, access control, oracle usage (Slither helps)', 'web3']);
    }
    if (has('source')) {
      recon.push(['Trace input to sink', 'Grep for untrusted input flowing into exec/query/eval paths', 'code']);
    }

    // ATTACK steps from top vuln classes
    a.vulnClasses.slice(0, 6).forEach(([name, hint]) => {
      attack.push([name, hint, skillForVuln(name)]);
    });

    // TOOLS (free, per surface)
    if (has('web') || has('wildcard')) tools.push('Burp Suite Community', 'ffuf', 'subfinder', 'httpx', 'nuclei', 'waybackurls');
    if (has('api')) tools.push('Burp (Repeater)', 'Postman', 'jwt_tool');
    if (has('mobile')) tools.push('apktool', 'jadx', 'MobSF', 'Frida');
    if (has('network')) tools.push('Nmap', 'testssl.sh');
    if (has('web3')) tools.push('Foundry', 'Slither', 'Etherscan');
    if (has('source')) tools.push('Semgrep', 'CodeQL');
    if (!tools.length) tools.push('Burp Suite Community', 'OWASP ZAP');

    // RULES & warnings
    rules.push('Read the full program policy before testing (links below).');
    if (p.oos && p.oos.length) {
      const excl = p.oos.slice(0, 3).map(t => t.t).filter(Boolean);
      if (excl.length) rules.push('Explicitly OUT of scope: ' + excl.join(', ') + (p.oos.length > 3 ? ' (+' + (p.oos.length - 3) + ' more)' : ''));
    }
    rules.push('No DoS / stress testing unless explicitly allowed.');
    rules.push('Stay in scope: testing out-of-scope assets can get you banned (or worse).');

    // EXPECTATIONS
    let expectation;
    if (p.bountyKnown && p.maxBountyUSD) {
      expectation = 'Bounties up to $' + p.maxBountyUSD.toLocaleString() + (p.minBountyUSD ? ' (from $' + p.minBountyUSD.toLocaleString() + ')' : '') + '. ';
    } else if (p.offersBounties) {
      expectation = 'Pays bounties (amounts vary by severity; check program page). ';
    } else {
      expectation = 'No cash bounty: points, thanks & hall-of-fame. ';
    }
    if (p.offersSwag) expectation += 'Swag offered. ';
    if (p.avgFirstResponseDays != null) expectation += 'First response ~' + (p.avgFirstResponseDays < 1 ? '<1 day' : Math.round(p.avgFirstResponseDays) + ' days') + '.';

    return { recon: recon.slice(0, 6), attack: attack.slice(0, 6), tools: [...new Set(tools)].slice(0, 8), rules, expectation };
  }

  function skillForVuln(v) {
    const map = {
      'XSS': 'xss', 'SQL Injection': 'sqli', 'IDOR': 'logic', 'BOLA / IDOR': 'api',
      'Business Logic': 'logic', 'SSRF': 'web', 'CSRF': 'web', 'Open Redirect': 'web',
      'RCE': 'web', 'Auth Bypass': 'web', 'Broken Authentication': 'api',
      'Mass Assignment': 'api', 'Rate Limiting': 'api', 'Subdomain Takeover': 'recon',
      'Info Disclosure': 'recon', 'Reentrancy': 'web3', 'Access Control': 'web3',
      'Oracle Manipulation': 'web3', 'Integer Overflow': 'web3', 'Approval Abuse': 'web3',
      'Insecure Storage': 'mobile', 'Deep Link Abuse': 'mobile'
    };
    return map[v] || 'web';
  }

  /* ---------------------------------------------------------
     5. STUDENT MODE: skill matching
     --------------------------------------------------------- */
  function skillMatch(program, selectedSkills) {
    if (!selectedSkills.length) return null;
    const applicable = program.analysis.skills;
    if (!applicable.length) return 0;
    const covered = applicable.filter(s => selectedSkills.includes(s)).length;
    // coverage of program needs, scaled; full match = 100
    return Math.round((covered / applicable.length) * 100);
  }

  // Which un-selected skills unlock the most programs (learning path)
  function learningPath(programs, selectedSkills) {
    const counts = {};
    programs.forEach(p => {
      p.analysis.skills.forEach(s => {
        if (!selectedSkills.includes(s)) counts[s] = (counts[s] || 0) + 1;
      });
    });
    const learn = {
      recon: 'Recon fundamentals (subdomain enum, content discovery): start with subfinder & ffuf',
      web: 'Core web testing: PortSwigger Web Security Academy (free) is the gold standard',
      api: 'API testing: study OWASP API Top 10, practice on PortSwigger API labs',
      xss: 'XSS hunting: master DOM sinks & context breaking',
      sqli: 'SQL injection: PortSwigger SQLi labs end-to-end',
      logic: 'Business-logic bugs: learn to think in flows & trust boundaries',
      mobile: 'Mobile testing: set up Android emulator + Burp + MobSF',
      network: 'Network testing: NmapNSE, service enumeration, safe scanning habits',
      code: 'Code review: start with Semgrep, then CodeQL basics',
      web3: 'Web3 security: Ethernaut wargame, then Damn Vulnerable DeFi',
      hardware: 'Hardware/IoT: UART/JTAG basics, firmware extraction'
    };
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s, n]) => ({ skill: s, unlocks: n, advice: learn[s] || '' }));
  }

  /* ---------------------------------------------------------
     6. SCOPE EXPLORER: wildcard coverage matching
     --------------------------------------------------------- */
  function domainCoveredBy(domain, programs) {
    const d = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!d) return [];
    const hits = [];
    for (const p of programs) {
      for (const t of p.scope) {
        if (t.cat === 'wildcard') {
          const base = t.t.replace(/^\*\./, '').replace(/\*.+$/, ''); // *.x.y → x.y, *dev*.x → x
          if (base && (d === base || d.endsWith('.' + base))) { hits.push({ p, via: t.t }); break; }
        } else if (t.cat === 'web' || t.cat === 'api') {
          const host = t.t.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
          if (host === d || host.endsWith('.' + d) || d.endsWith('.' + host)) { hits.push({ p, via: t.t }); break; }
        }
      }
    }
    return hits;
  }

  return { analyze, skillMatch, learningPath, domainCoveredBy, TECH, VULNS };
})();
