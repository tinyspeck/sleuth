# Testing & Validating Changes

How to validate a change to Sleuth before opening a PR: fast automated checks
first, then — when a change affects what the user sees — a GUI screenshot of the
real app.

## 1. Fast checks (run these on every change)

```sh
yarn run typecheck   # tsgo -p tsconfig.json --noEmit
yarn run lint        # oxlint + oxfmt --check
yarn test            # vitest (add `run` for one-shot: yarn vitest run)
```

Prefer these over `yarn package` / `yarn make` while iterating — they are far
faster and catch most problems.

### Unit tests (Vitest)

- Tests live under `test/`, mirroring `src/` (e.g. `src/utils/foo.ts` →
  `test/utils/foo.test.ts`). Config: `vitest.config.js` (jsdom env, globals on).
- Run a single file: `yarn vitest run test/utils/foo.test.ts`.
- Static fixtures for log-parsing tests live in `test/static/`. **Do not edit a
  shared fixture** that other tests assert entry counts against — add a new
  dedicated fixture instead.
- Prefer testing pure logic directly. If a helper is currently module-private
  but worth testing, export it rather than reaching through the UI.
- When you add a field to a widely-constructed type (e.g. `ProcessedLogFile`),
  `typecheck` will flag every fixture/mock that now needs it (`__mocks__/`,
  `test/**`, `test/bench/**`). Update them all — that is expected, not scope creep.

## 2. GUI screenshot validation (for user-visible changes)

Automated tests confirm logic; they do not confirm the change _renders_. For
anything that changes the dashboard, sidebar, log table, or other UI, capture a
screenshot of the real app showing the change.

> Do this on the **host**, not in a VM. Sleuth isn't installed in the QA Tart
> VMs, and in-VM screen capture hits a Screen Recording TCC wall that needs a
> one-time human click. The host already has Screen Recording granted.

### 2a. Synthesize an input bundle

Sleuth renders nothing without a log bundle. Create a directory (Sleuth opens a
directory of log files, not just a `.zip`) containing just the files your change
reads. Minimum for a dashboard change:

- `environment.json` — desktop `appVersion`, `platform`, `distribution`, etc.
- `root-state.json` — persisted Redux state (settings, `webapp.teams`, …).
- A log file named so `getTypeForFile` routes it correctly, e.g.
  `app.slack.com-<ts>.log` → webapp/console, `browser.log` → browser,
  `webapp-service-worker-console.log` → service worker.

Craft the file contents to exercise your specific code path (e.g. multiple
gantry `gantry-v2-shared.<sha>.min.js?cacheKey=gantry-<ts>` lines across
different timestamps to trigger webapp-build drift detection).

### 2b. Package the app (avoid the dev server for screenshots)

```sh
yarn package   # outputs out/Sleuth-darwin-arm64/Sleuth.app
```

Use the **packaged** app for screenshots, not `yarn start`. The forge dev server
is unstable for automation: a boot-time `window.Sleuth.platform` timing error,
auto-opening DevTools as a second window that confuses "front window" scripting,
and hot-reload restarts. The packaged app is a clean single window.

### 2c. Launch, navigate, and capture — all in ONE shell invocation

The launched app is a background child of the shell; it is reaped when the shell
call returns. So the entire sequence — launch → load bundle → navigate →
`screencapture` — must run in a **single** command. Backgrounding with `&` does
**not** survive across separate calls.

```sh
APP="out/Sleuth-darwin-arm64/Sleuth.app/Contents/MacOS/Sleuth"
pkill -9 -f Sleuth 2>/dev/null; sleep 2

"$APP" /tmp/my-bundle >/tmp/sleuth.log 2>&1 &      # bundle path as argv
sleep 12                                            # let it boot + parse
osascript -e 'tell application "Sleuth" to open POSIX file "/tmp/my-bundle"'  # re-open to the running instance
sleep 8
osascript -e 'tell application "Sleuth" to activate'
osascript -e 'tell application "System Events" to tell process "Sleuth" to set position of front window to {100, 80}'
osascript -e 'tell application "System Events" to tell process "Sleuth" to set size of front window to {1500, 900}'
sleep 2
screencapture -x -o /tmp/shot.png
```

Loading on cold start is racy (the welcome/suggestions screen competes with the
argv open). Passing the bundle as argv **and** re-sending an `open` Apple event
to the now-running single instance is the reliable combination. Pin the window
position/size so click coordinates are stable.

### 2d. Clicking UI elements

Electron's renderer is a single opaque `AXWebArea`, so `System Events` cannot
enumerate in-page buttons — UI scripting by element title mostly fails. Drive
clicks by **pixel coordinate** with `cliclick` (`brew install cliclick`),
reading coordinates off a screenshot:

```sh
cliclick "c:270,145"   # e.g. the "State" tab to open the dashboard
```

On a 1x display, `screencapture` pixels ≈ `cliclick` points. On a Retina
display they differ by the backing scale — check
`system_profiler SPDisplaysDataType` and divide accordingly.

Crop/zoom a region to read labels or verify a detail:

```sh
python3 - <<'PY'
from PIL import Image
Image.open('/tmp/shot.png').crop((475,185,730,340)).save('/tmp/crop.png')
PY
```

### 2e. Attach the screenshot to the PR

Include the final screenshot in the PR description showing the change rendered.
State what bundle you used and what the image demonstrates.

## 3. Known automation limitations on the host

- **CDP won't bind.** `--remote-debugging-port` does not open a usable endpoint
  on this Electron build (dev or packaged), so driving the renderer over the
  Chrome DevTools Protocol is not available. Use `cliclick` instead.
- **Accessibility (TCC) is per-binary.** UI scripting needs the launching binary
  granted Accessibility. A freshly packaged `Sleuth.app` is a new binary and may
  not be pre-approved; coordinate-based `cliclick` avoids most element-level
  scripting but window move/resize via `System Events` still needs the grant.
- **The dev server is not automation-friendly** — see 2b. Package for screenshots.

## 4. Cleanup

```sh
pkill -9 -f "Sleuth.app/Contents/MacOS/Sleuth"; pkill -9 -f electron-forge
rm -rf /tmp/my-bundle /tmp/shot.png /tmp/sleuth.log
```

`out/` and `.vite/` are gitignored, so packaging artifacts never leak into a
commit — but you can delete `out/` to reclaim disk.
