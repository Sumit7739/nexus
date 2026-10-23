**Redesign the Opslane Operations Dashboard to match a clean, paper-like editorial aesthetic with generous whitespace and zero visual clutter.**

### Design Direction & Core Styling

* **Container & Card Elimination:** Remove all boxed cards, solid container backgrounds, rounded outline boxes, and drop shadows. The entire canvas must feel like a single sheet of off-white/warm white matte paper.
* **Separation via Whitespace & Subtle Rules:** Structure sections using vertical breathing room (minimum 32px–48px between blocks) and ultra-faint hairline dividers (`#F0F0F0` or `#E5E5E5`) instead of bordered boxes.
* **Typography:**
* Main headings: Elegant editorial serif or high-contrast modern serif (e.g., *Newsreader*, *Playfair*, or *Instrument Serif*) for elements like "Welcome back, Sumit" and section titles.
* Section sub-labels & field titles: Small, uppercase, tracked-out monospace/sans font (e.g., `QUICK ACTIONS`, `WORKSPACE HEALTH`, `INVITE ATTENDEES`).
* Body & table text: Clean, legible geometric sans-serif (e.g., *Inter* or *Geist*).


* **Interactive Elements & Pills:** Use soft, pill-shaped tags (`border-radius: 9999px`) with muted, desaturated fills for filters, badges, and quick actions. Primary buttons should use subtle charcoal or deep slate fills with smooth rounded corners rather than aggressive solid black pills.

---

### Layout Structure & Content Blocks

1. **Top Header & Status:**
* Editorial greeting: *"Welcome back, Sumit"* in large serif text.
* Floating inline status chips: Clean pill badges for active tasks and quick workspace switches aligned seamlessly without boxed frames.


2. **Quick Actions Bar:**
* Remove the heavy outline box. Place actions as an understated horizontal strip of pill buttons with subtle icons and minimal text.


3. **Executive Overview & Insights:**
* Blend **Workspace Health** metrics directly into the page canvas: large, bold stat numbers (e.g., `73/100`, `0`, `1`) with small uppercase captions underneath, separated only by subtle vertical hairline rules.
* AI Insight: Render as an elegant, unbordered quote block with a subtle accent left border or faint tint.


4. **Active Tasks Table:**
* Remove all outer container cards and bounding boxes.
* Minimalist data rows separated solely by hairline horizontal dividers.
* Soft status and priority pill badges with pastel/muted colors. Generous row height (at least `56px`) to maximize legibility and breathing room.


5. **Navigation Sidebar:**
* Clean, ultra-minimalist navigation with subtle text hover states, transparent active indicators, and no harsh divider lines.