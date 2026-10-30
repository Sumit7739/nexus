# Stash Edge Shelf Report

## Purpose

Stash is a temporary tray for content that is useful now but does not yet deserve a full Scratchpad note. It lives on the right edge of the desktop and persists cards in local browser storage.

## How to use it

1. Open Stash from the Dock, the right-edge tab, `Alt+S`, Spotlight, or a widget.
2. Paste content into the input and select **Stash**, or drag text/links/code onto the shelf.
3. Use Browser or Scratchpad text selection actions to send selected text directly to Stash.
4. Use the card actions to copy, remove, create a Scratchpad note, save a URL as a shortcut, queue a YouTube link in Music, or open a URL.
5. Filter cards by links, code, colors, videos, or calculations. **Clear** removes every card.

## Classification

Each card is classified when it is added:

- YouTube URLs become `youtube` cards and can be queued in Music.
- HTTP(S) URLs become `url` cards and can become Saved Links.
- Hex, RGB, and HSL values become `color` cards.
- Equation-style results become `calculation` cards.
- Multiline code-like content becomes `code` cards.
- Everything else becomes a `text` card.

Duplicate content is replaced with a fresh card at the top. The tray keeps at most 60 cards, and each card is sanitized before storage.

## Widget API

Custom widgets run in a sandboxed iframe and communicate with the desktop host through `postMessage`:

```js
NEXUS.stash('https://example.com', { title: 'Example' });
NEXUS.openStash();
```

The host validates the message, classifies the content, records the widget as the source, persists the card under `nexus.stash.v1`, and opens the shelf. Widgets cannot access the parent page or local storage directly.

## Persistence and backup

The in-memory Stash store publishes updates to the shelf and Dock badge. Cards are persisted to `localStorage` under `nexus.stash.v1`. Workspace JSON backup includes `stashState`; import sanitizes it before writing it back, and factory reset removes it with the other `nexus.*` keys.

## Interaction fix

The desktop root dismisses transient UI when it receives a click. The edge trigger and shelf now stop click propagation, so typing, filters, buttons, conversion actions, and drag/drop remain available instead of closing the shelf immediately.
