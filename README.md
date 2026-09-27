# cat.log

**cat.log** is a catalog of small, cozy, cat-themed games to play together. **Meowstermind** is a two-player Mastermind with cats as code pins and paw prints as clues, played on one shared screen (usually an iPad). **Monopawly** is an online property game for 2 to 6 players in private rooms, each on their own tablet or computer.

Built with TanStack Start (file-based routes), Tailwind v4, shadcn/ui and dnd-kit. It deploys to Cloudflare Workers.

## Develop

pnpm only.

```bash
pnpm install
pnpm dev
```

## Deploy

Pushes to `main` deploy automatically through Cloudflare Workers Builds (the `cat-log` worker is connected to this repo). Cloudflare runs `pnpm run build`, then `npx wrangler deploy`.

To deploy by hand from your machine, log in once with `pnpm wrangler login`, then run:

```bash
pnpm run deploy   # builds, then runs wrangler deploy
```

Cloudflare worker names can't contain dots, so the worker is `cat-log`.

## Layout

- `src/routes/index.tsx`: the cat.log landing page and game tiles.
- `src/routes/meowstermind/`: the rules page (`index.tsx`) and the game (`play.tsx`).
- `src/lib/mastermind.ts`: game rules and state (a pure reducer, saved to localStorage).
- `src/components/mastermind/`: cat pins, paw pins, board ears, background eyes and the kitten burst.
- `src/components/catalog/`: the wordmark and the loading screen.
- `src/lib/seo.ts`: per-page title, description, canonical and share-card tags.
- `public/`: icons, the share card (`og.png`), `robots.txt`, `sitemap.xml` and the web app manifest. List new games in `sitemap.xml`.

## Design

- `PRODUCT.md`: who the site is for and how it should feel.
- `DESIGN.md`: the visual system ("The Midnight Cat Café"). Keep it in sync with UI changes.
