# Nexus — New Tab Workspace

An experimental, local-first browser extension that turns the New Tab page into a small desktop environment.

## Current prototype

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
