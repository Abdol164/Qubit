# QUBIT

> **"Qubit deploys the first post-quantum key registry on Sui — any agent can build on top of it."**

Post-quantum secure communication layer for autonomous AI agents on Sui.

---

## The Problem

AI agents on Sui coordinate, transact, and pass instructions to each other **in plaintext**.

Today this is fine. When sufficiently powerful quantum computers arrive, every message ever sent becomes retroactively readable. Every instruction an agent issued. Every coordination signal. Every transaction it was authorized to execute. Attackers are already harvesting encrypted traffic today — betting they can decrypt it later. This is the **harvest-now, decrypt-later** threat.

The Agentic Web cannot be built on infrastructure that will be broken.

---

## What Qubit Is

Qubit is **not** a messaging app for humans.

Qubit is the **secure channel agents run on** — the protocol layer beneath autonomous AI systems that need to communicate, coordinate, and pass instructions without leaking their intent to eavesdroppers, classical or quantum.

Think of it like this:
- HTTP is not a website. It is the protocol websites run on.
- Qubit is not an agent. It is the protocol agents communicate through.

Any agent deployed on Sui can register a post-quantum public key on the Qubit registry. Any other agent can look up that key and send an instruction that only the recipient can decrypt — provably, mathematically, even against a future quantum adversary.

---

## The Demo

Two autonomous agents. No humans. Real Sui transactions.

```
[1/8] SPAWNING AUTONOMOUS AGENTS
  ✓  Agent Alpha       0x7c70...b01f9
  ✓  Agent Beta        0x81ef...d30

[2/8] FUNDING AGENTS VIA TESTNET FAUCET
  ✓  Agent Alpha       SUI received from faucet
  ✓  Agent Beta        SUI received from faucet

[3/8] GENERATING ML-KEM-768 KEYPAIRS  (NIST FIPS 203)
  ✓  Agent Alpha       pk=1184B  sk=2400B
  ✓  Agent Beta        pk=1184B  sk=2400B

[4/8] REGISTERING PUBLIC KEYS ON QUBIT REGISTRY  (ON-CHAIN)
  ✓  Agent Alpha       digest: E4Kz...
  ✓  Agent Beta        digest: 9fBp...

[5/8] AGENT ALPHA READS AGENT BETA'S KEY FROM ON-CHAIN REGISTRY
  ✓  Key fetched       1184B from 0x0b1eaea3...
  ✓  Verified          ML-KEM-768 public key — length valid ✓

[6/8] AGENT ALPHA ENCRYPTS INSTRUCTION WITH AGENT BETA'S PUBLIC KEY
  →  Plaintext         {"task":"sui_transfer","recipient":"0x7c70...","amount_mist":1000}
  ✓  ML-KEM encap      1088B ciphertext (quantum-resistant session key)
  ✓  AES-256-GCM       72B encrypted payload + 16B auth tag
  No classical or quantum computer can read this without Agent Beta's secret key.

[7/8] DELIVERING THROUGH QUBIT MESSAGING LAYER
  ✓  Sent              encrypted ciphertext → Qubit backend
  ✓  Received          Agent Beta fetched 1 message(s) from thread

[8/8] AGENT BETA DECRYPTS INSTRUCTION + EXECUTES SUI TRANSACTION
  ✓  Decrypted         {"task":"sui_transfer","recipient":"0x7c70...","amount_mist":1000}
  ✓  Executed          Sui digest: GhXm9...
  →  Explorer          https://suiexplorer.com/txblock/GhXm9...?network=testnet

  Zero human interaction.
  Zero plaintext on any wire or in the database.
  Quantum-resistant end-to-end.
```

Run it yourself:

```bash
bun install
bun agent-demo.ts
```

---

## How It Works

### The Key Registry (Sui Move Contract)

Deployed on Sui testnet. Any agent calls `register(registry, public_key)` once to publish its ML-KEM-768 public key on-chain. Any other agent can call `get_public_key(registry, address)` to look it up — no trust required, no intermediary, just Sui.

The registry is a **shared object** with O(1) lookups by address:

```move
public fun register(registry: &mut Registry, public_key: vector<u8>, ctx: &mut TxContext)
public fun get_public_key(registry: &Registry, addr: address): vector<u8>
public fun is_registered(registry: &Registry, addr: address): bool
```

**Package:** `0xb3234c0b8812692b8ea3f053fad61683632abe8e9b56d87dc76326f894236763`
**Registry:** `0x0b1eaea309922096c5294a7d016b36d93b82552ecaec6f60a7ac726c3c664d73`

### The Encryption Protocol (NIST FIPS 203)

Every message follows this protocol:

```
1. Sender looks up recipient's ML-KEM-768 public key from the on-chain registry.
2. ML-KEM encap(recipientPk) → [kemCiphertext (1088B), sharedSecret (32B)]
3. sharedSecret imported as AES-256-GCM key (non-extractable).
4. Random 12-byte IV generated.
5. AES-GCM encrypt(plaintext) → ciphertext (includes 16B auth tag).
6. {kemCiphertext, ciphertext, nonce} transmitted — all base64.

Recipient:
7. ML-KEM decap(kemCiphertext, secretKey) → sharedSecret
8. AES-GCM decrypt(ciphertext, sharedSecret, nonce) → plaintext
```

The server stores `{kemCiphertext, ciphertext, nonce}` only. **It never sees plaintext.**

ML-KEM-768 is secure against both classical and quantum adversaries (Kyber, standardized as FIPS 203). AES-256-GCM provides authenticated encryption — tampered ciphertext is rejected before decryption.

### Message Delivery

Qubit provides a NestJS backend + WebSocket gateway for real-time message delivery. Messages are JWT-authenticated at the transport layer; the crypto layer provides end-to-end security regardless.

Agents authenticate with their Sui address via HMAC-nonce challenge. The backend stores encrypted blobs and routes `message:new` events to connected sockets.

---

## Threat Model

| Threat | Status |
|--------|--------|
| Classical eavesdropper reading ciphertext | Blocked — AES-256-GCM |
| Quantum eavesdropper breaking key exchange | Blocked — ML-KEM-768 (FIPS 203) |
| Harvest-now, decrypt-later attacks | Blocked — per-message ephemeral keys |
| Server reading message content | Blocked — server stores ciphertext only |
| Tampered ciphertext accepted | Blocked — AES-GCM auth tag |
| Impersonating a registered agent | Blocked — on-chain key binding |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Sui (Move smart contract) |
| Key exchange | ML-KEM-768 (NIST FIPS 203 / `mlkem` library) |
| Symmetric encryption | AES-256-GCM (Web Crypto API) |
| Backend | NestJS + Prisma + PostgreSQL |
| Real-time | Socket.io WebSocket gateway |
| Frontend | React + Vite + Zustand + @mysten/dapp-kit |
| Auth | HMAC-nonce + JWT |

---

## Quick Start

**Prerequisites:** Bun, PostgreSQL, a Sui wallet with testnet SUI

```bash
# 1. Clone and install
git clone <repo>
cd Qubit
bun install

# 2. Configure
cp .env.example .env  # fill in DATABASE_URL and JWT_SECRET

# 3. Start the backend
cd apps/api
bun run start:dev

# 4. Start the frontend
cd apps/web
bun run dev

# 5. Run the agent demo (no backend required for crypto flow)
cd ../..
bun agent-demo.ts
```

---

## Why Sui

Sui's shared objects and O(1) table lookups make the registry efficient at scale — no traversal, no Merkle proofs, just direct address-keyed access. Move's type system ensures public keys are validated at 1184 bytes (the ML-KEM-768 standard) before being accepted.

Sui's parallelism means thousands of agents can register and look up keys concurrently without contention.

---

## Hackathon Track

Submitted to **Sui Overflow 2026 — Agentic Web (Core Track)**.

Qubit is infrastructure, not an application. It is the secure communication layer the Agentic Web needs to exist. We are not building an agent — we are building what every agent on Sui will eventually need to use.

---

*Built for Sui Overflow 2026.*
