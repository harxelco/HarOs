# QA report (this pass: Part 1 theming core only)
Run: `node tests/theme.test.js`. Result: 36 passed, 0 failed (WCAG AA 4.5:1 for text, muted text, accent, text-on-accent and status tags across light, dark, custom light, custom dark, all 8 presets, plus the warn-and-fix flow). The first runs found failures in the original "ok" (green) and "warn" (amber) tag colours at 4.41:1; both darkened and re-run.
Not run: jsdom smoke test, viewport/overflow sweeps (320 to 1920px), browser visual checks. `styles.css` still contains ~10 hard-coded `#fff` values, so some components may not fully follow dark mode yet.
Not built: Settings > Appearance page (theme lives in a top-bar popover), Parts 2 and 3 (A to R), PWA, README feature docs, CHANGELOG.
