---
name: cat.log
description: A catalog of cozy, sly, gentle cat games for two people sharing one screen.
colors:
  velvet-dusk: "oklch(0.2 0.035 305)"
  velvet-dusk-raised: "oklch(0.25 0.04 305)"
  velvet-dusk-muted: "oklch(0.31 0.045 305)"
  velvet-dusk-hover: "oklch(0.34 0.05 310)"
  dusk-seam: "oklch(0.36 0.05 310)"
  strawberry-milk: "oklch(0.8 0.12 350)"
  strawberry-milk-ink: "oklch(0.22 0.04 320)"
  moon-milk: "oklch(0.95 0.02 340)"
  lavender-whisper: "oklch(0.74 0.05 320)"
  well: "oklch(0.14 0.03 305)"
  paw-pink: "#ff7eb0"
  paw-white: "#fff4f8"
  lurking-green: "#8fdc4f"
  hiss-red: "oklch(0.65 0.2 15)"
typography:
  display:
    fontFamily: "Fredoka Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(3rem, 6vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.25
  headline:
    fontFamily: "Fredoka Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontFamily: "Fredoka Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
  body:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.1em"
  log:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  tray: "16px"
  field: "20px"
  card: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.strawberry-milk}"
    textColor: "{colors.strawberry-milk-ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.velvet-dusk}"
    textColor: "{colors.moon-milk}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.velvet-dusk-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.moon-milk}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.velvet-dusk-muted}"
    textColor: "{colors.moon-milk}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.velvet-dusk-raised}"
    textColor: "{colors.moon-milk}"
    rounded: "{rounded.card}"
    padding: "20px"
  tag-chip:
    backgroundColor: "transparent"
    textColor: "{colors.lavender-whisper}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: cat.log

## 1. Overview

**Creative North Star: "The Midnight Cat Café"**

cat.log is a warm, dim room after closing time. The lights are low, the chairs are soft, a few cats are asleep on the counter and a couple more are watching from the dark corners. Two people sit across one iPad and play something quiet together. Everything on screen should feel like it belongs in that room: velvety dusk surfaces, soft lamplight pink for the things you touch, and cats that are the unmistakable stars of every screen.

The system is **dark by conviction, not by fashion**. The scene is an evening on a couch with the lights down, where a bright white page would glare. Density is low and pace is unhurried: large pieces, generous spacing, one clear thing to do per moment. Personality lives in small, discoverable details (glowing eyes that blink out of sync, a sleepy cat guarding the code, an ear that flicks now and then, a burst of kittens that drifts down like confetti) rather than in loud decoration. As PRODUCT.md puts it: *delight should feel like a purr, not an alarm.*

This system explicitly rejects the **mobile-game casino** (flashing rewards, coins, pushy "play again!"), the **loud neon gamer** (RGB glows, aggressive angles), anything **childish or babyish** (primary colors, clip art), and **generic SaaS / AI slop** (gradient blobs, glassy cards, stock icons, templated landing pages).

**Key Characteristics:**
- Velvet Dusk plum surfaces with a single Strawberry Milk accent for interaction.
- Sticker-style SVG cats with a light sticker border, so even the black cat pops on the dark board.
- Round but quiet UI: pills and soft corners, restrained so the cats stay the stars.
- Soft lift: raised surfaces one shade lighter plus one deep, diffuse shadow.
- Touch-first geometry: nothing interactive smaller than a comfortable fingertip.
- Ambient life at the edges: blinking cat eyes live in the empty background, never over play. Each pair picks the first free spot from a few candidates and stays hidden if every spot would overlap content.

## 2. Colors: The Velvet Dusk Palette

A restrained night palette: plum-tinted neutrals carry almost everything, one warm pink accent marks what you can touch, and the cats bring the only other color.

### Primary
- **Strawberry Milk** (`oklch(0.8 0.12 350)`): the one accent. Primary buttons, focus rings, the active row's glow, the "stermind" and ".log" in wordmarks, the "Purrfect!" headline, scores in the scoreboard. Text on it is **Strawberry Milk Ink** (`oklch(0.22 0.04 320)`), never white.

### Secondary
- **Paw Pink** (#ff7eb0) and **Paw White** (#fff4f8): the scoring paws only. Pink means right cat, right spot; white means right cat, wrong spot. These are game semantics, not decoration; they appear nowhere else as flat color.

### Tertiary
- **Lurking Green** (#8fdc4f): the glowing irises of the black cats watching from the background. Ambient only, never on interactive elements.
- **The five coats**: grey (#a7b0bb), white (#fbf8f4), black (#2d2a31), ginger (#f4a259) and siamese (#e9d3b1 with #2f2724 points). These are the code pieces; each also differs by eye color and markings so no two cats are told apart by fur alone.

### Neutral
- **Velvet Dusk** (`oklch(0.2 0.035 305)`): the page, the night. Lit by two very soft radial glows, pink at top-left and violet at bottom-right, at 12% opacity.
- **Velvet Dusk Raised** (`oklch(0.25 0.04 305)`): cards, the board, trays, the paw box.
- **Velvet Dusk Muted** (`oklch(0.31 0.045 305)`): input fields and secondary fills.
- **Velvet Dusk Hover** (`oklch(0.34 0.05 310)`): hover fill for outline and ghost buttons.
- **Dusk Seam** (`oklch(0.36 0.05 310)`): every border and divider; 1px, always.
- **Moon Milk** (`oklch(0.95 0.02 340)`): primary text. Never pure white.
- **Lavender Whisper** (`oklch(0.74 0.05 320)`): secondary text, hints, labels, row numbers.
- **Well** (`oklch(0.14 0.03 305)`): the pressed-in dark of board holes (70%) and preview wells (60%). Replaces any use of black.
- **Hiss Red** (`oklch(0.65 0.2 15)`): destructive states only. Currently unused; keep it that way unless something is genuinely destructive.

### Named Rules
**The One Lamp Rule.** Strawberry Milk is the only lamp in the room. It marks interaction and celebration and covers well under 10% of any game screen. If two pink things compete for attention, one of them is wrong.

**The Cats Bring the Color Rule.** Chrome stays in plum and milk tones so the five coats and two paws are the most colorful things on screen. Never introduce a new saturated hue for UI.

## 3. Typography

**Display Font:** Fredoka Variable (with ui-rounded, system-ui)
**Body Font:** Nunito Variable (with ui-rounded, system-ui)
**Log Font:** the system monospace (ui-monospace, SF Mono, Menlo)

**Character:** Fredoka is round and bubbly, the café's chalkboard sign; Nunito is soft and very readable, the friendly menu underneath. A dash of monospace nods to the `.log` in cat.log: it lives only in the wordmark. All three are self-hosted via Fontsource; nothing loads from Google.

### Hierarchy
- **Display** (600, clamp(3rem, 6vw, 3.75rem), 1.25): the landing welcome only ("Welcome to cat.log").
- **Headline** (600, 2.25rem, 1.1): a game's own title page ("Meowstermind").
- **Title** (600, 1.25–1.5rem, 1.33): game tile names, "Who's playing?", turn prompts ("Mochi, hide the code"). "Purrfect!" steps up to 1.875rem in Strawberry Milk.
- **Body** (400, 1rem to 1.125rem for lead text, 1.5): instructions and descriptions. Cap at 65–75ch.
- **Body Small** (400, 0.875rem, 1.43): hints, card blurbs, button labels.
- **Label / Overline** (500, 0.75rem, 0.1em tracking, uppercase, Lavender Whisper): quiet section labels such as "ROUND 1", "TRY 3 OF 10", "KITTIES", "PAW BOX" and the board's "CODE". One shared `text-overline` utility; never restyle it ad hoc.
- **Log** (monospace): the ".log" in the cat.log wordmark, and nowhere else.

### Named Rules
**The 12px Floor Rule.** No text below 12px, anywhere, including board numbers and hints. If a label doesn't fit at 12px, the layout gives it room.

**The Chalkboard and Menu Rule.** Fredoka for anything you'd write on the café's chalkboard (titles, names, scores, buttons); Nunito for anything you'd read at the table (sentences). Never set a full sentence of instructions in Fredoka.

**The Wordmark-Only Mono Rule.** Monospace appears only as the ".log" in the cat.log wordmark. No terminal prompts, status lines or mono labels; the pun lands once.

## 4. Elevation

Soft lift. Surfaces rise from the night by being one shade lighter (Velvet Dusk Raised) and by a single deep, diffuse shadow that pools below them like lamplight falling off a table edge. Pieces you can pick up (cats and paws) are the only things that cast small, crisp shadows, like stickers lifted off a page. Board holes are the one inverted depth: they are pressed in, with an inset shadow.

### Shadow Vocabulary
- **Table shadow** (`shadow-table`: `0 20px 50px -20px oklch(0.08 0.02 305 / 0.7)`): the board, the names card, game tiles. One per surface, never stacked.
- **Sticker shadow** (`drop-shadow-sticker`: `0 2px 2px oklch(0.08 0.02 305 / 0.45)`): cat and paw pieces, so they read as physical tokens.
- **Pressed hole** (`shadow-hole`: `inset 0 2px 4px oklch(0.08 0.02 305 / 0.55)`): empty slots on the board and in legends, over Well, with a faint paw print inside.
- **Lamp glow** (`shadow-lamp`: `0 0 30px -8px oklch(0.8 0.12 350 / 0.5)`): the paw box while the mastermind is scoring. The only glowing surface.
- **Eye glow** (`filter: drop-shadow(0 0 6px rgb(143 220 79 / 0.55))`): background cat eyes only.

### Named Rules
**The One Shadow Rule.** A surface gets exactly one shadow. If depth needs a second shadow to read, the tonal step is wrong.

**The Only Things That Glow Rule.** Glow is reserved for the active paw box and the lurking eyes. Nothing else glows; a glowing button is a neon-gamer tell.

## 5. Components

Round but quiet: friendly, fully rounded shapes that step back so the cats stay the stars.

### Buttons
- **Shape:** full pill (9999px) everywhere.
- **Sizes:** 44px is the floor for every size (`sm` and `default` are both 44px); `lg` is 48px for the main action on each screen. Icon buttons are 44px square.
- **Primary:** Strawberry Milk fill, Strawberry Milk Ink text, Fredoka 500 with slight tracking; 48px tall for main actions ("Start match", "Confirm score", "Next round: Biscuit hides"). Labels that include a player's name may wrap onto two balanced lines rather than overflow.
- **Hover / Focus / Active:** fill dims to 90% on hover; focus shows a 3px Strawberry Milk ring at 50%; a tap presses the button to 97% scale (skipped under reduced motion), because iPads have no hover. Disabled drops to 50% opacity and ignores taps.
- **Confirm-in-place:** destructive actions (resetting a match) never open a dialog. The first tap arms the button, which turns outline with Strawberry Milk text and border and reads "Tap again to reset scores"; a second tap confirms; it disarms by itself after 3.5s.
- **Outline:** Velvet Dusk fill, 1px Dusk Seam border, Moon Milk text; hover moves to Velvet Dusk Hover. For secondary actions ("Random code", "Hold to peek at code").
- **Ghost:** no fill, Moon Milk text, hover fill only. For tertiary actions ("New match", "Let player edit guess").
- **Copy:** the button names the outcome, often with the person ("Next round: Biscuit hides"), never a generic "Continue".

### Chips
- **Style:** transparent fill, 1px Dusk Seam border, Lavender Whisper text, pill shape, 2px 10px padding. Game tile tags ("2 players", "Pass & play").
- **Scoreboard chip:** same shape with the name in Fredoka and the score in Strawberry Milk; the current mastermind's chip gets a Strawberry Milk tint (10%) and border (50%).

### Cards / Containers
- **Corner Style:** 24px on cards and the board; 16px on trays and inner preview wells.
- **Background:** Velvet Dusk Raised; inner wells use black at 20% over it.
- **Shadow Strategy:** Table shadow (see Elevation).
- **Border:** 1px Dusk Seam. "Coming soon" placeholders use a dashed border over a 40% raised fill.
- **Internal Padding:** 12px on the board (the pieces need the room), 20–24px on content cards.
- **Cat ears:** featured surfaces (the board, the names card, game tiles) wear two SVG ears that grow out of the top edge: Velvet Dusk Raised fill, Dusk Seam outline, pink inner ear at 75%. The left ear flicks every 6.5s.

### Inputs / Fields
- **Style:** Velvet Dusk Muted fill, 1px Dusk Seam border, 20px radius, 44px tall, 16px text (prevents iOS zoom).
- **Focus:** Strawberry Milk border plus a 3px ring at 50%.
- **Labels:** above the field, 8px gap, Nunito 500 in Lavender Whisper, inset 12px so the label's first letter aligns with the typed text.

### Navigation
- **Targets:** header links and back links carry vertical padding so each is at least 44px tall, with the same 3px focus ring as buttons.
- **Style:** a slim top bar with a breadcrumb, `cat.log / Meowstermind`: the wordmark in Lavender Whisper (Moon Milk on hover), a faint slash, then the game name in Fredoka with a cat icon in Strawberry Milk. On phones the `cat.log /` prefix hides and "New match" collapses to its icon. Back links on content pages read "← Back to cat.log".

### Cat Pieces (signature component)
Sticker-style SVG cat heads: pointy ears with pink insides, a wide round face, big glossy eyes with a white catch-light, blush cheeks, a tiny pink nose and an "ω" mouth, all outlined in near-black (#2a1f26) and wrapped in an 11px Paw White sticker border. Board slots size them from `--pin` (up to 48px); tray pieces are 44px. The hidden code shows as muted plum **sleepy cats** with closed eyes and a small pink "z".

### Paw Pieces (signature component)
Glossy round tokens (pink or white) with a paw print pressed into them, rendered at half the size of a cat. Empty score holes are pressed holes with a faint paw.

### Hit Areas
Holes are sized by the board, not by fingers, so their tap and drop areas reach invisibly into the gaps around them without moving the layout: cat holes catch taps across 46px or more; paw holes, whose neighbours sit close together sideways, grow vertically to 44px tall.

### Loading and Lost Pages
- **Loading:** any route still arriving shows a sleepy cat and "Waking the kitties…" in Lavender Whisper, centred on the night background. It is registered once on the router so every game inherits it.
- **Not found:** a sleepy cat, the title "This page wandered off", the line "It's probably napping somewhere warm." and one primary button, "Back to cat.log". No error codes shown to players.

## 6. Do's and Don'ts

### Do:
- **Do** keep every screen in Velvet Dusk (`oklch(0.2 0.035 305)`) with Moon Milk text; the room is always dim.
- **Do** reserve Strawberry Milk for interaction and celebration, under 10% of any game screen (The One Lamp Rule).
- **Do** make cats the most colorful, most detailed things on screen; UI chrome stays in plum and milk tones.
- **Do** give every touch target at least 44px (buttons: 44px floor, 48px for the main action), and give small drop targets a larger hit area than their visual.
- **Do** use the shared tokens (`bg-well`, `shadow-table`, `shadow-hole`, `shadow-lamp`, `drop-shadow-sticker`, `text-overline`) instead of one-off values.
- **Do** put personality in small ambient details (blinking eyes, a sleepy cat, a flicking ear) placed in empty space, away from the board. Background eyes check the page and keep 20px clear of any text, control, piece or card.
- **Do** balance wrapped groups: trays of pieces center their rows (3 + 2, not 2 + 2 + 1), and cards keep chips on one line by moving the primary affordance ("Play →") beside the title.
- **Do** make celebrations physical and soft: kittens burst out, slow against the air and drift down like confetti over about 7 seconds.
- **Do** honor `prefers-reduced-motion` for every decorative animation: no burst, no blinking, no twitch.
- **Do** use exponential ease-outs for UI transitions; keep state changes at 150–200ms.

### Don't:
- **Don't** drift toward a **mobile-game casino**: no flashing rewards, coins, streak counters, ads, badges, or pushy "play again!" prompts.
- **Don't** look like a **loud neon gamer**: no RGB glows, no aggressive angles, no esports energy. Only the paw box and the lurking eyes glow.
- **Don't** go **childish or babyish**: no primary red/blue/yellow, no clip art, no toddler-toy shapes. Cute, but made for grown-ups.
- **Don't** produce **generic SaaS / AI slop**: no gradient blobs, no glassy or blurred cards, no stock icon grids, no templated hero-plus-feature-grid pages.
- **Don't** use pure black (#000) or pure white (#fff); every neutral is tinted toward plum.
- **Don't** use gradient text, or colored side-stripe borders thicker than 1px.
- **Don't** stack shadows or add glow to buttons (The One Shadow Rule).
- **Don't** put decoration, confetti rules or background eyes on top of the board or the controls during a turn; play comes before chrome.
- **Don't** set sentences in Fredoka, and don't use monospace outside the wordmark.
- **Don't** add a new saturated hue for UI; the cats already bring the color.
- **Don't** reach for a modal or `window.confirm`; confirm in place (see Buttons).
- **Don't** set any text below 12px (The 12px Floor Rule).
