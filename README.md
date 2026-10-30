# Nexus — New Tab Workspace

**Current version: 0.4.0** · See [CHANGELOG.md](./CHANGELOG.md) for release notes.

An experimental, local-first browser extension that turns the New Tab page into a small desktop environment.

## Current prototype

- Release notes modal accessible from the launcher

- React + TypeScript + Vite
- Manifest V3 New Tab override
- Floating, draggable and resizable app windows
- Dock, desktop shortcuts, quick launcher (`Ctrl/Cmd + K`), and desktop context menu
- Embedded web window with external-tab fallback
- YouTube's official privacy-enhanced embed player
- Local scratchpad and saved links
- Local settings and three wallpaper presets

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Develop

```bash
npm install
npm run dev
npm run build
npm test
```

`npm run dev` starts both the Vite UI and the Nexus API server. The UI runs on
`http://localhost:5173` and the API runs on `http://localhost:3001`.

Optional server-side integrations read credentials from a local `.env` file:

```bash
cp .env.example .env
```

- `YOUTUBE_API_KEY` enables video search in the Nexus YouTube app.
- `GEMINI_API_KEY` enables AI search overviews.
- `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_CX` enable Google Custom Search results.

Keep `.env` local and never commit its credentials.

The Vite dev server is for UI iteration. Browser extension APIs and New Tab replacement should be tested using the production build.

## Load in Firefox

1. Run `npm install && npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…**.
4. Select `dist/manifest.json`.
5. Open a new tab.

Temporary add-ons are removed when Firefox restarts. For a persistent installation, package/sign the extension using the appropriate Firefox distribution process.

## Load in Chromium

The manifest uses `chrome_url_overrides` and the common Manifest V3 subset. Build, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

## Notes and limitations

- A normal webpage cannot override the browser's New Tab page; use the extension build for that behavior.
- Websites may block iframe embedding. Nexus cannot override `X-Frame-Options` or CSP `frame-ancestors`; use the external-tab action when necessary.
- The web app window is a lightweight iframe host, not a full independent browser engine.
- App data currently uses browser-profile local storage for the scratchpad and saved links. A later milestone can move structured collections to IndexedDB with migrations/export.
- This is an early prototype. Do not treat iframe content as trusted or grant it extension privileges.

## Phase 1 reliability updates

This build focuses on desktop/runtime reliability before adding new apps:

- Floating windows are clamped back into the visible viewport when the viewport is resized.
- Window dragging/resizing keeps stable pointer listeners, handles pointer cancellation, and uses the latest drag preview when committing bounds.
- Session-storage restrictions no longer prevent the lock/unlock view from rendering.
- Sandboxed widgets can read their persisted state with `NEXUS.getState()` and save updates with `NEXUS.setState(value)`. State is restored when the widget document is recreated.
- Widget `nexus:ready` and `nexus:time` messages are exposed as window events for widget scripts.
- Widget URL requests are validated and allow only `http:` and `https:` URLs; state payloads have a size guard.

Build the extension after installing dependencies so `dist/` is generated from the updated source:

```bash
npm install
npm run build
npm test
```


## v0.5.0 highlights

- Twelve built-in wallpapers, selectable from the desktop context menu and system tray/calendar menu.
- Saved links appear in the app launcher and refresh immediately after editing in Saved links.
- Widgets receive theme updates and expose `NEXUS.getTheme()`, `NEXUS.setTheme(theme)`, `NEXUS.getLocal(key)`, `NEXUS.setLocal(key, value)`, and `NEXUS.removeLocal(key)`. These local values are stored by the host per widget ID.
- Minimized windows remain in the dock and restore when selected.
- Removed the desktop quote and launcher local-workspace footer text.


## v0.7.0

This release reorganizes Settings into a sidebar with focused sections, restores rotating desktop messages with updated developer-oriented defaults, and adds a smooth wallpaper transition. Widget internals are unchanged in this phase.


## v0.7.0 — Widget Studio

Widget Studio is now a standalone app. Widget scripts can use `NEXUS.getTheme()`, `NEXUS.setTheme("dark")`, `NEXUS.getLocal(key)`, `NEXUS.getAllLocal()`, `NEXUS.setLocal(key, value)`, and `NEXUS.removeLocal(key)`. Local values are namespaced per widget and persisted by the host. See `CHANGELOG.md` for version-by-version release notes.
