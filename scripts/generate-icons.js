// scripts/generate-icons.js — One-off icon generation helper
// Run this once to generate icons/icon-192.png and icons/icon-512.png, then commit them.
// Do NOT run in CI.
//
// Source: 08-CONTEXT.md D8-10 (icon style: thin stroke-based line art, crescent moon)
//         08-PATTERNS.md §icons/icon-192.png (design reference from index.html favicon)
//         T-08-01-SC: script is dev helper only, never deployed, no npm runtime deps introduced
//
// ICON DESIGN SPEC:
//   Background: rounded-rect fill="#111827" rx proportional to icon size (rx = size * 7/32)
//   Crescent moon: derived from the existing favicon SVG in index.html line 12
//     - Solid filled circle (body):     cx=22/32, cy=10/32, r=5/32  fill="#4f46e5"
//     - Hollow outline circle (shadow): cx=14/32, cy=18/32, r=6/32  fill="none" stroke="#4f46e5" stroke-width=2/32
//   Both circles scaled proportionally to target icon size.
//   This matches the bottom-nav crescent-moon path (js/ui/bottom-nav.js lines 26–30).
//
// APPROACH A: Node.js canvas (if 'canvas' npm package is available as devDependency)
// APPROACH B: Inkscape CLI (if Inkscape is installed)
// APPROACH C: Browser-side canvas snippet (copy/paste into browser DevTools console)
// APPROACH D: Manual PNG export from any vector editor using the SVG below

// ─── SVG SOURCE (copy into a .svg file and export as PNG at 192×192 and 512×512) ─────
const SVG_192 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="42" fill="#111827"/>
  <circle cx="132" cy="60" r="30" fill="#4f46e5"/>
  <circle cx="84" cy="108" r="36" fill="none" stroke="#4f46e5" stroke-width="12"/>
</svg>`;

const SVG_512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#111827"/>
  <circle cx="352" cy="160" r="80" fill="#4f46e5"/>
  <circle cx="224" cy="288" r="96" fill="none" stroke="#4f46e5" stroke-width="32"/>
</svg>`;

// ─── APPROACH A: Node.js canvas (requires: npm install --save-dev canvas) ─────────────
// Uncomment and run if 'canvas' devDependency is available.
/*
import { createCanvas } from 'canvas';
import { JSDOM } from 'jsdom';
import { writeFileSync, mkdirSync } from 'fs';

function renderSvgToCanvas(svgString, size) {
  // canvas package's loadImage accepts SVG data URIs on some versions
  // Alternative: use sharp with SVG input (see APPROACH B)
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  // Draw rounded rect background
  const rx = size * 7 / 32;
  ctx.beginPath();
  ctx.moveTo(rx, 0);
  ctx.lineTo(size - rx, 0);
  ctx.quadraticCurveTo(size, 0, size, rx);
  ctx.lineTo(size, size - rx);
  ctx.quadraticCurveTo(size, size, size - rx, size);
  ctx.lineTo(rx, size);
  ctx.quadraticCurveTo(0, size, 0, size - rx);
  ctx.lineTo(0, rx);
  ctx.quadraticCurveTo(0, 0, rx, 0);
  ctx.closePath();
  ctx.fillStyle = '#111827';
  ctx.fill();
  // Draw filled crescent body
  const scale = size / 32;
  ctx.beginPath();
  ctx.arc(22 * scale, 10 * scale, 5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#4f46e5';
  ctx.fill();
  // Draw hollow shadow circle
  ctx.beginPath();
  ctx.arc(14 * scale, 18 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  return canvas.toBuffer('image/png');
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', renderSvgToCanvas(SVG_192, 192));
writeFileSync('icons/icon-512.png', renderSvgToCanvas(SVG_512, 512));
console.log('icons/icon-192.png and icons/icon-512.png written.');
*/

// ─── APPROACH B: Inkscape CLI ──────────────────────────────────────────────────────────
// If Inkscape is installed (inkscape --version to check):
/*
import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

mkdirSync('icons', { recursive: true });
writeFileSync('/tmp/icon-192.svg', SVG_192);
writeFileSync('/tmp/icon-512.svg', SVG_512);
execSync('inkscape /tmp/icon-192.svg --export-type=png --export-filename=icons/icon-192.png');
execSync('inkscape /tmp/icon-512.svg --export-type=png --export-filename=icons/icon-512.png');
console.log('icons/icon-192.png and icons/icon-512.png written via Inkscape.');
*/

// ─── APPROACH C: Browser DevTools console (no tool required) ──────────────────────────
// Open any browser tab, open DevTools console, paste and run:
/*
(function() {
  function drawIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const scale = size / 32;
    const rx = 7 * scale;
    // Rounded rect
    ctx.beginPath();
    ctx.moveTo(rx, 0); ctx.lineTo(size - rx, 0);
    ctx.quadraticCurveTo(size, 0, size, rx);
    ctx.lineTo(size, size - rx); ctx.quadraticCurveTo(size, size, size - rx, size);
    ctx.lineTo(rx, size); ctx.quadraticCurveTo(0, size, 0, size - rx);
    ctx.lineTo(0, rx); ctx.quadraticCurveTo(0, 0, rx, 0);
    ctx.closePath(); ctx.fillStyle = '#111827'; ctx.fill();
    // Filled circle (crescent body)
    ctx.beginPath(); ctx.arc(22 * scale, 10 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e5'; ctx.fill();
    // Hollow circle (crescent shadow)
    ctx.beginPath(); ctx.arc(14 * scale, 18 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2 * scale; ctx.stroke();
    return canvas.toDataURL('image/png');
  }
  // Download icon-192.png
  const a192 = document.createElement('a');
  a192.href = drawIcon(192); a192.download = 'icon-192.png'; a192.click();
  // Download icon-512.png
  setTimeout(() => {
    const a512 = document.createElement('a');
    a512.href = drawIcon(512); a512.download = 'icon-512.png'; a512.click();
  }, 500);
})();
*/

// ─── APPROACH D: Manual export ─────────────────────────────────────────────────────────
// Copy SVG_192 or SVG_512 above into a .svg file.
// Open in Figma, Inkscape, Affinity Designer, or any vector editor.
// Export as PNG at the native size (192 or 512).
// Save to icons/icon-192.png and icons/icon-512.png respectively.

// Once PNGs are generated by any approach, commit them:
//   git add icons/icon-192.png icons/icon-512.png
//   git commit -m "feat(08-01): add PWA icons 192x192 and 512x512"

console.log('generate-icons.js: review the APPROACH comments above to generate the PNGs.');
console.log('SVG source for 192x192:');
console.log(SVG_192);
console.log('SVG source for 512x512:');
console.log(SVG_512);
