# CLAUDE.md

This document helps Claude understand the Sleuth repo structure and common development patterns.

## Project Overview

Sleuth is an Electron-based Slack Log Viewer application built with React, TypeScript, and MobX for state management. It processes various types of log files (browser, webapp, mobile, installer, etc.) and provides a comprehensive UI for viewing, filtering, and analyzing log data.

## Development Commands

IMPORTANT: Never attempt to run `npm`, instead always run the equivalent `yarn` command

### Core Commands

- `yarn install` - Install dependencies
- `yarn start` - Start development build with Electron
- `yarn test` - Run tests with Vitest
- `yarn run tsc` - TypeScript type checking
- `yarn run lint` - Run linting (oxlint and oxfmt)
- `yarn run lint:fix` - Fix linting issues automatically

### Build Commands

Note that you should avoid running these commands as they are slow. Instead prefer running the above Core Commands to validate changes rapidly.

- `yarn run package` - Package the app for current platform
- `yarn run make` - Create distributable for current platform
- `yarn run publish` - Publish to configured distributors

### Utility Commands

- `yarn run catapult:update` - Update the catapult git submodule

## Architecture

### Electron Architecture

The app follows standard Electron patterns with three main processes:

- **Main Process** (`src/main/index.ts`): Application lifecycle, window management, IPC handling, file system operations
- **Renderer Process** (`src/renderer/renderer.ts`): React UI rendering
- **Preload Script** (`src/preload/preload.ts`): Secure bridge exposing `window.Sleuth` API to renderer

### Key Components

#### State Management

- **SleuthState** (`src/renderer/state/sleuth.ts`): Main MobX store managing log files, selected entries, filters, bookmarks, and UI state
- Uses MobX observables with React integration via `mobx-react`

#### Log Processing

- **Processor** (`src/renderer/processor.ts`): Core log file parsing and processing logic
- Handles multiple log types: browser, webapp, mobile, installer, chromium, netlog, trace, state
- Converts raw log files into structured `LogEntry` objects with timestamps, levels, and metadata

#### UI Structure

- **App** (`src/renderer/components/app.tsx`): Root component
- **AppCore** (`src/renderer/components/app-core.tsx`): Main application layout
- **LogTable** (`src/renderer/components/log-table.tsx`): Virtualized log entry display
- **Sidebar** (`src/renderer/components/sidebar/`): File tree, bookmarks, and navigation
- **Preferences** (`src/renderer/components/preferences/`): Settings and configuration

#### Key Interfaces

- **LogEntry** (`src/interfaces.ts`): Core data structure for log entries
- **UnzippedFile/ProcessedLogFile/MergedLogFile**: File handling abstractions
- **LogType** enum: Defines supported log file types

### IPC Communication

- **IpcEvents** (`src/ipc-events.ts`): Defines all IPC channel constants
- **IPC Manager** (`src/main/ipc.ts`): Handles main process IPC routing
- **SleuthAPI** (preload): Exposed renderer API with type safety

### Zip Bundle Processing Pipeline

The core flow for processing log bundles:

1. **Reception**: Files enter via drag-drop (`app.tsx`), OS file open (`app.on('open-file')` in `index.ts`), or IPC. All paths call `window.Sleuth.openFile(url)`.
2. **Unzipping** (`src/main/unzip.ts`): `Unzipper` class uses `yauzl` (lazy mode) to extract to a temp directory, returning `UnzippedFile[]`. System files filtered by `src/utils/should-ignore-file.ts`.
3. **Type categorization** (`src/utils/get-file-types.ts`): `getTypesForFiles()` classifies each file by filename pattern into `LogType` (BROWSER, WEBAPP, NETLOG, INSTALLER, MOBILE, CHROMIUM, STATE, TRACE, UNKNOWN).
4. **Routing** (`app-core.tsx`): Files split into raw files (STATE, NETLOG, TRACE — displayed as-is) and processable files (BROWSER, WEBAPP, INSTALLER, MOBILE, CHROMIUM — parsed line-by-line).
5. **State files read first**: `log-context.json` provides timezone info used during log parsing.
6. **Line-by-line parsing** (`src/main/filesystem/read-file.ts`): `readLogFile()` streams each file, applying type-specific regex matchers (e.g., `matchLineElectron`, `matchLineWebApp`). Each matched line becomes a `LogEntry` with timestamp, level, message, and metadata. Repeated consecutive lines are collapsed.
7. **Merging & sorting** (`src/renderer/processor.ts`): `mergeLogFiles()` combines entries from multiple files of the same type using a synchronous k-way merge (sorted chronologically). Produces merged views for Browser, Webapp, and combined ALL.
8. **Display**: Results stored in MobX `SleuthState`, populating Sidebar (file tree), LogTable (virtualized entries), and detail panels.

Key file dispatch: `src/main/filesystem/open-file.ts` routes between `openZip()`, `openDirectory()`, and `openSingleFile()`.

### Specialized Features

- **Trace Analysis**: Chrome DevTools and Perfetto trace file support
- **State Inspection**: Redux state visualization
- **NetLog Viewing**: Network log analysis
- **Bookmarking**: Save and restore specific log entries
- **Log Merging**: Combine multiple log files chronologically

## Testing

- Uses Vitest with jsdom environment
- Test files: `test/**/*.test.[jt]s?(x)`
- Benchmark files: `test/bench/*.bench.ts` — run with `yarn vitest bench`
  - Real-log benchmarks require `SLEUTH_BENCH_LOGS=/path/to/extracted/logs`
- Setup: `test/vitest-setup.js`
- Global test utilities available

## Code Conventions

### Oxlint Rules

- Linting is handled by [oxlint](https://oxc.rs/docs/guide/usage/linter/) (configured in `.oxlintrc.json`)
- Strict separation: renderer code cannot import Node.js modules (fs, path, etc.)
- Uses `typescript` and `react` oxlint plugins for TypeScript and React-specific rules
- Unused vars prefixed with `_` are ignored
- Disable comments use `// oxlint-disable-next-line` format

### File Organization

- `src/main/`: Main process Electron code
- `src/renderer/`: React renderer code
- `src/preload/`: Preload script for secure IPC
- `src/utils/`: Shared utilities (renderer-safe only)
- `src/interfaces.ts`: Shared TypeScript interfaces

### State Patterns

- Use MobX `@observable` and `@action` decorators
- State mutations only through actions
- Computed values for derived data
- Autorun for side effects

## Development Notes

IMPORTANT: never disable a lint rule or add @ts-ignore unless explicitly asked to do so by the user.
If you are unable to solve a problem without disabling a lint rule, stop and ask the user for
guidance first.

**CRITICAL: NEVER use --no-verify flag with git commands.** This bypasses pre-commit hooks that enforce code quality and can introduce broken code into the repository. Always fix the underlying issues that cause hooks to fail instead of bypassing them. If a hook is failing, address the specific linting, formatting, or test failures it identifies.

### Security

- Context isolation enabled - use `contextBridge` in preload
- Renderer process has restricted Node.js access
- File operations must go through IPC to main process

### Performance

- Log table uses `react-virtualized` for large datasets
- Log processing happens in chunks to avoid blocking UI
- Per-type file processing runs in parallel (`Promise.allSettled` in `app-core.tsx`)
- `mergeLogFiles` uses a synchronous k-way merge (O(n·k), avoids concat+sort)
- Timestamp parsing uses `toTZMillis()` with a cached TZ offset per calendar date, avoiding expensive `TZDate` construction (~7µs) on every line — the single biggest bottleneck in log processing
- The main processing hot path is in `src/main/filesystem/read-file.ts`: regex matching → timestamp parsing → LogEntry creation

### Platform Support

- Cross-platform Electron app (macOS, Windows, Linux)
- Platform-specific code paths handled via `process.platform`
