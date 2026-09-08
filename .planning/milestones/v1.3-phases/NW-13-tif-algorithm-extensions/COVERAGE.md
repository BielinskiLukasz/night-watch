# Phase NW-13 API Coverage

No external API integration: pure algorithm extension of forecast-tif.js

Phase NW-13 (TIF Algorithm Extensions) modifies only internal JavaScript modules:
- `js/lib/forecast-tif.js` — algorithm enhancements
- `js/lib/db-shape.js` — additive settings migration
- `js/lib/settings-validate.js` — validation rules
- `js/ui/settings-modal.js` — settings UI
- `index.html` — HTML input element
- `js/ui/today-screen.js` — call-site update

No outbound HTTP calls, no third-party SDKs, no browser APIs beyond localStorage
(already present). All data flows are internal to the browser app.
