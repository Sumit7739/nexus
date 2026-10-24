/**
 * Single Source of Truth for Nexus version & release history.
 *
 * Versioning policy:
 * - Bump `NEXUS_VERSION` by +0.1 on every major feature update (e.g., 0.8.0 -> 0.9.0 -> 1.0.0).
 * - Prepend a new `ChangelogRelease` entry at index 0 of `CHANGELOG_RELEASES` with matching `version`.
 * - Keep `package.json`, `public/manifest.json`, and `CHANGELOG.md` synchronized with `NEXUS_VERSION`
 *   (enforced automatically by `tests/version.test.ts`).
 */

export const NEXUS_VERSION = '1.3.0';
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
