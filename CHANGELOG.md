# Nexus Changelog

All notable user-facing changes are recorded by release. Each version has its own Added, Updated, Fixed, and Removed sections.

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
