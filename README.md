# FIFYard

FIFYard is a Solana devnet MVP for collectible football players, verifiable player statistics, and on-chain 11-player squads.

The repository contains:

- An Anchor/Rust program in `programs/fifyard`
- A responsive React/Vite squad-building UI in `frontend`
- Devnet configuration in `Anchor.toml`

## Product experience

The frontend follows a collectible-vault model inspired by physical-card marketplaces:

- **Player Vault:** browse unique player cards with live ratings, position filters, collection value, floor-price placeholders, and card/list layouts.
- **Simulation profiles:** customize pace/running, kicking/shooting, passing, ball control, defending, and stamina. These are user-owned simulation values; they never overwrite official oracle statistics.
- **Country Team Studio:** choose a country, formation, opponent, and exactly eleven owned players.
- **Prediction model:** shows win/draw/loss probabilities from squad rating, opponent strength, and formation validity. The current model is an explainable heuristic, not a trained model or betting product.
- **Devnet publishing:** signs a compact team snapshot with Phantom, publishes it through Solana's Memo program, and returns a Solscan devnet transaction link.

## What is implemented

### Player accounts

Each player is a program-derived account (PDA) containing:

- Stable player ID, name, and position
- The public key of the player's NFT mint
- Pace, shooting, passing, dribbling, defending, and stamina (0–100)
- A position-weighted overall rating
- Metadata URI, data version, and last-update timestamp

Only the configured statistics authority can create players or update ratings. Every change increments the player's version.

### Collectible ownership and squads

The NFT represents ownership; the Player PDA represents canonical, mutable sports data. `create_squad` requires 11 unique Player PDAs plus 11 matching classic SPL Token accounts. It verifies that the signer holds each player's token, checks minimum positional rules, and calculates the squad rating from player accounts rather than trusting the client.

Supported MVP formations are `4-3-3`, `4-4-2`, `3-5-2`, and `4-2-3-1`. The program enforces the exact goalkeeper/defender/midfielder/forward count encoded by the selected formation.

The Squad account also records a three-letter country code, opponent rating, and deterministic predicted win rate in basis points. This lets other Solana applications inspect the inputs and reproduce the contract result.

## Phantom wallet and Solscan

Phantom is intentionally the default and only wallet provider used by the current UI. Connecting Phantom does not transfer funds or give FIFYard custody. It exposes the wallet's public address and lets the owner approve specific transactions.

The wallet enables:

1. Proving which player NFTs the user owns.
2. Signing team-formation publications and paying the small devnet transaction fee.
3. Future player purchases, sales, transfers, prediction entries, and reward claims.
4. Associating on-chain squads with the user's public address.

Every successful team publication links to:

```text
https://solscan.io/tx/<SIGNATURE>?cluster=devnet
```

The header also links to the configured FIFYard program account on Solscan. Until the Anchor program is deployed and seeded, the live publish button uses the standard Memo program. Once deployment is complete, replace that call with the generated Anchor `create_squad` client instruction; Solscan will then display FIFYard as the interacting program.

## Why stats should not live only in NFT metadata

NFT JSON is useful for artwork and a readable trait snapshot, but it normally lives off-chain and can become stale. FIFYard instead uses two linked records:

1. **NFT mint + metadata:** collectible identity, image, edition, display traits, and update authority.
2. **Player PDA:** compact canonical stats used by contracts, games, and squad validation.

The Player PDA stores the NFT mint so consumers can verify the relationship. When statistics change, an indexer can regenerate metadata JSON from the PDA, while on-chain applications continue to read the authoritative PDA.

For production, the update authority should be a multisig or an oracle service. A practical ingestion pipeline is:

`licensed data feed → normalization/signing worker → authority transaction → Player PDA → indexer/API → refreshed NFT metadata`

Store only normalized ratings and a hash/version of the source dataset on-chain. Raw match events are too large and expensive; keep them in durable object storage or a permanent-content network and anchor their hash in the update transaction.

## Local frontend

Prerequisites: Node.js 20+ and npm.

```bash
cd frontend
npm install
npm run dev
```

The current UI uses demo player data because no Player PDAs exist until the program is deployed and seeded. Phantom connection and Memo-based devnet publishing are live. Direct `create_squad` submission still requires a deployed program ID, generated IDL, NFT mints, and token accounts.

Production build:

```bash
cd frontend
npm run build
```

## Build and deploy to devnet

`solana.new` has been installed for this environment. Its setup script installs agent skills; it does not install Rust, the Solana CLI, or Anchor. Install those prerequisites before running the contract commands.

Then configure and fund a devnet wallet:

```bash
solana config set --url devnet
solana-keygen new
solana airdrop 2
solana balance
```

Build with Anchor, synchronize the generated deployment key with the source, rebuild, and deploy:

```bash
anchor build
anchor keys sync
anchor build
anchor deploy --provider.cluster devnet
```

`anchor keys sync` replaces the temporary valid program ID currently committed in `declare_id!` and `Anchor.toml` with the deploy key generated under `target/deploy`.

After deployment:

1. Run `initialize` once with the intended statistics authority.
2. Create one NFT mint per player using classic SPL Token for this MVP.
3. Call `create_player` with that mint, player identity, initial stats, and metadata URI.
4. Copy `target/idl/fifyard.json` into the frontend and add an Anchor client.
5. Replace demo records with fetched Player PDA accounts and submit `create_squad` using each Player PDA/token-account pair as remaining accounts.

## Security and production gaps

- This is unaudited MVP code and should not be used on mainnet as-is.
- The current ownership check supports classic SPL Token accounts, not Token-2022 or compressed NFTs.
- The statistics authority is a single key; use a multisig/oracle quorum in production.
- Player identity, licensing, data-provider rights, transfer royalties, collection verification, and dispute handling need product/legal decisions.
- Add Anchor integration tests covering forged token accounts, duplicate players, incorrect mint ownership, formation edge cases, and authority rotation before deployment.
