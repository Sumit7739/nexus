# Nexus Changelog

All notable user-facing changes are recorded by release. Versions increment by `0.1` (`0.8.0` → `0.9.0` → `1.0.0` → `1.1.0` → `1.2.0` → `1.3.0`) on every major feature milestone and stay synchronized with `src/data/version.ts`, `package.json`, and `public/manifest.json`.

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
