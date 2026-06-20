# Qubit — Post-Quantum Messaging on Sui
## Agent Roadmap (Sui Overflow 2026 — Infra & DevX Track)

---

## Project Summary

**Qubit** is a post-quantum encrypted messaging app built on Sui. Users authenticate via zkLogin (Google/Apple) or a Sui wallet. A ML-KEM-768 keypair is generated client-side and stored in localStorage. The user's public key is registered on-chain via a Sui Move contract. Messages are encrypted client-side, stored as ciphertext in Postgres, and decrypted client-side by the recipient. The server is a dumb pipe — it never sees plaintext.

**Stack:**
- Frontend: React + Vite + Tailwind CSS + Sui Wallet Kit + zkLogin
- Backend: NestJS + Prisma + PostgreSQL + WebSockets (Socket.io)
- Blockchain: Sui (Move smart contract — key registry)
- Crypto: ML-KEM-768 (via `liboqs-wasm` or `crystals-kyber` JS library) + AES-256-GCM
- State: Zustand
- Package manager: `bun`

**Design system:** Brutalist — 0px border radius, heavy black borders, uppercase labels, `#0a0a0a` / `#E60023` / white palette, Inter + JetBrains Mono fonts.

---

## Phase 1 — Move Contract (Key Registry)

### Task 1.1 — Scaffold Move project
- Init a Move project under `packages/qubit-contract/`
- Configure `Move.toml` with Sui testnet dependency
- Create module `qubit::registry`

### Task 1.2 — Define data structures
```move
public struct UserProfile has key, store {
    id: UID,
    owner: address,
    mlkem_public_key: vector<u8>,
    created_at: u64,
}

public struct Registry has key {
    id: UID,
    profiles: Table<address, ID>,
}
```

### Task 1.3 — Implement Registry init
- `fun init(ctx: &mut TxContext)` — create shared Registry object on deploy

### Task 1.4 — Implement register function
- `public entry fun register(registry: &mut Registry, public_key: vector<u8>, ctx: &mut TxContext)`
- Assert caller has no existing profile
- Create UserProfile, add to Registry table keyed by sender address

### Task 1.5 — Implement update_key function
- `public entry fun update_key(profile: &mut UserProfile, new_key: vector<u8>, ctx: &mut TxContext)`
- Assert caller is profile owner
- Update `mlkem_public_key` field

### Task 1.6 — Implement get_profile view function
- `public fun get_public_key(registry: &Registry, owner: address): vector<u8>`
- Return ML-KEM public key bytes for a given address

### Task 1.7 — Deploy to Sui testnet
- Run `sui client publish`
- Save published package ID and Registry shared object ID to `.env`
- Verify on Sui Explorer

---

## Phase 2 — Backend (NestJS)

### Task 2.1 — Scaffold NestJS project
- Init under `apps/api/`
- Install: `@prisma/client`, `prisma`, `@nestjs/websockets`, `socket.io`, `@mysten/sui`
- Configure `bun` scripts

### Task 2.2 — Prisma schema
```prisma
model User {
  id        String   @id @default(uuid())
  address   String   @unique  // Sui wallet address
  nickname  String?
  createdAt DateTime @default(now())
  sentMessages     Message[] @relation("sender")
  receivedMessages Message[] @relation("recipient")
}

model Message {
  id             String   @id @default(uuid())
  senderId       String
  recipientId    String
  kemCiphertext  String   // base64 — ML-KEM encapsulation output
  ciphertext     String   // base64 — AES-256-GCM encrypted message
  nonce          String   // base64 — AES-GCM nonce
  createdAt      DateTime @default(now())
  sender         User     @relation("sender",    fields: [senderId],    references: [id])
  recipient      User     @relation("recipient", fields: [recipientId], references: [id])
}
```

### Task 2.3 — Auth module
- `POST /auth/login` — accepts Sui address + signed nonce (or zkLogin JWT)
- Verify signature using `@mysten/sui` verifyPersonalMessage
- Return JWT session token
- Create User record if first login

### Task 2.4 — Users module
- `GET /users/:address` — return user profile (address, nickname)
- `GET /users/search?address=` — lookup by Sui address

### Task 2.5 — Messages module
- `POST /messages` — accept `{ recipientAddress, ciphertext, nonce }`, store in Postgres
- `GET /messages/:address` — return message thread between authed user and address (ciphertext only)

### Task 2.6 — WebSocket gateway
- Authenticate WebSocket handshake using the session JWT (reject unauthenticated connections)
- On new message saved → emit `message:new` event to recipient's socket room
- Rooms keyed by Sui address
- Payload: `{ id, senderId, ciphertext, kemCiphertext, nonce, createdAt }`

### Task 2.7 — Sui RPC integration
- The client (not the server) submits the `register()` tx directly — server has no Sui wallet, pays no gas
- On message send → client fetches recipient public key from Sui chain before encrypting
- Server only stores and forwards ciphertext blobs — it never participates in key operations

---

## Phase 3 — Crypto Layer (Client-side)

### Task 3.1 — Install PQC library
- Install `mlkem` (npm package implementing ML-KEM-768, FIPS 203)
- Verify it works in Vite/browser environment
- Fallback: use `crystals-kyber` WASM build if `mlkem` has browser issues

### Task 3.2 — Key generation utility
```ts
// lib/crypto/keygen.ts
export async function generateMLKEMKeypair(): Promise<{ pk: Uint8Array; sk: Uint8Array }>;
export function saveKeypairToStorage(pk: Uint8Array, sk: Uint8Array): void;
export function loadKeypairFromStorage(): { pk: Uint8Array; sk: Uint8Array } | null;
```
> **Security note:** Storing the raw SK in localStorage is vulnerable to XSS. For production, wrap the SK with a Web Crypto AES key (`extractable: false`) derived from a user password, and store the encrypted blob in IndexedDB. Document this limitation in the README for the hackathon submission.

### Task 3.3 — Encryption utility
```ts
// lib/crypto/encrypt.ts
// 1. Fetch recipient ML-KEM public key (from Sui on-chain)
// 2. ML-KEM encapsulate → { ciphertext: Uint8Array, sharedSecret: Uint8Array }
// 3. AES-256-GCM encrypt message with sharedSecret
// 4. Return { kemCiphertext, aesCiphertext, nonce } all as base64
export async function encryptMessage(recipientPk: Uint8Array, plaintext: string): Promise<EncryptedPayload>;
```

### Task 3.4 — Decryption utility
```ts
// lib/crypto/decrypt.ts
// 1. Load ML-KEM private key from localStorage
// 2. ML-KEM decapsulate(sk, kemCiphertext) → sharedSecret
// 3. AES-256-GCM decrypt aesCiphertext with sharedSecret + nonce
// 4. Return plaintext string
export async function decryptMessage(sk: Uint8Array, payload: EncryptedPayload): Promise<string>;
```

---

## Phase 4 — Frontend (React)

### Task 4.1 — Project scaffold
- Init under `apps/web/`
- Install: `@mysten/dapp-kit`, `@mysten/sui`, `@mysten/zklogin`, `zustand`, `socket.io-client`, `mlkem`
- Configure Tailwind CSS with brutalist design tokens
- Set up TanStack Router with routes: `/`, `/login`, `/chat`, `/chat/:address`

### Task 4.2 — Auth store (Zustand)
```ts
// store/authStore.ts
interface AuthStore {
  address: string | null;
  sessionToken: string | null;
  mlkemPk: Uint8Array | null;
  mlkemSk: Uint8Array | null;
  login: (address: string, token: string) => void;
  logout: () => void;
  loadKeypair: () => void;
}
```

### Task 4.3 — Login page
- Two options side by side:
  - "Sign in with Google" → zkLogin flow
  - "Connect Wallet" → Sui wallet adapter
- On success:
  - Check localStorage for ML-KEM keypair
  - If none → generate → save to localStorage
  - Check if public key registered on Sui → if not → call `register()`
  - Redirect to `/chat`

### Task 4.4 — Chat list page (`/chat`)
- Show list of recent conversations (grouped by address)
- Each row: truncated address (`0x4f3a...c2d1`) + localStorage nickname if set + last message preview (show "Encrypted message" — never decrypt in list view) + timestamp
- "New Chat" button → input a Sui address to start a new thread

### Task 4.5 — Chat thread page (`/chat/:address`)
- Fetch message thread from backend on load
- Decrypt each message client-side using `decryptMessage()`
- Render decrypted plaintext in chat bubbles
- Message input at bottom → on send:
  - Fetch recipient public key from Sui
  - `encryptMessage()` → POST to backend
  - Optimistically append to thread
- WebSocket listener → on `message:new` → decrypt + append

### Task 4.6 — Nickname system
- Small "edit" icon next to address in chat header
- Save nickname to localStorage keyed by address
- Display nickname everywhere in place of truncated address

### Task 4.7 — Connection status indicator
- Small dot in header: green = WebSocket connected, red = disconnected
- Auto-reconnect on disconnect

---

## Phase 5 — Demo Polish

### Task 5.1 — "Proof" panel for demo
- Collapsible panel in chat UI (toggle with a button)
- Shows raw ciphertext of the last sent/received message
- Label: "What the server sees ↑" / "What you see ↓"
- This is the money shot for the video demo

### Task 5.2 — Quantum threat explainer screen
- `/about` route or modal
- One screen explaining: classical encryption (RSA/ECC) is broken by Shor's algorithm on quantum computers → ML-KEM is NIST FIPS 203 standardized → Qubit uses it natively
- Clean brutalist typography, no fluff
- Your video editor uses this in the demo video intro

### Task 5.3 — Demo accounts
- Pre-seed two accounts in the DB (Alice + Bob) with pre-generated keypairs stored in localStorage export
- Allows instant demo without going through registration live

### Task 5.4 — Deploy
- Backend → Railway or Render
- Frontend → Vercel
- Contract → already on Sui testnet (Phase 1)
- Set all env vars, smoke test end-to-end

---

## Phase 6 — Submission

### Task 6.1 — Demo video
- 3–4 minutes max
- Intro: quantum threat context (use `/about` screen)
- Show: two browsers side by side, Alice sends message to Bob
- Show: Postgres table / ciphertext panel — server sees gibberish
- Show: Bob's browser decrypts instantly
- Outro: Sui identity layer — no email, no phone, just your wallet

### Task 6.2 — Project description
- One liner: "Post-quantum encrypted wallet-to-wallet messaging on Sui using ML-KEM-768"
- Problem / Solution / How it works / Why Sui / Roadmap (SuiNS, group chats, key rotation)
- Track: Infra & DevX

### Task 6.3 — GitHub repo
- Clean README with architecture diagram
- Setup instructions
- Contract address on testnet
- Link to live demo

---

## Roadmap Items (Post-Hackathon, mention in submission)
- SuiNS integration — message via `alice.sui`
- Key rotation with forward secrecy
- Group chats (multi-recipient ML-KEM encapsulation)
- Walrus for message storage (remove centralized Postgres)
- Mobile app (React Native)
- File/media transfer (encrypted blobs)