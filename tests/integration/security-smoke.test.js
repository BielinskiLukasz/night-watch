// tests/integration/security-smoke.test.js
//
// Repo-wide regression-guard smokes for the architectural invariants every
// Phase 1 plan introduced. These assertions are designed to be cheap, run on
// every push (and in CI before functional tests for fail-fast), and to fail
// loudly with a file + line pointer so the developer can fix the violation
// without reading the test source first.
//
// The invariants asserted here (six total):
//
//   1. T-08 / D-20 — Zero runtime dependencies (package.json contract).
//   2. T-04 — No external network in js/ (no fetch / XHR / WebSocket / EventSource
//      / dynamic import() / <script src=>).
//   3. T-04 (clock-seam) — No `new Date()` literal outside js/adapters/clock-*.js,
//      with one greppable exemption: lines containing `// gsd:allow-ui-clock`.
//   4. D-07 (storage-seam) — No `localStorage` references outside
//      js/adapters/storage-local.js.
//   5. T-07 — No `.innerHTML = ` assignment with non-empty data (only literal
//      empty-string assignments allowed, but Phase 1 has zero of any kind).
//   6. T-01 / adapter file boundary — clock-system.js is the only file outside
//      tests/ that contains `new Date()` without an exemption tag; storage-local.js
//      is the only file in js/ that references `localStorage`.
//
// Plan 01-05 Task 2 — see .planning/phases/NW-01-log-persist/01-05-PLAN.md
//
// The plan-references below the assertions use these tokens (greppable from
// the test source itself per acceptance criterion):
//   - dependencies         (T-08)
//   - fetch(               (T-04 network)
//   - new Date             (T-04 clock-seam)
//   - localStorage         (D-07 storage-seam)
//   - innerHTML            (T-07 XSS-prevention)
//   - gsd:allow-ui-clock   (clock-seam exemption tag)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// -------------------- repo layout --------------------

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(__filename, '..', '..', '..');
const JS_DIR = join(REPO_ROOT, 'js');
const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json');
const INDEX_HTML_PATH = join(REPO_ROOT, 'index.html');

// Files exempt from individual invariant checks (the adapters that DEFINE
// the seam are obviously allowed to break their own boundary).
const CLOCK_ADAPTERS_REL = new Set([
  join('adapters', 'clock-system.js'),
  join('adapters', 'clock-fixed.js'),
]);
const STORAGE_LOCAL_REL = join('adapters', 'storage-local.js');

// Cross-platform sep normalizer (Windows path joins use backslash).
const norm = (p) => p.split(sep).join('/');

// -------------------- file walker --------------------

function* walkJsFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsFiles(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      yield full;
    }
  }
}

function readLines(absPath) {
  return readFileSync(absPath, 'utf-8').split(/\r?\n/);
}

// Reusable per-file scanner: returns an array of { file, lineNo, line }
// violation records.
//
// `exemptLineMarker` (e.g. `// gsd:allow-ui-clock`) is honored on EITHER the
// matching line itself OR the immediately preceding line. Matches the
// idiomatic eslint-disable-next-line convention and Plan 04's existing
// placement (the tag lives on the comment line above the new Date() call).
function scanForPattern({ regex, exemptFiles = new Set(), exemptLineMarker = null }) {
  const violations = [];
  for (const abs of walkJsFiles(JS_DIR)) {
    const rel = relative(JS_DIR, abs);
    if (exemptFiles.has(rel)) continue;
    const lines = readLines(abs);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!regex.test(line)) continue;
      if (exemptLineMarker) {
        if (line.includes(exemptLineMarker)) continue;
        if (i > 0 && lines[i - 1].includes(exemptLineMarker)) continue;
      }
      violations.push({ file: norm(rel), lineNo: i + 1, line: line.trim() });
    }
  }
  return violations;
}

function formatViolations(violations) {
  return violations.map((v) => `  js/${v.file}:${v.lineNo}: ${v.line}`).join('\n');
}

// -------------------- 1. T-08 / D-20 zero runtime dependencies --------------------

describe('T-08 / D-20: zero runtime dependencies (package.json contract)', () => {
  test('package.json dependencies field is literal empty object {}', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    assert.ok(
      pkg.dependencies && typeof pkg.dependencies === 'object',
      'package.json must have an explicit dependencies field (not undefined)',
    );
    const runtimeDeps = Object.keys(pkg.dependencies);
    assert.equal(
      runtimeDeps.length,
      0,
      `Runtime deps not allowed (D-20, T-08). Found: ${runtimeDeps.join(', ')}`,
    );
  });

  test('devDependencies contains @playwright/test only (Phase 1 dev-deps scope)', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    assert.ok(pkg.devDependencies, 'devDependencies must be present');
    assert.ok(
      typeof pkg.devDependencies['@playwright/test'] === 'string'
        && pkg.devDependencies['@playwright/test'].length > 0,
      '@playwright/test must be a non-empty version string in devDependencies',
    );
    const devDeps = Object.keys(pkg.devDependencies);
    assert.deepEqual(
      devDeps.sort(),
      ['@playwright/test'],
      `Phase 1 allows ONLY @playwright/test in devDependencies. Found: ${devDeps.join(', ')}`,
    );
  });
});

// -------------------- 2. T-04 no external network in js/ --------------------

describe('T-04: no external network from js/ (fetch / XHR / WebSocket / EventSource / dynamic import)', () => {
  test('no fetch( / XMLHttpRequest / new WebSocket / new EventSource / dynamic import() in js/ — see source for // gsd:allow-network exemption', () => {
    // Each forbidden token is detected by its own regex; combined into a single
    // multi-pattern scan so the test reports every violation in one shot.
    const patterns = [
      { name: 'fetch(',          re: /\bfetch\s*\(/ },
      { name: 'XMLHttpRequest',  re: /\bXMLHttpRequest\b/ },
      { name: 'new WebSocket(',  re: /\bnew\s+WebSocket\s*\(/ },
      { name: 'new EventSource(', re: /\bnew\s+EventSource\s*\(/ },
      // Dynamic import: `import(` as a call expression. Distinguished from the
      // static `import x from ...` form by the open-paren.
      { name: 'import( (dynamic)', re: /[^.\w]import\s*\(/ },
    ];

    const violations = [];
    for (const abs of walkJsFiles(JS_DIR)) {
      const rel = relative(JS_DIR, abs);
      const lines = readLines(abs);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('// gsd:allow-network')) continue;
        // Skip pure comment lines so documentation never trips the gate.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        for (const { name, re } of patterns) {
          if (re.test(line)) {
            violations.push({ file: norm(rel), lineNo: i + 1, line: trimmed, token: name });
          }
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `T-04 violation: external network primitives found in js/.\n${
        violations.map((v) => `  js/${v.file}:${v.lineNo} [${v.token}]: ${v.line}`).join('\n')
      }\nFix: route through a Phase-8+ adapter, OR tag the line with "// gsd:allow-network" (Phase 1 should have ZERO such tags).`,
    );
  });

  test('no <script src=> in index.html (T-04 + zero-deps invariant for the shell)', () => {
    const html = readFileSync(INDEX_HTML_PATH, 'utf-8');
    // Allow <script type="module" src="./js/..."> (same-origin own code) by
    // requiring the src attribute to be a relative path within ./js/.
    // We catch ANY <script src=...> that points outside ./js/.
    const scriptSrcRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
    let m;
    const violations = [];
    while ((m = scriptSrcRe.exec(html)) !== null) {
      const src = m[1];
      if (!/^\.?\.?\/?js\//.test(src) && !src.startsWith('js/')) {
        violations.push(src);
      }
    }
    assert.equal(
      violations.length,
      0,
      `T-04 violation: <script src> pointing outside ./js/ in index.html: ${violations.join(', ')}`,
    );
  });
});

// -------------------- 3. T-04 clock-seam (new Date() outside clock adapters) --------------------

describe('T-04 clock-seam: `new Date()` literal only allowed in js/adapters/clock-*.js (or with explicit exemption tag)', () => {
  test('no `new Date()` outside clock adapters except lines tagged // gsd:allow-ui-clock', () => {
    const violations = scanForPattern({
      // Match the no-arg constructor call only. `new Date(x)` is allowed
      // everywhere (it's a pure data transform, not a "fetch current time"
      // side effect).
      regex: /\bnew\s+Date\s*\(\s*\)/,
      exemptFiles: CLOCK_ADAPTERS_REL,
      exemptLineMarker: '// gsd:allow-ui-clock',
    });
    assert.equal(
      violations.length,
      0,
      `Clock-seam violation: \`new Date()\` outside js/adapters/clock-*.js without // gsd:allow-ui-clock tag.\n${formatViolations(violations)}\nFix: inject a ClockAdapter, OR tag the line if it's a documented non-domain UI prefill.`,
    );
  });
});

// -------------------- 4. D-07 storage-seam (localStorage outside storage-local.js) --------------------

describe('D-07 storage-seam: `localStorage` only allowed in js/adapters/storage-local.js', () => {
  test('no `localStorage` references outside js/adapters/storage-local.js (unless tagged // gsd:allow-storage-local)', () => {
    // Lines tagged `// gsd:allow-storage-local` are exempt — these are intentional
    // UI-bootstrap reads that are too shallow to route through the full StorageAdapter
    // (e.g. the one-time dismiss flag for the file:// graceful-degradation note).
    // The same exemption-marker pattern is used for `new Date()` (// gsd:allow-ui-clock).
    //
    // Even untagged comments mentioning `localStorage` outside the adapter are flagged —
    // documentation pointing AT the adapter should reference it by file path,
    // not by literal token, to keep the seam invariant trivially greppable.
    const violations = scanForPattern({
      regex: /\blocalStorage\b/,
      exemptFiles: new Set([STORAGE_LOCAL_REL]),
      exemptLineMarker: '// gsd:allow-storage-local',
    });
    assert.equal(
      violations.length,
      0,
      `Storage-seam violation: \`localStorage\` referenced outside js/adapters/storage-local.js without // gsd:allow-storage-local tag.\n${formatViolations(violations)}\nFix: route through a StorageAdapter, OR tag with // gsd:allow-storage-local if it is a documented UI-bootstrap exception.`,
    );
  });
});

// -------------------- 5. T-07 no .innerHTML = with non-empty data --------------------

describe('T-07: no `.innerHTML = ` with non-empty data anywhere in js/', () => {
  test('no `.innerHTML = ` assignments outside literal empty-string in js/', () => {
    // Detect any `.innerHTML =` assignment. We then filter out the explicitly
    // allowed pattern `.innerHTML = ''` / `.innerHTML = ""`. Anything else is
    // a violation — recommend node.replaceChildren() / textContent in the
    // violation message.
    const violations = [];
    for (const abs of walkJsFiles(JS_DIR)) {
      const rel = relative(JS_DIR, abs);
      const lines = readLines(abs);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip pure-comment lines so documentation/discussion of innerHTML
        // (e.g. anti-pattern callouts in plan summaries) doesn't trip the gate.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        // Match an assignment expression .innerHTML = ...
        const m = /\.innerHTML\s*=\s*(.*)/.exec(line);
        if (!m) continue;
        const rhs = m[1].trim();
        // Allow only the literal empty-string assignment.
        if (rhs === '""' || rhs === "''" || rhs === '"";' || rhs === "'';") continue;
        violations.push({ file: norm(rel), lineNo: i + 1, line: trimmed });
      }
    }
    assert.equal(
      violations.length,
      0,
      `T-07 violation: \`.innerHTML = ...\` with non-empty data found in js/.\n${formatViolations(violations)}\nFix: use node.replaceChildren(...) or el.textContent = ... (or el() helper) instead.`,
    );
  });
});

// -------------------- 6. T-01 / Phase 1 adapter file boundary stats --------------------

describe('T-01 / Phase 1 adapter file boundary stats', () => {
  test('after stripping clock-system.js + clock-fixed.js + // gsd:allow-ui-clock lines, no file in js/ uses `new Date()`', () => {
    // Same as assertion 3 — but stated from the positive "boundary" angle so
    // a future reader sees the invariant from both sides.
    const violations = scanForPattern({
      regex: /\bnew\s+Date\s*\(\s*\)/,
      exemptFiles: CLOCK_ADAPTERS_REL,
      exemptLineMarker: '// gsd:allow-ui-clock',
    });
    assert.equal(violations.length, 0, 'adapter file boundary: only clock-*.js + tagged lines contain `new Date()`');
  });

  test('after exempting storage-local.js + // gsd:allow-storage-local lines, no file in js/ uses `localStorage`', () => {
    const violations = scanForPattern({
      regex: /\blocalStorage\b/,
      exemptFiles: new Set([STORAGE_LOCAL_REL]),
      exemptLineMarker: '// gsd:allow-storage-local',
    });
    assert.equal(violations.length, 0, 'adapter file boundary: only storage-local.js + tagged lines reference `localStorage`');
  });
});
