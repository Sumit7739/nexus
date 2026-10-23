
Nexus — Product Requirements Document

Document version: 1.0
Status: Ready for implementation planning
Product type: Local-first browser extension / New Tab desktop environment
Initial target: Firefox on desktop, with Chromium compatibility as a design goal
Owner: Product / Engineering
Last updated: 24 October 2026
1. Executive summary

Nexus transforms the browser's New Tab page into a clean, OS-inspired personal desktop. It should feel like a small desktop environment living inside the browser: spatial rather than page-based, quiet by default, configurable by the user, and built on reusable systems rather than one-off UI elements.

The first priority is the desktop shell and its interaction model—not a collection of widgets or a new browser engine. The experience includes a minimal desktop canvas, a single application-menu icon in the dock by default, an optional rotating welcome message, a bottom-right date/time display, theme switching, application launching and pinning, an opening splash animation, and an optional password lock.

Nexus remains a browser extension for the initial release. Websites that cannot be embedded reliably are outside the current UI milestone; the product must not attempt to bypass browser security controls. Website rendering compatibility is a separate future workstream.
2. Product vision

Vision: Make a browser tab feel like a personal operating-system workspace.
2.1 Product principles

    OS, not landing page. The interface must not resemble a conventional dashboard or marketing hero page.
    Quiet by default. The default desktop is intentionally empty. Users choose what appears.
    Spatial and persistent. Desktop objects have independent positions and stable identities.
    Consistent system language. Icons, menus, overlays, windows, colors and motion share a common design system.
    Local-first. Core functionality works without an account, backend or network dependency.
    Extensible foundations, restrained scope. Build reusable canvas, overlay, theme and application-registry boundaries without prematurely implementing widgets or complex app ecosystems.
    Honest browser boundaries. Do not promise arbitrary websites can be rendered inside custom windows.

3. Goals and non-goals
3.1 Goals

    Replace the standard New Tab page with a clean, OS-like desktop.
    Provide a grid-aware canvas that can support movable desktop objects.
    Establish a coherent design system, icon system and animation language.
    Provide an application menu as the main way to discover and launch apps.
    Let users pin and unpin apps independently on the desktop and dock.
    Provide persistent light and dark themes.
    Show a small, rotating welcome message and date/time without clutter.
    Add a polished opening splash screen.
    Add an optional password gate that is disabled until the user configures a password.
    Preserve existing app definitions and window-manager behavior where feasible.
    Keep data local and provide robust error handling.

3.2 Non-goals for the initial UI release

    A new browser engine or replacement browser.
    Guaranteed embedding of all websites.
    A server, account system, cloud synchronization or collaboration.
    A full widget framework or widget catalog.
    A file manager, terminal, notifications center, calendar integration or other new apps.
    Mobile-first support.
    Enterprise-grade authentication or encryption of the entire browser profile.
    Rewriting unrelated features merely to match a new folder structure.

4. Target users and primary use cases
Primary user

A desktop browser user who wants a personal, configurable workspace and values clean visual design, keyboard access, local data, and OS-like interactions.
Core use cases

    Open a new tab and see a calm desktop rather than a busy dashboard.
    Open the application menu and launch an available application.
    Pin an application to the desktop or dock; later unpin it.
    Move desktop objects on a grid without affecting other objects.
    Switch between light and dark themes, with the choice retained.
    See a brief, rotating welcome message and the current date/time.
    See an opening animation before the desktop appears.
    Optionally configure a password and be prompted for it on subsequent openings.
    Continue using the desktop when local storage is unavailable or corrupt, with a useful error or recovery path.

5. Information architecture
5.1 Main surfaces

    Splash screen: transient opening state.
    Lock screen: shown only when a password has been configured and the session has not been unlocked.
    Desktop canvas: main workspace; no default app shortcuts or widgets.
    Application menu: app discovery, launch actions, pin actions, theme toggle and relevant desktop settings.
    Dock: contains only the application-menu icon on a fresh install. User-pinned apps may appear after that.
    Application windows: existing window manager and app surfaces; visual integration is in scope, changes to website-rendering architecture are not.
    Transient overlays: menus, dialogs and confirmation surfaces managed through shared primitives.

5.2 Default first-run screen

A fresh install must show:

    No top header or top bar.
    No default app icons on the desktop.
    No default app shortcuts in the dock, except the single application-menu icon.
    No status labels, helper text, placeholder cards, widgets or decorative information panels.
    A subtle, optional grid/alignment aid that is not visually dominant in normal mode.
    A small welcome message, if enabled, placed unobtrusively.
    Date and time in the bottom-right corner.
    A clean light theme by default; dark theme available from the application menu.

6. Functional requirements

Priority legend: P0 = required for initial release; P1 = desirable after core functionality is stable; Later = explicitly deferred.
FR-01 — New Tab desktop shell (P0)

The extension shall replace the browser's New Tab page with the Nexus desktop.

Acceptance criteria:

    Opening a new tab loads the desktop without requiring an account or network request.
    The page does not render the previous branding/header strip or landing-page hero.
    Layout adapts to the available viewport without accidental overflow.
    The desktop remains usable if optional local data is missing.

FR-02 — Minimal default state (P0)

A new installation shall have an intentionally empty desktop.

Acceptance criteria:

    No app icons are pinned to the desktop by default.
    The dock contains only the application-menu icon.
    No default widgets, cards, explanatory copy, extra status indicators or shortcut collections are rendered.
    The clock and welcome message are the only optional ambient content; both must remain visually restrained.

FR-03 — Desktop canvas and layout model (P0 foundation; object manipulation P0)

The desktop shall use a canvas/layout abstraction rather than independent ad hoc CSS positioning.

Each desktop object should have a stable ID, object type, logical position, dimensions/span where applicable, configuration and supported actions. Positioning should be stored as grid coordinates or a documented normalized coordinate model, not scattered hard-coded offsets.

Acceptance criteria:

    Moving one object does not modify another object's stored position.
    Objects can be selected and moved.
    Grid snapping is consistent and can be shown subtly or enabled during an arrange/edit mode.
    Viewport resizing keeps objects accessible and remaps/clamps positions predictably.
    Layout persistence is versioned and recoverable.
    The architecture supports future object types without implementing widgets in this release.

FR-04 — Application registry and menu (P0)

Applications shall be defined in a central registry with stable IDs, labels, icons, launch behavior and supported pin locations.

Acceptance criteria:

    The application menu lists installed/available apps.
    Selecting an app launches it or focuses its existing instance according to the app's behavior.
    Each app exposes actions to pin to desktop, pin to dock, or unpin from a location where it is already pinned.
    Pinning to the desktop does not automatically pin to the dock, and vice versa.
    Pin actions persist across New Tab reloads.
    Applications remain available in the menu when not pinned.
    The menu has clear grouping, keyboard navigation, focus handling and Escape dismissal.

FR-05 — Dock (P0)

The dock shall be minimal and centered near the bottom edge.

Acceptance criteria:

    Fresh install shows only the application-menu icon.
    User-pinned apps appear as additional dock items.
    Pinned state is distinct from running/open-window state.
    The dock does not show unrequested status text or decorative shortcuts.
    Dock items have consistent icon sizing, hit targets, focus states and hover behavior.
    If an app is unpinned while open, its open window remains manageable through the window manager.

FR-06 — Theme system (P0)

Nexus shall provide light and dark themes through a shared token system.

Acceptance criteria:

    Theme toggle is available from the application menu/settings.
    Theme selection persists locally across tabs and browser restarts, subject to browser storage behavior.
    All first-party surfaces—canvas, dock, menus, windows, dialogs and form controls—use theme tokens.
    No component relies on hard-coded colors that break the alternate theme.
    Theme transition is smooth but does not cause flashes or impair readability.

FR-07 — Welcome message (P1)

The desktop may show one concise, fun welcome phrase, inspired by the original version.

Acceptance criteria:

    The message is not a large landing-page hero.
    A different message may be selected on each New Tab opening and/or after a configurable interval.
    Rotation does not cause layout shifts or interfere with desktop objects.
    The feature can be disabled or reduced in settings if needed.
    Messages are stored in a local curated list; no network request is required.

FR-08 — Date and time (P0)

The desktop shall display the current local date and time in the bottom-right corner.

Acceptance criteria:

    Time updates accurately while the page remains open.
    Display respects the user's browser/OS locale and time settings where practical.
    The clock does not overlap the dock or desktop objects.
    It remains legible in both themes and at common desktop viewport sizes.

FR-09 — Splash screen and opening animation (P0)

The extension shall display a brief, clean splash state before presenting the desktop or lock screen.

Acceptance criteria:

    Splash screen uses the Nexus emblem/wordmark and restrained motion.
    The sequence is short and does not feel like a loading delay when no loading is necessary.
    After the splash, show the lock screen if a password is configured; otherwise show the desktop.
    Opening animation and desktop entrance transition are coordinated and do not flash the previous UI.
    Respect prefers-reduced-motion; in reduced-motion mode, use a minimal fade or no nonessential motion.
    Handle reloads and fast repeated tab openings without leaving the UI stuck on the splash.

FR-10 — Optional password gate (P0 if included in build; must be clearly scoped as a local privacy lock)

Password protection is disabled by default. Until the user explicitly sets a password, Nexus must not ask for one.

Acceptance criteria:

    First run and every run without a configured password proceeds from splash to desktop.
    User can set or change a password from settings/menu.
    Setup requires password confirmation and validates inputs.
    Once configured, subsequent openings show a clean lock screen after the splash.
    Correct password unlocks the desktop; incorrect password shows a restrained error and allows retry.
    Password is never stored in plaintext. Use a vetted password-based key derivation function with a unique salt, stored parameters and versioned verifier format.
    Do not store the password itself or expose it through logs.
    Provide a deliberate password removal/reset flow with clear warning that local lock data can be reset by someone with access to extension storage.
    The UI must accurately describe this as a local privacy barrier, not strong protection against someone who can modify the browser profile or extension storage.
    Avoid an insecure “forgot password” recovery mechanism that silently bypasses the lock.

FR-11 — Shared overlay primitives (P0 foundation)

Menus and dialogs shall use shared overlay infrastructure rather than one-off components.

Acceptance criteria:

    Menus and dialogs support Escape dismissal where appropriate.
    Focus is moved into modal dialogs and returned to the invoking control after dismissal.
    Click-outside behavior is consistent and configurable by overlay type.
    Layering/z-index is centrally managed.
    Modal dialogs are distinct from application windows in state and behavior.
    Overlay primitives do not implement the full future widget system.

FR-12 — Unified icon system (P0)

The UI shall use one coherent icon system for system controls and app glyphs, with intentional exceptions for official brand marks.

Acceptance criteria:

    A central icon registry or wrapper is used for consistent sizing and styling.
    No emoji or arbitrary Unicode glyphs are used as substitutes for standard interface icons.
    Icon stroke, optical alignment, hover, active, disabled and focus states are consistent.
    App brand icons may use approved brand assets where appropriate.
    Icons remain recognizable in light and dark themes.

FR-13 — Animation and motion system (P0)

Motion shall be defined centrally through reusable tokens and interaction patterns.

Acceptance criteria:

    Menu entrance/exit, dock hover, icon selection and window transitions use consistent durations and easing.
    Drag movement follows the pointer directly; no delayed animation is added to pointer tracking.
    Window opening/closing/minimizing does not break focus or pointer interaction.
    Reduced-motion preferences are respected across the app.
    Animations are not used as a substitute for clear state or feedback.

FR-14 — Local persistence and recovery (P0)

Persist user preferences and layout locally.

Acceptance criteria:

    Settings and pin/layout state survive a New Tab reload and browser restart.
    Storage schema is versioned and migrations are explicit.
    Missing, invalid or outdated data falls back safely to defaults.
    Storage failures do not crash the entire desktop.
    User data is not transmitted to a server.
    Export/import may be implemented if already supported, but is not a prerequisite for the initial visual milestone.

FR-15 — Existing application/window compatibility (P0 regression requirement)

The UI redesign must preserve existing application definitions and window-manager behavior where possible.

Acceptance criteria:

    Existing apps remain launchable from the menu.
    Open, focus, close, minimize, maximize and restore behavior remains functional.
    UI refactoring does not introduce unrelated changes to website embedding.
    Incompatible website embedding is handled according to existing behavior; this PRD does not authorize bypassing browser security controls.

7. Design system requirements
7.1 Visual direction

    Warm, restrained, editorially clean but unmistakably desktop-like.
    Generous empty space; no decorative cards or dashboards by default.
    Thin borders, subtle depth, consistent radii and readable typography.
    Light theme default; dark theme designed as a first-class mode, not an inversion filter.
    No branding/header bar across the top.

7.2 Design tokens

Centralize:

    Colors and semantic surface roles.
    Typography scale, weights and line heights.
    Spacing scale.
    Border widths, radii and shadows.
    Icon sizes.
    Z-index/layer roles.
    Animation durations and easing curves.
    Canvas grid dimensions and snapping thresholds.

7.3 Responsive behavior

The primary target is desktop. At narrow viewport widths:

    The canvas should remain usable.
    Dock and clock should not overlap.
    Menus should fit inside the viewport.
    Windows should be clamped or resized to remain reachable.
    Do not introduce a separate mobile design in the initial release.

8. Technical architecture guidance

The implementation agent should inspect the existing repository before making changes and extend it rather than blindly recreating it.

Suggested boundaries:

    desktop: desktop root, canvas, desktop objects and layout engine.
    system-panel/application-menu: menu and system actions; no persistent top bar in the final UI.
    dock: dock layout and pin state.
    window-manager: existing window lifecycle and geometry.
    apps: central app registry and app hosts.
    overlays: modal/menu/notification primitives and focus/layer management.
    design-system: tokens, icon registry, reusable primitives and motion definitions.
    persistence: versioned settings, pin state and layout repositories.
    security: optional password verifier and lock state, if kept separate.

These are architectural boundaries, not a mandate to create empty files for every folder. Prefer a small number of meaningful modules over over-abstraction.
State boundaries

    Transient UI state (active menu, hover, drag in progress) remains in memory.
    Durable preferences (theme, welcome-message preference, pin state, layout) use local extension storage/IndexedDB as appropriate.
    Password verifier is stored separately from ordinary preferences and never includes plaintext password.
    Browser-specific APIs are isolated behind an adapter.

9. Security and privacy

    No server or analytics dependency for core features.
    Request only the browser permissions required by implemented behavior.
    Treat embedded websites as untrusted content.
    Never disable browser security protections merely to make arbitrary websites embed.
    If password lock is implemented, describe its threat model honestly.
    Validate imported data and external URLs.
    Do not inject privileged extension APIs or secrets into arbitrary page content.

10. Performance and accessibility
Performance

    Opening a new tab should feel immediate; the splash must not impose an artificial delay when avoidable.
    Avoid re-rendering the entire desktop for every pointer movement.
    Persist drag results at interaction end rather than on every pointer event.
    Avoid unnecessary animation loops and timers.
    Keep dependencies minimal.

Accessibility

    Keyboard access to the application menu, apps, theme toggle and dialogs.
    Visible focus indicators.
    Accessible labels for icon-only buttons.
    Correct focus handling for menus and modal dialogs.
    Adequate contrast in both themes.
    Respect reduced-motion preferences.
    Do not rely on color alone to communicate active or error states.

11. Testing strategy
Unit tests

    Canvas coordinate conversion, snapping, clamping and resize behavior.
    Pin/unpin state and duplicate prevention.
    Theme persistence and fallback behavior.
    Password setup, verifier validation and unlock state transitions.
    Splash-to-lock/desktop routing logic.
    Storage schema migrations and invalid-data recovery.
    Window state actions.

Component/integration tests

    Fresh install renders only the menu icon in the dock.
    No default desktop pins or widgets are rendered.
    Application menu launches an app and exposes pin actions.
    Pinning to desktop/dock updates only the requested location.
    Theme toggle updates all first-party surfaces.
    Password prompt appears only after password setup.
    Escape and focus restoration work for overlays.

Manual browser checks

    Firefox extension loaded as a temporary add-on.
    New Tab reload and browser restart.
    Light and dark theme.
    Common desktop viewport sizes and resizing.
    Reduced-motion setting.
    Existing apps and window lifecycle.
    Password lock flow and documented reset limitations.

12. Release acceptance checklist

The initial UI release is complete only when all P0 requirements pass and the following default-state test passes:

    Install Nexus fresh.
    Open a New Tab.
    Observe a short splash animation.
    Arrive at a clean desktop with no top bar, no default desktop icons, and no widgets.
    See only the application-menu icon in the dock.
    See the date/time bottom-right and, if enabled, one small rotating welcome message.
    Open the application menu and launch an app.
    Pin an app to the desktop, then pin a different app to the dock.
    Reload the tab and verify pin positions and theme persist.
    Set a password, reopen the page, and verify the lock screen appears.
    Remove/reset the password through the documented flow and verify the lock screen is no longer required.
    Verify no unrelated web-rendering behavior changed.

13. Risks and open questions
Risk	Mitigation
Existing code differs from assumed architecture	Inspect repository and current tests before editing; produce a short change plan
CSS layout regressions	Use a clear layer model and viewport-based tests
Pinning state gets duplicated	Store desktop and dock pins as distinct location assignments with stable app IDs
Grid positions break on resize	Define coordinate semantics and migration rules before implementing drag behavior
Password lock gives false security expectations	Clearly label it a local privacy lock and document the browser-profile threat model
Splash makes New Tab feel slow	Keep it brief, skip artificial waits and respect reduced motion
Scope grows into widgets/apps	Keep deferred features explicitly out of scope
Website embedding becomes a distraction	Do not modify embed architecture during the UI milestone
Open decisions for implementation

The coding agent should make sensible defaults and document them rather than blocking on minor questions:

    Exact grid unit and snap spacing.
    Welcome-message rotation interval and phrase list.
    Exact splash duration and easing.
    Whether the password lock is enabled in the first build or delivered immediately after the UI foundation; if implemented, it must remain disabled until configured.
    Final icon asset source for third-party brands.

14. Implementation instructions for the coding agent

    Inspect the repository, package scripts, current components and Git status before editing.
    Treat the current committed v0.1.0 as the baseline; do not overwrite Git history.
    Summarize the existing architecture and identify the exact files to change.
    Implement the UI in small, coherent steps: design tokens, empty canvas, menu/dock, pinning, theme, welcome/clock, splash/lock, then motion polish.
    Reuse existing app registry, persistence and window-manager logic where it is sound.
    Do not add default shortcuts, widgets, helper copy, status labels or a top bar.
    Do not add backend services or unrelated application features.
    Run the available tests and production build; fix failures caused by the changes.
    Report what changed, what was tested, and any unverified behavior. Never claim a build or test passed unless it was actually run.
    Keep the changes easy to review and revert through Git.

15. Definition of success

Nexus succeeds at this stage when it feels like a coherent, minimal desktop environment—not a landing page, dashboard, or collection of cards. The screen starts empty and calm; the menu is the entry point to functionality; users decide what to pin; themes and layout persist; and the underlying code is organized to support future systems without prematurely building them.