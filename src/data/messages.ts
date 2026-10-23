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
  { id: 'dm-01', text: 'Your tab count says a lot about you.' },
  { id: 'dm-02', text: 'Still waiting for dark mode everywhere.' },
  { id: 'dm-03', text: 'You opened a new tab. Bold move.' },
  { id: 'dm-04', text: 'git commit -m "fix: everything"' },
  { id: 'dm-05', text: 'Works on my machine.' },
  { id: 'dm-06', text: 'Have you tried turning it off and on again?' },
  { id: 'dm-07', text: 'It\'s not a bug. It\'s a feature you haven\'t appreciated yet.' },
  { id: 'dm-08', text: 'Stack Overflow is down. You\'re on your own.' },
  { id: 'dm-09', text: 'There are only 2 hard problems in CS: naming things, cache invalidation, and off-by-one errors.' },
  { id: 'dm-10', text: '99 little bugs in the code. 99 little bugs. Take one down, patch it around — 127 little bugs in the code.' },
  { id: 'dm-11', text: 'The best code is no code at all.' },
  { id: 'dm-12', text: 'sudo make me a sandwich.' },
  { id: 'dm-13', text: 'Your coffee is cold. Your code is hot.' },
  { id: 'dm-14', text: 'undefined is not a vibe.' },
  { id: 'dm-15', text: 'You are in a zone. Please do not disturb.' },
  { id: 'dm-16', text: 'Shipping is a feature.' },
  { id: 'dm-17', text: 'Nobody checks the console in production. Nobody.' },
  { id: 'dm-18', text: 'Another day, another import cycle.' },
  { id: 'dm-19', text: 'Remember: always be deploying.' },
  { id: 'dm-20', text: 'The cloud is just someone else\'s computer.' },
  { id: 'dm-21', text: 'CSS is a programming language. (We don\'t talk about it.)' },
  { id: 'dm-22', text: 'Tabs vs spaces. Choose wisely.' },
  { id: 'dm-23', text: 'Technically, it\'s not done until it\'s in prod.' },
  { id: 'dm-24', text: 'The fastest code is the code that never runs.' },
  { id: 'dm-25', text: 'Good morning. Now close 12 of those tabs.' },
  { id: 'dm-26', text: 'Your future self will question your variable names.' },
  { id: 'dm-27', text: 'Refactor later. (We both know you won\'t.)' },
  { id: 'dm-28', text: 'A console.log a day keeps the debugger away.' },
  { id: 'dm-29', text: 'Writing documentation: a heroic act no one will thank you for.' },
  { id: 'dm-30', text: 'This is fine. 🔥' },
  { id: 'dm-31', text: 'You either ship fast or you ship perfect. Pick one.' },
  { id: 'dm-32', text: 'null pointer exception walks into a bar. The bar crashes.' },
  { id: 'dm-33', text: 'Deep work in progress. Interruptions will be logged.' },
  { id: 'dm-34', text: 'Your local environment is a lie.' },
  { id: 'dm-35', text: 'Merge conflicts are the universe telling you to communicate.' },
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
