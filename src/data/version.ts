/**
 * Single Source of Truth for Nexus version & release history.
 *
 * Versioning policy:
 * - Bump `NEXUS_VERSION` by +0.1 on every major feature update (e.g., 0.8.0 -> 0.9.0 -> 1.0.0).
 * - Prepend a new `ChangelogRelease` entry at index 0 of `CHANGELOG_RELEASES` with matching `version`.
 * - Keep `package.json`, `public/manifest.json`, and `CHANGELOG.md` synchronized with `NEXUS_VERSION`
 *   (enforced automatically by `tests/version.test.ts`).
 */

export const NEXUS_VERSION = '2.1.0';
export const NEXUS_VERSION_TAG = `v${NEXUS_VERSION}`;

export type ChangelogCategory = 'added' | 'updated' | 'fixed' | 'removed';

export interface ChangelogGroup {
  kind: ChangelogCategory;
  label: string;
  items: readonly string[];
}

export interface ChangelogRelease {
  version: string;
  title: string;
  date?: string;
  summary: string;
  groups: readonly ChangelogGroup[];
}

export const CHANGELOG_RELEASES: readonly ChangelogRelease[] = [
  {
    version: '2.1.0',
    title: 'Dayline Daily Time-Blocker & Auto-Journal',
    date: 'October 2026',
    summary:
      'Added a local daily planner that turns Scratchpad checklist tasks into draggable time blocks with timezone clocks, optional weather, and workspace backup support.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Dayline utility app: plan the current day on an hour-by-hour timeline and drag open Scratchpad checklist tasks into time blocks.',
          'Dayline completion sync: clicking a planned block checks its source task off in Scratchpad.',
          'Team clocks and optional Open-Meteo weather lookup with locally persisted location and timezone preferences.',
          'Workspace JSON backup and restore support for Dayline plans and preferences.',
          'Dayline blocks accept Scratchpad drags, plain text drops, paste, and direct inline editing while preserving Scratchpad task links.',
          'Added the NEXUS.dayline widget bridge so custom widgets can read and update today’s planner while syncing new tasks to Scratchpad.',
        ],
      },
    ],
  },
  {
    version: '2.0.0',
    title: 'AI Widget Crafter, Puter.js Integration & NEXUS.notes/shortcuts Bridge',
    date: 'October 2026',
    summary:
      'Added prompt-to-widget generation through Puter.js AI and expanded the sandboxed Widget Studio bridge so custom widgets can work with real Scratchpad tasks and Saved Links.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'AI Widget Crafter: describe a widget in plain English and generate editable HTML, CSS, JavaScript, JSON, name, and dimensions directly into the Workbench.',
          'Puter.js client AI bridge: requests run in the browser without exposing a Nexus or Gemini API key, with strict response validation, size limits, and explicit unavailable-service errors.',
          'NEXUS.notes and NEXUS.shortcuts APIs: custom widgets can read notes, toggle real Markdown checklist lines, list validated Saved Links, and launch a Saved Link through the desktop host.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Widget API Reference now documents the Scratchpad and Saved Links bridges, including their asynchronous iframe-safe usage.',
          'Widget Studio now loads Puter.js from its official browser script and exposes generated widgets as normal editable Nexus widgets.',
          'Widget Studio Workbench is now a four-pane flow: file tree, editor, live preview, and conversational AI crafter with per-widget persisted history.',
          'The crafter includes the documented Widget API Reference in every request and enforces the Nexus light/dark theme contract in generated source.',
          'Expanded the API Reference with core data/state/time/notice methods, complete theme guidance, Stash controls, and the NEXUS.notes/shortcuts async bridges; redesigned Library and API pages with dashboard cards, stats, and contract callouts.',
          'Library cards now render live sandboxed widget previews, while Library and API content use centered responsive grids; removed the fixed Now Playing template action from the API header.',
        ],
      },
    ],
  },
  {
    version: '1.9.0',
    title: 'Stash Edge Shelf — Universal Drop Zone & Snippet Tray',
    date: 'October 2026',
    summary:
      'Added a persistent edge shelf for temporarily collecting snippets, code, colors, calculations, URLs, and YouTube links, with one-click conversion into notes, saved links, Music queue items, or clipboard content.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Stash Edge Shelf (`nexus.stash.v1`): open from the Dock, edge tab, Alt+S, Spotlight, or widgets; paste or drag content into a persistent, filterable tray with automatic content classification.',
          'Stash integrations: send selected text from Browser and Scratchpad, or call `window.NEXUS.stash()` and `window.NEXUS.openStash()` from custom widgets.',
          'One-click card actions: create a Scratchpad note, save HTTP links as shortcuts, queue YouTube videos in Music, open links, copy content, remove cards, or clear the shelf.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Workspace JSON backup export, import validation, and factory reset now persist and restore Stash cards.',
          'Stash shelf interactions are isolated from the desktop global-dismiss handler so buttons, filters, input, and drag/drop remain usable while the shelf is open.',
        ],
      },
    ],
  },
  {
    version: '1.8.0',
    title: 'Focus Rituals Tied to Scratchpad Tasks, Dock Countdown & Window Decluttering',
    date: 'October 2026',
    summary:
      'Connected timed Focus Rituals directly to Scratchpad checklists (`- [ ]`), with a live Dock countdown indicator, 1-click task completion writeback (`- [x]`), atmosphere soundscape pairing, and reversible background window decluttering.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Focus Rituals Engine (`nexus.focus.v1`): pick any unchecked `- [ ]` task across Scratchpad notes or write an intention, choose `15m`, `25m`, `50m`, or custom minutes, pair procedural Soundscapes or Lofi Focus Radio, and track daily completed focus sessions.',
          'Dock Focus Countdown & Popover: calm Dock timer readout (`MM:SS` with `tabular-nums` and status indicator) plus 1-click **Check off task in Scratchpad** (`- [x]`), `+5m` extend, restorative breaks, and optional **Declutter background windows** (minimizes non-Scratchpad apps and restores them on finish).',
          'Scratchpad & Spotlight Integration: inline **Focus** trigger button on every unchecked task row in Scratchpad Preview/Split, `Focus next task` toolbar action, `Focus 25m` text-selection action, live active-focus banner inside Scratchpad, and Spotlight `Focus on: <Task>` & `focus <mins>m <intention>` commands.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Added `Start focus ritual` quick actions to Desktop, App Launcher, Desktop Icon, and Dock context menus.',
          'Workspace JSON backup export, import validation, and factory reset now persist and restore `focusState` preferences and completed session history.',
        ],
      },
    ],
  },
  {
    version: '1.7.0',
    title: 'Procedural Soundscape Mixer, Saved Atmospheres & Widget Soundscape API',
    date: 'October 2026',
    summary:
      'Added a zero-dependency Web Audio procedural soundscape synthesizer with 6 organic channels (Soft Rain, Vinyl Dust, Fireplace, Deep Brown, Pines & Wind, Night Crickets) that layer seamlessly underneath Music tracks or play solo across the desktop.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Procedural Web Audio Soundscape Engine (`nexus.soundscape.v1`): seamless stereo-crossfaded Pink/Brownian noise, analog vinyl micro-crackle, hearth embers, dual-LFO pine wind, and gentle evening cricket stridulation with smooth click-free gain ramps and zero network dependency.',
          'Dedicated `Soundscapes` studio tab inside Music with 4 curated 1-click focus atmospheres (`Rainy Study`, `Cabin Hearth`, `Deep Focus Shield`, `Midnight Porch`), custom named mix saving, master ambience volume, and 6 tactile channel faders.',
          'Floating Now Playing quick-mixer popover (layer ambience over any song or run standalone ambient sessions from the top-right desktop bar), Spotlight Soundscape commands/presets, and `Ambient Soundscape` Widget Studio template + `NEXUS.music` soundscape API.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Extended `window.NEXUS.music` with live `.soundscape` state snapshots plus `setSoundscape(layer, 0–100)`, `applySoundscapePreset(name)`, `toggleSoundscape()`, `setSoundscapeVolume()`, and `clearSoundscape()`.',
          'Workspace JSON backup export, import validation, and factory reset now persist and restore `soundscapeState` custom mixes and fader levels.',
        ],
      },
    ],
  },
  {
    version: '1.6.0',
    title: 'Desktop Spaces, 1-Click Context Switching & Per-Space Audio/Widget Rules',
    date: 'October 2026',
    summary:
      'Introduced multi-workspace Desktop Spaces for instant context switching across window layouts, 50/50 split-screen arrangements, ambient wallpapers, per-space widget visibility, and linked Music focus streams or playlists.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Desktop Spaces with 3 curated starter contexts — Deep Work (distraction-free canvas), Research (50/50 Browser + Scratchpad split on Glacier), and Unwind (Music + Nexus Tube lounge on Dusk with Chillhop radio) — plus up to 6 customizable Spaces.',
          'Dock Spaces Switcher popover with 1-click space switching, inline configuration drawers (rename, 12 wallpapers, linked audio rules, per-space widget visibility toggles, and "Save current windows here"), and keyboard shortcuts (`Alt + 1..6` and `Ctrl + Alt + 1..6`).',
          'Dedicated `Settings → Spaces` management panel, Desktop right-click quick Space switcher row, Dock right-click `Move to <Space>` window actions, and Spotlight Spaces search (`switch-space`, `move-active-window-to-space`, and `space <Name>` creation).',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Live window moves, split-screen snaps, and wallpaper changes sync automatically into the active Space, and 50/50 snapped windows recompute bounds cleanly for the current viewport on switch.',
          'Workspace JSON backup export, import, and factory reset now persist and restore `spacesState` alongside all desktop preferences.',
        ],
      },
    ],
  },
  {
    version: '1.5.0',
    title: 'Widget Studio Music Bridge, Audio API Reference & Now Playing Deck',
    date: 'October 2026',
    summary:
      'Exposed real-time desktop Music playback state and full audio transport, volume, stream, playlist, and app-navigation controls to custom desktop widgets via window.NEXUS.music, paired with searchable API Reference docs and a Now Playing Deck starter widget.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Live Widget Music Bridge (`window.NEXUS.music` & `nexus:music` events): custom widgets can read live track metadata, cover art, progress, duration, volume, shuffle/repeat, queue, playlists, and liked status in real time without reloading the iframe.',
          'Full widget audio & Music app control methods: `toggle()`, `play(target?)`, `pause()`, `stop()`, `next()`, `prev()`, `seek(sec)`, `setVolume(0–100)`, `toggleMute()`, `toggleShuffle()`, `cycleRepeat()`, `toggleLike()`, `playStream(indexOrId)`, `playPlaylist(idOrName)`, `enqueue(idOrUrl, title?)`, `search(query)`, and `open(tab?)`.',
          'Widget Studio "Now Playing Deck" starter template plus interactive category filtering (`All`, `Music`, `Lifecycle`, `Theme`, `Storage`, `Navigation`) and method search in the API Reference tab.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Opening Music, Nexus Tube, or Widget Studio from a desktop widget now focuses an existing window cleanly instead of spawning duplicate instances.',
        ],
      },
    ],
  },
  {
    version: '1.4.0',
    title: 'Nexus Tube, Persistent Desktop Music, Timestamp Notes & 4-Column Launcher',
    date: 'October 2026',
    summary:
      'Introduced Nexus Tube and a persistent desktop Music player with a floating Now Playing bar, playlists, liked songs, curated 24/7 focus streams, one-click video timestamp notes to Scratchpad, Spotlight media search, Browser video/audio handoff, and a spacious 4-column App Launcher.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Persistent desktop Music runtime & floating Now Playing mini-player: audio continues uninterrupted when Music is minimized or closed, with auto-advance on track end, seek scrubber, volume slider, shuffle, repeat (Off / All / One), Up Next queue reordering, Liked songs, custom Playlists, and 6 zero-search 24/7 focus streams.',
          'Nexus Tube workspace upgrades: Watch later queue, rich video durations, view counts, and expandable descriptions, one-click "Listen in Music" handoff, and live "[MM:SS]" Timestamp Note capture directly into Scratchpad.',
          'Cross-app media workflows: Spotlight ("yt <query>", "music <query>", "play <query>", media transport, and history/Watch later indexing), inline "Watch in Tube" & "Play Audio" buttons on YouTube results in Nexus Browser, and contextual media quick actions across Launcher, Desktop, and Dock menus.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Expanded the App Launcher grid to a balanced 4-column layout with matching arrow-key navigation and dedicated Music icon badge tokens in light and dark themes.',
          'Workspace JSON backup export, import, and factory reset now include YouTube watch history, Watch later, Music history, Liked songs, and custom Playlists.',
        ],
      },
      {
        kind: 'fixed',
        label: 'Fixed',
        items: [
          'Added YouTube IFrame API origin handshake for reliable live playback progress, seek, volume, and track-end events, plus a live web + oEmbed metadata fallback when YOUTUBE_API_KEY is not configured.',
        ],
      },
    ],
  },
  {
    version: '1.3.0',
    title: 'Desktop Context Menu, Quick Note Creation & Menu Layering Fixes',
    date: 'October 2026',
    summary:
      'Resolved App Launcher and desktop menu z-index collisions, added viewport-clamped menu positioning, and upgraded the Desktop, Launcher, Desktop Icon, and Dock menus with one-click Note & Checklist creation, new Browser tab handoff, 50/50 window tiling, and quick workspace controls.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Direct "New note", "New checklist", "New browser tab", and "Add web shortcut" quick-create actions in the Desktop right-click menu.',
          'Contextual Desktop window & workspace actions: "Tile windows side by side" (50/50 split preserving natural left-to-right order), "Show desktop" / "Restore windows", "Manage widgets", theme toggle, quote rotation, "Workspace settings", and "Lock workspace".',
          'Contextual app quick actions ("New note", "New checklist", "New search tab", "Arrange desktop") across App Launcher, Desktop Icon, and Dock right-click menus, plus quick Note, Theme, Settings, and Lock controls in the App Launcher footer.',
        ],
      },
      {
        kind: 'fixed',
        label: 'Fixed',
        items: [
          'Fixed App Launcher per-app dropdown z-index bug where neighboring grid/list app tiles painted over open ".l-pin-menu" popovers, and added column-aware alignment and row-aware upward flipping.',
          'Moved Desktop and Desktop Icon context menus out of ".desktop-canvas" overflow clipping and established a unified top-level z-index hierarchy across windows, dock, tray, menus, App Launcher, Spotlight, Changelog, and Passcode modals.',
        ],
      },
    ],
  },
  {
    version: '1.2.0',
    title: 'Context-Aware Selection Actions Across Browser & Scratchpad',
    date: 'October 2026',
    summary:
      'Introduced context-aware floating selection toolbars connecting Nexus Browser and Scratchpad — clip web paragraphs with source attribution, research any note passage with Gemini + Live Web Search, and turn selected text directly into interactive checklist tasks.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Browser → Scratchpad selection actions: highlight any paragraph or search snippet in Nexus Browser to append it to your active note with automatic source attribution, create a new note, or capture it directly as a checklist task.',
          'Scratchpad → Browser research handoff: select text in Scratchpad (in Write, Split, or Preview mode) to research it with Gemini AI + Live Web Search or open selected URLs directly in Nexus Browser.',
          'One-click "Turn into Task" conversion: transform single lines, bullet lists, or multi-line passages in Scratchpad into interactive "- [ ] " checklist items in-place.',
          'One-click "Save to Scratchpad" button on Gemini AI Overview syntheses and live cross-window handoff that automatically opens or focuses the target app.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Scratchpad Markdown Task toolbar button now converts multi-line text selections into checklist items in a single click.',
        ],
      },
    ],
  },
  {
    version: '1.1.0',
    title: 'Spotlight Command Palette & Instant Workspace Search',
    date: 'October 2026',
    summary:
      'Added a global Cmd/Ctrl + K Spotlight Command Palette that unifies app launching, full-text Scratchpad note search, open-window switching & tiling, safe instant math/percentage calculations, and one-stroke web search or note capture.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Global Spotlight Command Palette (Cmd/Ctrl + K, Dock Search button, and Desktop right-click menu) with keyboard navigation and Tab-switchable All / Apps / Notes / Windows / Commands filters.',
          'Full-text Scratchpad note indexing with live content snippets, direct jump-to-note, and instant "Create Scratchpad Note" / "New Checklist Note" actions.',
          'Built-in zero-eval arithmetic and percentage calculator (e.g. "145 * 12", "(1920 - 240) / 2", "24% of 350", "15% off 200") with Enter-to-copy.',
          'Direct Browser handoff from Spotlight to open typed URLs or run Gemini AI + Live Web Search queries in Nexus Browser.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Spotlight indexes open windows, split-screen tiling actions (Left, Right, Maximize, Restore), theme toggle, all 12 ambient wallpapers, workspace JSON backup export, and lock screen controls.',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    title: 'Upgraded Multi-Note Scratchpad, Checklists & Markdown',
    date: 'October 2026',
    summary:
      'Evolved Scratchpad into a multi-note workspace with pinned notes, live search & checklist filters, interactive task checkboxes, Write / Split / Preview Markdown modes, and .md export.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Multi-note Scratchpad sidebar with instant note search, All / Pinned / Checklists filters, note pinning, and two-step delete protection.',
          'Write, Split, and Preview Markdown modes with interactive checklists (- [ ] / - [x]) that can be checked off directly in Preview or Split view.',
          'Markdown formatting toolbar (Task, Heading, Bold, Italic, Code, Quote, Divider, Clear completed) plus smart Enter list continuation and one-click .md file download.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Existing single-note Scratchpad content migrates automatically into the multi-note store with zero data loss.',
          'Workspace JSON backups now export and restore the complete multi-note Scratchpad library.',
        ],
      },
    ],
  },
  {
    version: '0.9.0',
    title: 'Window Snapping, Split-Screen Tiling & Session Restore',
    date: 'October 2026',
    summary:
      'OS-grade window edge snapping with live ghost previews, 50/50 split-screen tiling buttons and keyboard shortcuts, smooth drag-to-detach, and optional open-window session restoration.',
    groups: [
      {
        kind: 'added',
        label: 'Added',
        items: [
          'Drag-to-edge window snapping: drag any window title bar to the left, right, or top screen edge with a live translucent snap-zone preview.',
          'Title bar quick-tile controls (Left Half, Right Half, Maximize / Restore) plus global keyboard tiling shortcuts (Alt + [, Alt + ], Alt + Up, Alt + Down).',
          'Opt-in "Restore open windows on startup" toggle in Settings -> Desktop to persist open windows, split-screen tiles, and focus state across new tabs.',
        ],
      },
      {
        kind: 'updated',
        label: 'Updated',
        items: [
          'Dragging a maximized or split-snapped window smoothly detaches it back to its original floating size anchored under the pointer.',
          'Snapped 50/50 split windows automatically recalculate proportional bounds whenever the browser viewport resizes.',
          'Workspace JSON backups now include the window session-restore preference.',
        ],
      },
    ],
  },
  {
    version: '0.8.0',
    title: 'Browser, Web Shortcut Apps, Widget Studio Rebuild & PRD Completion',
    date: 'October 2026',
    summary:
      'Redesigned multi-tab Browser with Gemini AI + Live Web Search, rebuilt split-pane Widget Studio, first-class web shortcut apps, local passcode management, Arrange Mode widget sizing, and versioned JSON workspace backups.',
    groups: [
      {
        kind: 'added',
        label: 'Browser, Shortcuts & Workspace Controls',
        items: [
          'Redesigned multi-tab Nexus Browser with Gemini AI + Live Web Search, synced Bookmarks Bar, search engine switcher, and external tab launch.',
          'Saved web shortcuts behave as first-class Nexus apps across the Launcher, Dock, and Desktop with progressive multi-source favicon loading.',
          'Rebuilt split-pane Widget Studio IDE with 7 ready-to-use templates, live viewport presets, console/storage inspector, and interactive API insertion.',
          'Passcode verification & removal flow, Arrange Mode widget resizing, Launcher keyboard navigation, and versioned Workspace Backup (Export / Import JSON).',
        ],
      },
    ],
  },
  {
    version: '0.7.0',
    title: 'Widget Studio as a standalone app',
    summary:
      'Extracted Widget Studio from Settings into a dedicated workspace app with host-mediated theme and local storage APIs.',
    groups: [
      {
        kind: 'added',
        label: 'Widget Studio & Host APIs',
        items: [
          'Standalone Widget Studio app in the Nexus launcher and app registry with dedicated library sidebar.',
          'Host-mediated NEXUS.getTheme(), NEXUS.setTheme(), and per-widget namespaced local storage APIs.',
        ],
      },
    ],
  },
  {
    version: '0.6.0',
    title: 'Settings and desktop polish',
    summary:
      'Categorized Settings sidebar, editable rotating desktop messages, and smooth wallpaper transitions.',
    groups: [
      {
        kind: 'added',
        label: 'Settings & Desktop Polish',
        items: [
          'Added categorized Settings navigation for Appearance, Desktop, Desktop Messages, and Privacy.',
          'Restored rotating desktop messages with editable defaults and reduced-motion-safe wallpaper crossfades.',
        ],
      },
    ],
  },
  {
    version: '0.5.0',
    title: 'Desktop experience',
    summary:
      'Expanded ambient wallpaper collection and quick-access menus across desktop and system tray.',
    groups: [
      {
        kind: 'updated',
        label: 'Desktop Experience',
        items: [
          'Added wallpaper controls to desktop right-click and calendar tray menus with 12 ambient palettes.',
          'Refined minimized-window dock restoration and launcher quick-access spacing.',
        ],
      },
    ],
  },
  {
    version: '0.4.0 & earlier',
    title: 'Workspace foundation',
    summary:
      'Initial OS-like new-tab workspace, dock, window manager, themes, clock, Scratchpad, and Changelog modal.',
    groups: [
      {
        kind: 'fixed',
        label: 'Foundation',
        items: [
          'Introduced the OS-like new-tab workspace, launcher, dock, floating windows, desktop shortcuts, themes, clock, Scratchpad, and Changelog modal.',
        ],
      },
    ],
  },
];

export const CURRENT_RELEASE: ChangelogRelease = CHANGELOG_RELEASES[0];
export const PREVIOUS_RELEASES: readonly ChangelogRelease[] = CHANGELOG_RELEASES.slice(1);
