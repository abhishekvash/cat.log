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

## Checks

```bash
pnpm test        # vitest: game rules, room policy, catalog helpers
pnpm typecheck   # tsc
pnpm check       # biome: lint and format
```

## Layout

- `src/lib/catalog.ts`: every game on the site. The landing tiles, each intro page and its search tags read from it.
- `src/routes/`: pages. `index.tsx` is the landing page; each game has an intro page (`<game>/index.tsx`) and its play page.
- `src/lib/cats.ts` and `src/components/cats/`: the cats every game shares (faces, the sleepy cat, ears, background eyes, the kitten burst) and the one art palette.
- `src/components/catalog/`: the wordmark, loading screen, intro page layout, back link and game breadcrumb.
- `src/lib/seo.ts`: per-page title, description, canonical, share-card tags and structured data.
- `public/`: icons, the share card (`og.png`), `robots.txt`, `sitemap.xml` and the web app manifest.

**Meowstermind** (one shared screen)

- `src/lib/mastermind.ts`: the rules, a pure reducer saved to localStorage.
- `src/components/mastermind/`: the board, pins, trays and controls, and `usePinInput` for drag, drop and tap.

**Online games** (a room per game, one device per player)

- `src/lib/multiplayer/`: the shared room machinery. `types.ts` defines `GameDefinition`, what a game implements; `room.ts` is the pure room policy (seats, lobby, host, presence, timers, tidying up); `protocol.ts` is the wire format.
- `src/server/multiplayer/room-server.ts`: `createRoomServer(definition)`, the Durable Object shell that stores and broadcasts a room.
- `src/components/multiplayer/`: `RoomGate`, `RoomLobby`, `SeatList`, the room connection and context.
- Monopawly: its rules in `src/lib/monopawly/` (`definition.ts` plugs them into the rooms), its screens in `src/components/monopawly/`.

### Adding an online game

1. Write its rules as a `GameDefinition` in `src/lib/<game>/definition.ts`, with tests.
2. In `src/server.ts`, export `class <Game>Room extends createRoomServer(<game>) {}`. Add the binding and a `new_sqlite_classes` migration in `wrangler.jsonc`, then run `pnpm wrangler types`.
3. Add `src/routes/<game>/$code.tsx`: `roomRoute(<game>)` for the route options, and `<RoomGate>` with a `<RoomLobby>` and the play screen, which reads the room with `useRoom()`.
4. Add an intro page, an entry in `src/lib/catalog.ts`, a preview on the landing page and a line in `public/sitemap.xml`.

## Design

- `PRODUCT.md`: who the site is for and how it should feel.
- `DESIGN.md`: the visual system ("The Midnight Cat Café"). Keep it in sync with UI changes.
