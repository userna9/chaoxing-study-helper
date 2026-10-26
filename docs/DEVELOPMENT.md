# Development

## Commands

```sh
npm ci --ignore-scripts
npm run build
npm run build:check
npm test
npm run check:package
```

The build uses Node.js built-ins and does not fetch reference scripts or depend on a desktop path. `package.json` is the version source. `build:check` compares committed `dist/` with the assembled modules and fails if they diverge.

`npm test` launches isolated Node.js processes. It runs from the project root even when the test runner is invoked by absolute path, and writes ignored diagnostics to `reports/test-results.json`.

## Module map

| File | Responsibility |
| --- | --- |
| `src/progress-media.js` | Userscript metadata, task parameters, playback and advanced diagnostics |
| `src/background-module.js` | Scoped background playback events and cleanup |
| `src/quiz-module.js` | Question parsing, answer matching, platform selection and submit confirmation |
| `src/ai-module.js` | Connection persistence, request adapter and answer validation |
| `src/font-module.js` | Embedded font Unicode coverage and verified glyph identities |
| `src/font-image-module.js` | Question-only rendering for opt-in visual fallback |
| `src/flow-module.js` | Course coordinator, completion verification and chapter navigation |
| `src/quiz-auto.js` | Detection debounce, preference tracking and resuming after configuration changes |
| `src/vendor/ocs-font-helpers.js` | Licensed OCS raster recognition helpers |

The build inserts modules at explicit markers, replaces `__VERSION__`, and generates a single IIFE-based `.user.js`. The original metadata name and namespace are intentional storage identities. No `@updateURL` or `@downloadURL` is set because each uploader must choose an actual repository and release policy first.

## Release

Update the version and changelog, run `npm run check`, then attach `dist/chaoxing-study-helper.user.js` to a GitHub Release if desired. Keep installation instructions tied to the actual uploaded repository. Do not publish local API settings, browser exports or private course recordings.

The CI workflow follows the official [checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node) action interfaces. It uses read-only repository permissions and does not publish releases.
