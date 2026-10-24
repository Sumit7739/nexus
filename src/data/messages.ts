/* ─────────────────────────────────────────────────────────────────────────────
   NEXUS — Desktop Messages
   Fun, sarcastic, techy. Stored here so Settings can manage them.
   Users can add / edit / delete. The defaults live here as a fallback.
───────────────────────────────────────────────────────────────────────────── */

export interface DesktopMessage {
  id: string;
  text: string;
}

export const DEFAULT_MESSAGES: DesktopMessage[] = [
  { id: "dm-01", text: "Your roadmap has a roadmap. Naturally." },
  { id: "dm-02", text: "One more feature and then we refactor. Sure." },
  { id: "dm-03", text: "The bug is shy. Add a console.log and it appears." },
  { id: "dm-04", text: "Somewhere, a semicolon is missing. It knows what it did." },
  { id: "dm-05", text: "Ship it. Then ship the fix. Then write the postmortem." },
  { id: "dm-06", text: "Your future self called. They want fewer TODOs." },
  { id: "dm-07", text: "A quiet desktop. A suspicious number of open tabs." },
  { id: "dm-08", text: "If it works, don't touch it. If it breaks, you touched it." },
  { id: "dm-09", text: "The cloud is just a server you haven't had to reboot yet." },
  { id: "dm-10", text: "Cache invalidation: now featuring a new and exciting bug." },
  { id: "dm-11", text: "The fastest code is the code you never had to write." },
  { id: "dm-12", text: "One does not simply center a div. One negotiates with CSS." },
  { id: "dm-13", text: "It passed locally. Local has filed no further comment." },
  { id: "dm-14", text: "You can automate that. You can also spend six hours automating it." },
  { id: "dm-15", text: "Today's plan: fix one bug, discover four architectural decisions." },
  { id: "dm-16", text: "Naming things is easy. Welcome to FinalFinalManagerService." },
  { id: "dm-17", text: "Your side project has entered its side-project era." },
  { id: "dm-18", text: "Deep work in progress. Random meetings will be treated as incidents." },
  { id: "dm-19", text: "A good abstraction saves time. A bad one becomes your personality." },
  { id: "dm-20", text: "If the tests are green, check what the tests forgot to test." },
  { id: "dm-21", text: "You don't need another framework. You need lunch." },
  { id: "dm-22", text: "Git commit -m \"this should probably work\"" },
  { id: "dm-23", text: "The backlog is not a personality test. Stop trying to finish it." },
  { id: "dm-24", text: "It isn't procrastination if you're redesigning the architecture. (It is.)" },
  { id: "dm-25", text: "Every great product starts with one person saying: I can build that." },
  { id: "dm-26", text: "One day you'll look back at this code and understand why you wrote it. Maybe." },
  { id: "dm-27", text: "The only thing more permanent than a temporary fix is its documentation gap." },
  { id: "dm-28", text: "You opened the editor. That's technically progress." },
  { id: "dm-29", text: "If it needs a dashboard, it probably needs fewer dashboards." },
  { id: "dm-30", text: "Build the boring foundation. Future-you will send a thank-you note." },
  { id: "dm-31", text: "Your brain has 37 tabs open. At least this desktop only has a few." },
  { id: "dm-32", text: "An elegant solution is just a complicated solution after a few coffees." },
  { id: "dm-33", text: "Measure twice, refactor three times." },
  { id: "dm-34", text: "A feature is not finished until the empty state looks good." },
  { id: "dm-35", text: "Keep it local. Keep it simple. Keep the scope from mutating." },
  { id: "dm-36", text: "The best debugging tool is a reproducible bug. The second best is snacks." },
  { id: "dm-37", text: "You can fix it now, or explain it forever." },
  { id: "dm-38", text: "One clean commit can restore faith in humanity." },
  { id: "dm-39", text: "The roadmap says focus. The brain says: new project idea." },
  { id: "dm-40", text: "This is fine. The build is someone else's problem. 🔥" },
  { id: "dm-41", text: "Do the smallest useful thing. Then do it properly." },
  { id: "dm-42", text: "You are not behind. You are just running 14 parallel workstreams." },
  { id: "dm-43", text: "Sometimes the most senior move is deleting 200 lines." },
  { id: "dm-44", text: "Code like someone else will maintain it. That someone is probably you." },
  { id: "dm-45", text: "It is not scope creep if you rename the milestone." },
  { id: "dm-46", text: "Go drink water. The compiler can wait 30 seconds." },
  { id: "dm-47", text: "A good night's sleep is an underrated dependency." },
  { id: "dm-48", text: "Your app doesn't need AI. Your error message needs to be clearer." },
  { id: "dm-49", text: "The plan is solid. Reality has requested a meeting." },
  { id: "dm-50", text: "Less ceremony. More shipping." }
];

const MESSAGES_KEY = 'nexus.messages.v1';

export function readMessages(): DesktopMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    if (!raw) return DEFAULT_MESSAGES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 &&
        parsed.every((m: unknown) => m && typeof (m as DesktopMessage).id === 'string' && typeof (m as DesktopMessage).text === 'string')) {
      return parsed as DesktopMessage[];
    }
    return DEFAULT_MESSAGES;
  } catch { return DEFAULT_MESSAGES; }
}

export function saveMessages(messages: DesktopMessage[]): void {
  try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages)); } catch {}
}
