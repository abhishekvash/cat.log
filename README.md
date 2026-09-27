# cat.log

**cat.log** is a catalog of small, cozy, cat-themed games for two people sharing one screen, usually an iPad. The first game is **Meowstermind**, a two-player Mastermind with cats as code pins and paw prints as clues.

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

## Design

- `PRODUCT.md`: who the site is for and how it should feel.
- `DESIGN.md`: the visual system ("The Midnight Cat Café"). Keep it in sync with UI changes.
