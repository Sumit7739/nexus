# Nexus Changelog

All notable user-facing changes are recorded by release. Versions increment by `0.1` (`0.8.0` → `0.9.0` → `1.0.0` → `1.1.0` → `1.2.0` → `1.3.0` → `1.4.0` → `1.5.0` → `1.6.0` → `1.7.0` → `1.8.0` → `1.9.0` → `2.0.0` → `2.1.0`) on every major feature milestone and stay synchronized with `src/data/version.ts`, `package.json`, and `public/manifest.json`.

## [2.1.0] — Dayline Daily Time-Blocker & Auto-Journal

### Added
- **Dayline**: plan the current day on an hour-by-hour timeline by dragging open Scratchpad checklist tasks into time blocks.
- **Scratchpad completion sync**: clicking a planned block checks its source task off in Scratchpad.
- **Team clocks and weather**: add IANA timezone clocks and optionally look up current weather for a saved city through Open-Meteo.
- **Workspace Backup parity**: Dayline plans, timezone preferences, and weather location are included in JSON export/import.
- **Dayline editing**: time blocks now accept native Scratchpad drags, plain text drops, paste, and direct inline editing while keeping their Scratchpad links.
- **Widget API parity**: added the `NEXUS.dayline` bridge and API Reference entries for reading, adding, editing, and completing today’s time blocks from custom widgets.

## [2.0.0] — AI Widget Crafter, Puter.js Integration & NEXUS.notes/shortcuts Bridge

### Added
- **AI Widget Crafter**: describe a widget in plain English and generate editable HTML, CSS, JavaScript, JSON, name, and dimensions directly into Widget Studio’s Workbench.
- **Puter.js AI bridge**: generation runs in the browser through the official Puter.js client script, with no Nexus or Gemini API key exposed to the widget crafter.
- **NEXUS.notes and NEXUS.shortcuts**: custom widgets can read Scratchpad notes, toggle real Markdown checklist lines, list validated Saved Links, and launch a Saved Link through the desktop host.

### Updated
- **Widget API Reference**: added asynchronous examples for the Scratchpad and Saved Links bridges.
- **Widget Studio**: generated widgets become normal editable Nexus widgets and the response is validated before insertion.
- **Four-pane conversational Workbench**: reorganized Widget Studio into a file tree, editor, live preview, and chat pane with per-widget persisted conversation history.
- **API-aware theme contract**: the crafter receives the Widget API Reference and generated widgets are required to react to Nexus light/dark theme changes.
- **Library & API redesign**: added an installed-widget dashboard, workspace stats, template cards, API contract callouts, complete category filters, and responsive API cards.
- **Expanded API Reference**: documented widget data/state, host time, notifications, theme contract, Stash controls, and all asynchronous Scratchpad/Saved Links methods.
- **Preview and layout polish**: Library cards now show live sandboxed previews, both pages use centered responsive grids, and the fixed Now Playing template action was removed from the API header.

## [1.9.0] — Stash Edge Shelf — Universal Drop Zone & Snippet Tray

### Added
- **Stash Edge Shelf (`nexus.stash.v1`)**: open the persistent right-edge shelf from the Dock, edge tab, `Alt+S`, Spotlight, or a custom widget. Paste or drag text, code, colors, calculations, URLs, and YouTube links into the tray.
- **Browser, Scratchpad & Widget integrations**: send selected text to Stash from either app, or use `window.NEXUS.stash(content)` and `window.NEXUS.openStash()` in Widget Studio.
- **One-click card actions**: create a Scratchpad note, save HTTP links as shortcuts, queue YouTube videos in Music, open links, copy content, remove cards, filter by type, or clear the shelf.

### Updated
- **Workspace Backup parity**: JSON export, import validation, and factory reset now persist and restore Stash cards.
- **Shelf interaction isolation**: Stash controls no longer trigger the desktop global-dismiss handler while the shelf is open.

## [1.8.0] — Focus Rituals Tied to Scratchpad Tasks, Dock Countdown & Window Decluttering

### Added
- **Focus Rituals Engine (`nexus.focus.v1`)**: lock a Pomodoro (`25m`), Deep Block (`50m`), Sprint (`15m`), or custom countdown directly onto any unchecked `- [ ]` task across Scratchpad notes (or write a freeform intention), pair procedural Soundscape atmospheres (**Rainy Study**, **Deep Brown**, **Cabin Hearth**) or **Lofi Radio**, and log completed daily focus blocks with gentle Web Audio chime completion.
- **Dock Live Countdown & Reversible Window Decluttering**: added a calm Dock Focus trigger displaying live `MM:SS` (`tabular-nums`) progress, 1-click **Check off task in Scratchpad** (`- [x]`), `+5m` timer extension, restorative breaks, and optional **Declutter background windows** that minimizes non-Scratchpad apps during focus and restores them automatically on completion.
- **Inline Scratchpad & Spotlight Focus Workflows**: added hover/inline **Focus** buttons on unchecked checklist rows in Scratchpad Preview/Split, `Focus next task` in the formatting bar, `Focus 25m` in the text-selection bar, an active Focus banner inside Scratchpad, and Spotlight `Focus on: <Task>` & `focus <mins>m <intention>` commands.

### Updated
- **Desktop & App Context Menus**: added quick **Focus ritual** triggers to Desktop, App Launcher, Desktop Icon, and Dock menus.
- **Workspace Backup parity**: JSON export, import validation, and factory reset now persist and restore `focusState` preferences and completed session logs.

## [1.7.0] — Procedural Soundscape Mixer, Saved Atmospheres & Widget Soundscape API

### Added
- **Procedural Web Audio Soundscape Engine (`nexus.soundscape.v1`)**: zero-dependency stereo-crossfaded synthesis for **Soft Rain**, **Vinyl Dust**, **Fireplace**, **Deep Brown**, **Pines & Wind**, and **Night Crickets** that layers cleanly underneath Music streams or plays solo with zero network lag.
- **Music Soundscapes Studio & Saved Mixes**: dedicated `Soundscapes` tab in Music with 4 built-in 1-click atmospheres (**Rainy Study**, **Cabin Hearth**, **Deep Focus Shield**, **Midnight Porch**), custom named mix creation, master ambience volume slider, and 6 individual channel faders.
- **Now Playing Quick Mixer, Spotlight & Widget Studio**: added a floating Ambient Layers quick-mixer popover to the desktop Now Playing bar (plus standalone ambient mini-player support), Spotlight Soundscape presets & controls, and a new **Ambient Soundscape** Widget Studio template + API Reference entry.

### Updated
- **Widget Music Bridge (`window.NEXUS.music`)**: exposed live `state.soundscape` telemetry and `setSoundscape()`, `applySoundscapePreset()`, `toggleSoundscape()`, `setSoundscapeVolume()`, and `clearSoundscape()` methods.
- **Workspace Backup parity**: JSON export, import validation, and factory reset now persist and restore `soundscapeState`.

## [1.6.0] — Desktop Spaces, 1-Click Context Switching & Per-Space Audio/Widget Rules

### Added
- **Desktop Spaces (`nexus.spaces.v1`)**: switch entire workspace contexts in one click, swapping open windows, 50/50 split-screen arrangements, ambient wallpapers, per-space widget visibility, and linked audio rules. Ships with 3 curated starter Spaces — **Deep Work** (clean focus canvas), **Research** (50/50 Browser + Scratchpad split on Glacier), and **Unwind** (Music + Nexus Tube lounge on Dusk linked to Chillhop radio) — expandable up to 6 Spaces.
- **Dock Spaces Switcher & Inline Configuration**: dedicated Spaces trigger on the Dock (`Alt + 1..6` outside text fields, `Ctrl + Alt + 1..6` anywhere) with expandable inline configuration drawers for renaming, 12 wallpaper swatches, linked audio stream/playlist/pause rules, per-space widget toggles, and **Save current windows here**.
- **Settings, Context Menus & Spotlight Integration**: added `Settings → Spaces` management section, 1-click Space buttons in the Desktop right-click menu, **Move to `<Space>`** actions in the Dock right-click menu, and Spotlight Spaces search (`switch-space`, `move-active-window-to-space`, and `space <Name>` / `new space <Name>` creation).

### Updated
- **Live active-space sync & viewport-aware splits**: moving, resizing, snapping, or closing windows and changing wallpapers automatically sync into the active Space, while 50/50 snapped windows recompute bounds dynamically for the current viewport on switch.
- **Workspace Backup parity**: JSON export, import validation, and factory reset now persist and restore `spacesState`.

## [1.5.0] — Widget Studio Music Bridge, Audio API Reference & Now Playing Deck

### Added
- **Live Widget Music Bridge (`window.NEXUS.music` & `'nexus:music'`)**: custom desktop widgets can read live track metadata, cover artwork, playback state, elapsed time, duration, volume, shuffle/repeat modes, liked status, Up Next queue, playlists, and built-in focus streams in real time.
- **Full widget playback & Music app controls**: added `toggle()`, `play(target?)`, `pause()`, `stop()`, `next()`, `prev()`, `seek(seconds)`, `setVolume(0–100)`, `toggleMute()`, `toggleShuffle()`, `cycleRepeat()`, `toggleLike()`, `playStream(indexOrId)`, `playPlaylist(idOrName)`, `enqueue(idOrUrl, title?)`, `search(query)`, and `open(tab?)` to the widget sandbox host bridge.
- **Searchable Music API Reference & Now Playing Deck template**: added 5 copy-and-insert Music API reference entries, interactive category filters and method search in Widget Studio's API Reference tab, and a ready-to-customize **Now Playing Deck** starter widget.

### Updated
- **Single-instance widget app handoff**: calling `NEXUS.music.open()` or `NEXUS.openApp('music')` from a desktop widget focuses an already-open Music window cleanly instead of opening duplicate instances.

## [1.4.0] — Nexus Tube, Persistent Desktop Music, Timestamp Notes & 4-Column Launcher

### Added
- **Persistent desktop Music & floating Now Playing bar**: background audio keeps playing smoothly when the Music window is minimized or closed, with auto-advance on track end, live seek scrubber, volume slider, shuffle, repeat (`Off` / `All` / `One`), Up Next queue reordering, **Liked songs**, custom **Playlists**, and 6 curated 24/7 focus & ambient radio streams playable in one click.
- **Nexus Tube upgrades & Timestamp Notes to Scratchpad**: added **Watch later** library queue, video duration badges, compact view counts, expandable descriptions, one-click **Listen in Music** handoff, and live `[MM:SS]` timestamped note capture directly into Scratchpad.
- **Spotlight, Browser & Menu media integration**: search videos and music directly from Spotlight (`yt <query>`, `music <query>`, `play <query>`, YouTube URLs, transport controls, Watch later, and Liked songs), launch YouTube links from Nexus Browser via inline **Watch in Tube** and **Play Audio** buttons, and trigger media actions from App Launcher, Desktop, and Dock menus.

### Updated
- **4-column App Launcher grid**: widened launcher grid layout to 4 columns with matching keyboard arrow-key navigation and dedicated `.icon-music` light/dark badge tokens.
- **Complete workspace media backup**: Workspace JSON Export, Import, and Factory Reset now include YouTube watch history, Watch later, Music history, Liked songs, and Playlists.

### Fixed
- **YouTube IFrame API handshake & search resilience**: added `origin` handshake and `onStateChange` / `infoDelivery` telemetry for reliable progress and track-end events, plus live web + YouTube oEmbed metadata fallback when `YOUTUBE_API_KEY` is unset.

## [1.3.0] — Desktop Context Menu, Quick Note Creation & Menu Layering Fixes

### Added
- **Desktop right-click quick creation**: create a blank **New note** or **New checklist** directly in Scratchpad, open a **New browser tab** in Nexus Browser, or **Add web shortcut** in one click from anywhere on the desktop.
- **Contextual desktop & window actions**: added **Tile windows side by side** (snaps top two visible windows into a 50/50 split while preserving their natural left/right screen order), **Show desktop** / **Restore windows**, **Manage widgets**, quick **Light / Dark mode** toggle, **Next desktop quote**, **Workspace settings**, and **Lock workspace** (when a passcode is configured).
- **App Launcher, Desktop Icon & Dock menu actions**: added contextual per-app actions (**New note**, **New checklist**, **New search tab**, **Arrange desktop**) across all app menus plus quick **New note**, **Theme**, **Settings**, and **Lock** controls in the App Launcher footer.

### Fixed
- **App Launcher dropdown stacking & alignment**: elevated active `.l-row.is-open` stacking context above sibling grid/list tiles so `.l-pin-menu` never renders behind neighboring app icons, with column-aware horizontal alignment and row-aware vertical flipping.
- **Global modal & context-menu z-index hierarchy**: moved Desktop and Desktop Icon context menus out of `.desktop-canvas` overflow clipping, added live viewport-boundary clamping, and unified z-index ordering across windows, dock, system tray, context menus, App Launcher, Spotlight, Changelog, and Passcode modals.

## [1.2.0] — Context-Aware Selection Actions Across Browser & Scratchpad

### Added
- **Browser → Scratchpad selection actions**: highlight any paragraph, AI Overview synthesis, or live search result snippet in Nexus Browser to send it to your active Scratchpad note with automatic source attribution, create a new note from the selection, or capture it directly as an interactive `- [ ]` checklist task.
- **Scratchpad → Browser research handoff**: highlight text in Scratchpad (across **Write**, **Split**, and **Preview** modes) and click **Research in Browser** to launch a Gemini AI + Live Web Search tab in Nexus Browser, or open selected URLs directly.
- **Turn selected text into a task**: convert single lines, bullet lists, or multi-line selections in Scratchpad into `- [ ]` checklist items in-place, or extract any passage into a standalone note.
- One-click **Save to Scratchpad** action on Gemini AI Overview cards and automatic cross-window opening/focusing between Browser and Scratchpad.

### Updated
- Scratchpad's `Task` formatting toolbar button now converts multi-line selections into checklist items in one click.

## [1.1.0] — Spotlight Command Palette & Instant Workspace Search

### Added
- Global **Spotlight Command Palette** (`Cmd/Ctrl + K`, Dock search trigger, and Desktop right-click menu) with instant fuzzy/keyword search and `Tab`-switchable `All` / `Apps` / `Notes` / `Windows` / `Commands` filters.
- Full-text **Scratchpad note search** indexing titles and Markdown body snippets, one-stroke jump to any note, and instant `Create Scratchpad Note` / `New Checklist Note` actions.
- Safe zero-`eval` **instant calculator** supporting arithmetic, parentheses, exponents, and percentage phrases (`145 * 12`, `(1920 - 240) / 2`, `24% of 350`, `15% off 200`) with `Enter` to copy.
- Direct **Nexus Browser handoff** to open typed URLs or launch Gemini AI + Live Web Search queries straight from Spotlight.

### Updated
- Spotlight indexes open windows, active-window split-screen tiling (`Left`, `Right`, `Maximize`, `Restore`), theme switching, all 12 ambient wallpapers with live color swatches, workspace JSON backup export, and lock screen controls.

## [1.0.0] — Upgraded Multi-Note Scratchpad, Checklists & Markdown

### Added
- Multi-note Scratchpad sidebar with instant note search, `All` / `Pinned` / `Checklists` filters, note pinning, and two-step delete protection.
- **Write**, **Split**, and **Preview** Markdown modes with interactive checklists (`- [ ]` / `- [x]`) that toggle directly when clicked in Preview or Split view.
- Markdown formatting toolbar (`Task`, `Heading`, `Bold`, `Italic`, `Code`, `Quote`, `Divider`, `Clear completed`), smart `Enter` list/task continuation, `Tab` indentation, and one-click `.md` file download.

### Updated
- Existing single-note Scratchpad content (`nexus.scratchpad.v1`) migrates automatically into the multi-note store without data loss.
- Workspace JSON backups now export and restore the complete multi-note Scratchpad library alongside legacy compatibility.

## [0.9.0] — Window Snapping, Split-Screen Tiling & Session Restore

### Added
- Drag-to-edge window snapping: drag any window title bar to the left, right, or top screen edge with a live translucent snap-zone preview.
- Title bar quick-tile buttons (Left Half, Right Half, Maximize / Restore) and global keyboard shortcuts (`Alt + [`, `Alt + ]`, `Alt + ↑`, `Alt + ↓`).
- Opt-in **Restore open windows on startup** setting in `Settings → Desktop` to persist open windows, split-screen tiles, and focus state across new tabs.

### Updated
- Dragging a maximized or split-snapped window smoothly detaches it back to its original floating bounds anchored under the pointer.
- Snapped 50/50 split windows automatically recalculate proportional bounds whenever the browser viewport resizes.
- Workspace JSON backups now include the `restoreSession` preference.

## [0.8.0] — Browser, Web Shortcut Apps, Widget Studio Rebuild & PRD Completion

### Added
- Multi-tab Nexus Browser with Gemini AI + Live Web Search, synced Bookmarks Bar, search engine switcher, and external tab launch.
- Saved shortcuts act as first-class Nexus apps across the Launcher, Dock, and Desktop with progressive multi-source favicon loading.
- Rebuilt split-pane Widget Studio IDE with 7 ready-to-use templates, live viewport presets, console/storage inspector, and interactive API insertion.
- Passcode verification & removal flow with transparent local threat-model guidance.
- Versioned Workspace Backup (Export / Import JSON) and two-step factory reset recovery in Settings.
- Direct desktop dragging and 12px grid resizing for custom widgets in Arrange Mode (`F2`).
- Keyboard arrow navigation (`↑`/`↓`/`←`/`→`, `Home`, `End`, `Enter`) and modal focus restoration in the App Launcher.
- Master toggle to hide or restore default rotating desktop messages.
- Centralized single-source-of-truth version & changelog registry (`src/data/version.ts`) powering all UI surfaces and workspace backups.

### Updated
- Splash screen skips artificial waits on fast session reloads and honors `prefers-reduced-motion`.
- Settings navigation uses unified vector icons across all sections.
- Viewport resize clamping keeps desktop icons and desktop widgets reachable alongside open windows.

### Fixed
- Resolved layout and spacing inconsistencies across Scratchpad, Saved Links, Settings, and Widget Studio.

## [0.7.0] — Widget Studio as a first-class app

### Added
- Widget Studio is now a standalone app in the Nexus launcher and app registry, with a dedicated workspace layout and widget library sidebar.
- Widget API exposes the current theme through `NEXUS.getTheme()` and lets trusted host-mediated requests switch the workspace theme through `NEXUS.setTheme('light' | 'dark')`.
- Widget local storage API: `NEXUS.getLocal(key)`, `NEXUS.getAllLocal()`, `NEXUS.setLocal(key, value)`, and `NEXUS.removeLocal(key)`. Values are namespaced per widget and sent back to the iframe after updates.
- Initial theme and saved local values are available as the widget runtime is created, rather than requiring the widget to guess defaults.

### Updated
- Settings no longer contains the Widget Studio editor; widget creation and management live in their own app window.
- Widget editor includes a clearer library sidebar, workspace heading, and API overview.
- Settings dropdowns receive consistent styling for native select controls, focus states, and options where supported by the browser.
- Project and extension version bumped to 0.7.0.

### Fixed / hardened
- Widget-local writes validate serialized size and refresh the in-frame cache after successful writes/removals.
- Local storage reads safely fall back to an empty object if stored data is invalid or unavailable.

### Removed
- Widget Studio section from the Settings sidebar. The feature itself has not been removed.

## [0.6.0] — Settings and desktop polish

### Added
- Settings sidebar with Appearance, Desktop, Desktop Messages, and Privacy sections.
- Rotating desktop messages restored with an editable set of developer/productivity jokes and configurable refresh interval.
- Smooth wallpaper crossfade/soft-zoom transition and reduced-motion handling.

### Updated
- Settings controls grouped by category rather than displayed in one long page.
- Desktop message defaults tuned toward software engineering, product building, scope creep, and dry humor.

### Fixed
- Wallpaper transitions respect the operating system's reduced-motion preference.

### Removed
- Widget Studio was not removed in this release; it remained within Settings until v0.7.0.

## [0.5.0] — Desktop experience

### Added
- Wallpaper controls in desktop and calendar menus, with a larger set of wallpaper palettes.
- Host-mediated widget API foundations for theme requests and namespaced local storage.
- Saved-link shortcuts in the launcher.

### Updated
- Launcher spacing and quick-access layout.
- Minimized-window behavior and dock restoration flow.

### Fixed
- Removed the “Local workspace · No account” launcher footer message.

### Removed
- No functional features intentionally removed.

## [0.4.0] — Desktop UI polish

### Added
- Changelog entry in the app launcher with a dedicated modal.
- Version visibility and grouped release-note sections.

### Updated
- Launcher footer hierarchy and release-version display.

### Fixed / hardened
- Window interactions account for viewport resizing.
- Widget runtime state save/load contract and URL validation foundations.
- Lock-screen session-storage failures are handled more defensively.

### Removed
- No functional features intentionally removed.

## [0.3.x and earlier] — Initial workspace foundation

### Added
- Initial OS-like new-tab workspace, app launcher, dock, floating windows, desktop shortcuts, themes, wallpapers, clock, settings, saved links, scratchpad, and early widget runtime/editor.

### Notes
- Early releases were prototype iterations; the historical summary above captures major product milestones rather than every individual commit.
