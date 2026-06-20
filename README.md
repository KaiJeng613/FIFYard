# FIFYard

FIFYard is a Solana devnet application for collectible football player cards, verifiable on-chain player statistics, squad building, player market, and match predictions. Managers can assemble a starting XI, publish it on-chain, purchase players, and compare their squad's predicted win rate against any national team.

Live deployment: **[fifyard.vercel.app](https://fifyard.vercel.app)**

---

## Pages

### 01 / Team Studio — `/#squad`

The core squad builder. Select exactly 11 players across the correct positional slots for your chosen formation and publish the lineup to Solana devnet.

- **Formation switcher** — 4-3-3, 4-4-2, 3-5-2, 4-2-3-1. Switching formation **auto-adjusts** the selected roster: surplus players from over-represented positions are dropped (lowest-rated first) and the best available players from deficit positions are added automatically.
- **Live pitch view** — players render on a colour-coded pitch grid matching the chosen formation's slot layout.
- **Squad summary bar** — shows squad rating, formation, predicted win rate against the chosen opponent, team name input, and the Submit XI button.
- **Player Intelligence panel** — click any pitch card or list row to inspect full stats (PAC, SHO, PAS, DRI, DEF, STA) with animated rating bars.
- **On-chain publishing** — signs a Memo transaction via Phantom. The payload `{ app:"FIFYard", v:1, name, formation, playerIds, opponent, winRate, squadRating }` is stored permanently on devnet. Every successful publish produces a Solscan devnet link.
- **Validation** — the Submit XI button stays disabled until the lineup satisfies the exact positional count for the chosen formation.

### 02 / Players — `/#players`

The player market. Browse, filter, shortlist, and purchase player cards.

- **Sortable table** — all 27 players sortable by OVR, PAC, SHO, PAS, DRI, DEF, STA, or PRICE. Click any column header to sort; click again to reverse.
- **Position & search filters** — filter by GK / DEF / MID / FWD or by name.
- **Player detail panel** — full stat bars, market value in SOL, formation style analysis, and action buttons.
- **Shortlist** — star any player to add to your shortlist. Shortlisted players are highlighted with a gold border. The shortlist is written on-chain as a Memo transaction (`type:"shortlist"`) and restored automatically on wallet reconnect.
- **Buy player** — sends a real SOL transfer (devnet) to the treasury wallet plus a Memo receipt `{ type:"purchase", playerId, playerName, priceSOL, buyer }` in one atomic transaction. Phantom prompts for approval. On success the player is marked OWNED, auto-shortlisted, and a Solscan link appears.
- **Devnet floor prices** — scaled to 0.02–0.09 SOL so purchases are practical on a devnet airdrop balance.

### 03 / Predictions — `/#predictions`

Compare any published team against any set of national opponents.

- **Team selector** — choose one of your published teams or view all.
- **Opponent filter** — toggle country chip buttons (ARG, BRA, FRA, ENG, ESP, POR, MAS) to show only the matchups you care about.
- **Player roster strip** — shows each player's short name and OVR grouped by position (GK / DEF / MID / FWD).
- **Matchup cards** — one card per opponent showing:
  - Your team vs opponent with ratings side by side
  - Large win % coloured green (favoured), blue (even), or red (underdog)
  - Win / Draw / Loss probability bars
  - Plain-English explanation: squad OVR delta, forward count, midfield depth, defensive line, overall outlook
- **Formation style tags** — Attacking Forwards, Strong Midfield, or Solid Defense tags appear when a position group's average rating exceeds the squad average by more than 10%.

---

## Wallet & on-chain data

**Phantom** is the only supported wallet. Connect via the button in the top-right corner. Once connected:

- SOL balance is fetched directly via RPC with a 4-second timeout and automatic fallback across multiple devnet endpoints — no infinite loading.
- Balance is shown as a green pill inside the connected button.
- On wallet connect, published teams and the shortlist are fetched from on-chain Memo transactions and restored.
- Published teams history is accessible from the wallet dropdown → **Published teams**.

All devnet transactions are visible on Solscan with `?cluster=devnet`.

---

## URL routing

All three pages are directly linkable via URL hash:

| URL | Page |
|---|---|
| `https://fifyard.vercel.app/` | Team Studio |
| `https://fifyard.vercel.app/#squad` | Team Studio |
| `https://fifyard.vercel.app/#players` | Players Market |
| `https://fifyard.vercel.app/#predictions` | Predictions |

Browser back/forward buttons work correctly.

---

## On-chain data format

All FIFYard data is stored via the **Solana Memo program** (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) as UTF-8 JSON in Memo instructions. No custom program is required for devnet publishing.

### Team snapshot
```json
{ "app": "FIFYard", "v": 1, "name": "My Team", "formation": "4-3-3",
  "playerIds": [13,8,9,10,11,4,5,6,0,1,2], "opponent": "ARG",
  "winRate": 42, "squadRating": 89 }
```

### Shortlist
```json
{ "app": "FIFYard", "v": 1, "type": "shortlist", "playerIds": [0,4,13] }
```

### Player purchase receipt
```json
{ "app": "FIFYard", "v": 1, "type": "purchase", "playerId": 1,
  "playerName": "Kylian Mbappé", "priceSOL": 0.09, "buyer": "<address>", "ts": 1718867115000 }
```

The purchase transaction also contains a `SystemProgram.transfer` instruction sending the SOL amount to the treasury, making the purchase payment and receipt atomic.

---

## Local development

Prerequisites: Node.js 20+ and npm.

```bash
cd frontend
npm install
npm run dev
```

Production build:

```bash
cd frontend
npm run build
```

---

## Planned enhancements

### Real-time player statistics

Currently player stats (pace, shooting, passing, dribbling, defending, stamina, overall) are seeded from a static dataset. The planned architecture:

1. **Licensed data feed** — ingest from a provider (e.g. StatsBomb, Opta) after each match week.
2. **Normalisation worker** — map raw match events to 0–100 ratings using the position-weighted formula already in `prediction.ts`. Sign the payload with a statistics authority key.
3. **On-chain update** — authority calls `update_player` on the FIFYard Anchor program, incrementing `data_version` and `updated_at` on each Player PDA.
4. **Indexer** — listens for `update_player` events and regenerates NFT metadata JSON so marketplaces see fresh traits.
5. **Frontend** — replaces the static `players.ts` array with fetched Player PDA accounts; ratings update live without a redeploy.

### Player win rates

Per-player win rate contribution is not yet tracked individually. The planned approach:

1. After each published squad's match result is known (via an oracle or match result authority), record `{ playerId, opponent, result }` in a Match Result PDA.
2. Each Player PDA accumulates `wins`, `draws`, `losses`, and a rolling ELO-style contribution score.
3. The Predictions page can then show **individual player impact** — how much each player raises or lowers the squad's win probability — rather than a single squad-level heuristic.
4. Managers can identify their highest-impact players per opponent and optimise squad selection data-driven rather than by rating alone.

### Further roadmap

| Feature | Notes |
|---|---|
| Custom Anchor program for `create_squad` | Replaces Memo publishing; enforces ownership, formation, and rating on-chain |
| NFT mints per player | SPL Token or Token-2022 mint linked to each Player PDA |
| Real SOL marketplace | Peer-to-peer player transfers with royalty enforcement |
| Match oracle | On-chain result authority feeding win/loss data back to Player PDAs |
| Squad ELO history | Persistent per-wallet performance ledger across published squads |
| Formation analytics | Aggregate win-rate heatmap by formation across all published teams on-chain |
| Mobile-responsive layout | Sidebar collapses to bottom nav on small screens |
| Compressed NFTs (cNFTs) | Drastically lower mint cost for a large player catalogue using Bubblegum |

---

## Security and production gaps

- This is **unaudited MVP code** and must not be used on mainnet as-is.
- Player stats are static; they do not reflect real-world performance.
- The statistics authority is a single keypair; use a multisig or oracle quorum in production.
- Ownership checks currently use classic SPL Token accounts, not Token-2022 or compressed NFTs.
- Player identity, licensing, data-provider rights, transfer royalties, collection verification, and dispute handling require product and legal decisions before any mainnet launch.
- Add Anchor integration tests covering forged token accounts, duplicate players, incorrect mint ownership, formation edge cases, and authority rotation before deployment.
