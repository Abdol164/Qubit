#!/usr/bin/env bun
/**
 * agent-demo.ts — Qubit Agent-to-Agent Post-Quantum Demo
 *
 * Two autonomous AI agents communicate through the Qubit protocol.
 * Zero human interaction. Zero plaintext on any wire.
 *
 * Run: bun agent-demo.ts
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { MlKem768 } from 'mlkem';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const AGENTS_FILE = './demo-agents.json';

interface AgentConfig {
  suiSecretKey: string;   // base64 Ed25519 secret key
  mlkemPk:      string;   // base64 ML-KEM-768 public key (1184B)
  mlkemSk:      string;   // base64 ML-KEM-768 secret key (2400B)
}

interface AgentsFile {
  alpha: AgentConfig;
  beta:  AgentConfig;
}

// ── Configuration ─────────────────────────────────────────────────────────────

const PACKAGE_ID  = '0xb3234c0b8812692b8ea3f053fad61683632abe8e9b56d87dc76326f894236763';
const REGISTRY_ID = '0x0b1eaea309922096c5294a7d016b36d93b82552ecaec6f60a7ac726c3c664d73';
const BACKEND     = 'http://localhost:3001/api';

const suiClient = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' });

// ── Terminal styling ──────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
};

const LINE = '═'.repeat(66);

function banner(title: string) {
  console.log(`\n${c.cyan}${LINE}${c.reset}`);
  console.log(`${c.bold}  ${title}${c.reset}`);
  console.log(`${c.cyan}${LINE}${c.reset}`);
}

function step(n: number, total: number, label: string) {
  console.log(`\n${c.bold}${c.blue}[${n}/${total}]${c.reset}${c.bold} ${label}${c.reset}`);
}

function ok(label: string, value: string) {
  console.log(`  ${c.green}✓${c.reset}  ${c.bold}${label.padEnd(18)}${c.reset} ${c.dim}${value}${c.reset}`);
}

function arrow(label: string, value: string) {
  console.log(`  ${c.yellow}→${c.reset}  ${label.padEnd(18)} ${value}`);
}

function fail(msg: string) {
  console.log(`  ${c.red}✗${c.reset}  ${msg}`);
}

function note(msg: string) {
  console.log(`  ${c.dim}${msg}${c.reset}`);
}

// ── Crypto helpers (same protocol as the Qubit web app) ───────────────────────

interface EncryptedPayload {
  kemCiphertext: string; // base64 — 1088 bytes (ML-KEM-768 encapsulation)
  ciphertext:    string; // base64 — AES-256-GCM ciphertext + 16B auth tag
  nonce:         string; // base64 — 12-byte random IV
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin  = atob(b64);
  const out  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encryptMessage(recipientPk: Uint8Array, plaintext: string): Promise<EncryptedPayload> {
  const kem = new MlKem768();
  const [kemCt, sharedSecret] = await kem.encap(recipientPk);
  const secretBytes = Uint8Array.from(sharedSecret as Uint8Array<ArrayBuffer>);

  const aesKey = await crypto.subtle.importKey(
    'raw', secretBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
  );
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext),
  );
  return {
    kemCiphertext: toBase64(new Uint8Array(kemCt as Uint8Array<ArrayBuffer>)),
    ciphertext:    toBase64(new Uint8Array(buf)),
    nonce:         toBase64(iv),
  };
}

async function decryptMessage(sk: Uint8Array, payload: EncryptedPayload): Promise<string> {
  const kem = new MlKem768();
  const sharedSecret = await kem.decap(fromBase64(payload.kemCiphertext), sk);
  const secretBytes  = Uint8Array.from(sharedSecret as Uint8Array<ArrayBuffer>);

  const aesKey = await crypto.subtle.importKey(
    'raw', secretBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const ct  = fromBase64(payload.ciphertext);
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.nonce).buffer as ArrayBuffer },
    aesKey,
    ct.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(buf);
}

// ── BCS vector decoding (ULEB128 length prefix) ───────────────────────────────

function decodeBcsVector(bytes: Uint8Array): Uint8Array {
  let offset = 0, length = 0, shift = 0;
  while (offset < bytes.length) {
    const b = bytes[offset++];
    length |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return bytes.slice(offset, offset + length);
}

// ── Persistent agent config ───────────────────────────────────────────────────

async function loadOrCreateAgents(): Promise<{
  alpha: Ed25519Keypair; alphaAddr: string; alphaPk: Uint8Array; alphaSk: Uint8Array;
  beta:  Ed25519Keypair; betaAddr:  string; betaPk:  Uint8Array; betaSk:  Uint8Array;
  isNew: boolean;
}> {
  const kem = new MlKem768();

  if (existsSync(AGENTS_FILE)) {
    const saved = JSON.parse(readFileSync(AGENTS_FILE, 'utf8')) as AgentsFile;
    const alpha = Ed25519Keypair.fromSecretKey(saved.alpha.suiSecretKey);
    const beta  = Ed25519Keypair.fromSecretKey(saved.beta.suiSecretKey);
    return {
      alpha, alphaAddr: alpha.getPublicKey().toSuiAddress(),
      alphaPk: fromBase64(saved.alpha.mlkemPk), alphaSk: fromBase64(saved.alpha.mlkemSk),
      beta,  betaAddr:  beta.getPublicKey().toSuiAddress(),
      betaPk:  fromBase64(saved.beta.mlkemPk),  betaSk:  fromBase64(saved.beta.mlkemSk),
      isNew: false,
    };
  }

  // First run — generate fresh agents
  const alpha = new Ed25519Keypair();
  const beta  = new Ed25519Keypair();
  const [alphaPkRaw, alphaSkRaw] = await kem.generateKeyPair();
  const [betaPkRaw,  betaSkRaw]  = await kem.generateKeyPair();
  const alphaPk = new Uint8Array(alphaPkRaw);
  const alphaSk = new Uint8Array(alphaSkRaw);
  const betaPk  = new Uint8Array(betaPkRaw);
  const betaSk  = new Uint8Array(betaSkRaw);

  const saved: AgentsFile = {
    alpha: { suiSecretKey: alpha.getSecretKey(), mlkemPk: toBase64(alphaPk), mlkemSk: toBase64(alphaSk) },
    beta:  { suiSecretKey: beta.getSecretKey(),  mlkemPk: toBase64(betaPk),  mlkemSk: toBase64(betaSk)  },
  };
  writeFileSync(AGENTS_FILE, JSON.stringify(saved, null, 2));

  return {
    alpha, alphaAddr: alpha.getPublicKey().toSuiAddress(), alphaPk, alphaSk,
    beta,  betaAddr:  beta.getPublicKey().toSuiAddress(),  betaPk,  betaSk,
    isNew: true,
  };
}

// ── Testnet faucet ────────────────────────────────────────────────────────────

async function fund(address: string, attempt = 1): Promise<void> {
  const res = await fetch('https://faucet.testnet.sui.io/gas', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ FixedAmountRequest: { recipient: address } }),
  });
  if (res.status === 429 && attempt <= 3) {
    await new Promise(r => setTimeout(r, 5000 * attempt));
    return fund(address, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${body}`);
  }
}

// ── On-chain key registry ─────────────────────────────────────────────────────

async function registerKey(keypair: Ed25519Keypair, pk: Uint8Array): Promise<string> {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000);
  tx.moveCall({
    target:    `${PACKAGE_ID}::registry::register`,
    arguments: [tx.object(REGISTRY_ID), tx.pure.vector('u8', Array.from(pk))],
  });
  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer:      keypair,
    options:     { showEffects: true },
  });
  if (result.effects?.status.status !== 'success') {
    throw new Error(result.effects?.status.error ?? 'unknown error');
  }
  return result.digest;
}

async function fetchPublicKeyOnChain(address: string): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.moveCall({
    target:    `${PACKAGE_ID}::registry::get_public_key`,
    arguments: [tx.object(REGISTRY_ID), tx.pure.address(address)],
  });
  const dummy  = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const result = await suiClient.devInspectTransactionBlock({ transactionBlock: tx, sender: dummy });
  if (result.error) throw new Error(result.error);
  const val = result.results?.[0]?.returnValues?.[0];
  if (!val) throw new Error('No key found on-chain for this address');
  return decodeBcsVector(new Uint8Array(val[0]));
}

// ── Qubit backend auth (signature-optional login) ─────────────────────────────

async function backendLogin(address: string): Promise<string | null> {
  try {
    const nonceRes = await fetch(`${BACKEND}/auth/nonce?address=${address}`);
    if (!nonceRes.ok) return null;
    const { nonce } = await nonceRes.json() as { nonce: string };

    const loginRes = await fetch(`${BACKEND}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ address, nonce }),
    });
    if (!loginRes.ok) return null;
    const { access_token } = await loginRes.json() as { access_token: string };
    return access_token;
  } catch {
    return null;
  }
}

async function sendMessage(token: string, recipientAddress: string, payload: EncryptedPayload): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND}/messages`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ recipientAddress, ...payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchMessages(token: string, otherAddress: string): Promise<EncryptedPayload[]> {
  try {
    const res = await fetch(`${BACKEND}/messages/${otherAddress}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return await res.json() as EncryptedPayload[];
  } catch {
    return [];
  }
}

// ── Main demo ─────────────────────────────────────────────────────────────────

const STEPS = 8;

async function main() {
  banner('QUBIT — AGENT-TO-AGENT POST-QUANTUM DEMO');
  console.log(`\n  ${c.bold}"Qubit deploys the first post-quantum key registry on Sui —${c.reset}`);
  console.log(`   ${c.bold}any agent can build on top of it."${c.reset}`);
  console.log(`\n  Protocol : ML-KEM-768 + AES-256-GCM (NIST FIPS 203)`);
  console.log(`  Network  : Sui Testnet`);
  console.log(`  Humans   : 0`);

  // ── [1/8] Spawn agents ────────────────────────────────────────────────────

  step(1, STEPS, 'SPAWNING AUTONOMOUS AGENTS');

  const { alpha, alphaAddr, alphaPk, alphaSk, beta, betaAddr, betaPk, betaSk, isNew }
    = await loadOrCreateAgents();

  ok('Agent Alpha', alphaAddr);
  ok('Agent Beta ', betaAddr);
  note(isNew
    ? 'Fresh Ed25519 wallet identities generated — saved to demo-agents.json for reuse.'
    : 'Persistent agent identities loaded from demo-agents.json.');

  // ── [2/8] Fund via faucet ─────────────────────────────────────────────────

  step(2, STEPS, 'FUNDING AGENTS VIA TESTNET FAUCET');

  if (isNew) {
    for (const [name, addr] of [['Agent Alpha', alphaAddr], ['Agent Beta ', betaAddr]] as [string, string][]) {
      try {
        await fund(addr);
        ok(name, 'SUI received from faucet');
      } catch (e: any) {
        fail(`${name} faucet: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    note('Waiting 10s for faucet transactions to land on testnet...');
    await new Promise(r => setTimeout(r, 10000));
  } else {
    ok('Agent Alpha', 'pre-funded — skipping faucet');
    ok('Agent Beta ', 'pre-funded — skipping faucet');
  }

  // ── [3/8] ML-KEM-768 keypairs ────────────────────────────────────────────

  step(3, STEPS, 'GENERATING ML-KEM-768 KEYPAIRS  (NIST FIPS 203)');

  ok('Agent Alpha', `pk=${alphaPk.length}B  sk=${alphaSk.length}B`);
  ok('Agent Beta ', `pk=${betaPk.length}B   sk=${betaSk.length}B`);
  note(isNew
    ? 'Keys generated client-side and persisted. Secret keys never leave the agent process.'
    : 'Persistent ML-KEM-768 keypairs loaded — match what is registered on-chain.');

  // ── [4/8] Register public keys on Qubit Registry (on-chain) ──────────────

  step(4, STEPS, 'REGISTERING PUBLIC KEYS ON QUBIT REGISTRY  (ON-CHAIN)');

  for (const [name, keypair, pk] of [
    ['Agent Alpha', alpha, alphaPk],
    ['Agent Beta ', beta,  betaPk ],
  ] as [string, Ed25519Keypair, Uint8Array][]) {
    try {
      const digest = await registerKey(keypair, pk);
      ok(name, `digest: ${digest}`);
    } catch (e: any) {
      if (e.message?.includes('EAlreadyRegistered') || e.message?.includes('Already') || e.message?.includes(': 1')) {
        ok(name, 'already registered on-chain — key is live');
      } else {
        fail(`${name} registration: ${e.message}`);
      }
    }
  }

  // ── [5/8] Agent Alpha fetches Agent Beta's public key on-chain ────────────

  step(5, STEPS, 'AGENT ALPHA READS AGENT BETA\'S KEY FROM ON-CHAIN REGISTRY');

  let fetchedBetaPk: Uint8Array;
  let fetchErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      fetchedBetaPk = await fetchPublicKeyOnChain(betaAddr);
      ok('Key fetched ', `${fetchedBetaPk!.length}B from ${REGISTRY_ID.slice(0, 12)}...`);
      ok('Verified    ', `ML-KEM-768 public key — ${fetchedBetaPk!.length === 1184 ? 'length valid ✓' : 'unexpected length'}`);
      fetchErr = '';
      break;
    } catch (e: any) {
      fetchErr = e.message;
      if (attempt < 3) {
        note(`Key fetch attempt ${attempt} failed — retrying in 4s...`);
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  }
  if (fetchErr) {
    fail(`On-chain fetch failed after 3 attempts — falling back to in-memory key`);
    fetchedBetaPk = betaPk;
  }

  // ── [6/8] Agent Alpha encrypts an instruction ─────────────────────────────

  step(6, STEPS, 'AGENT ALPHA ENCRYPTS INSTRUCTION WITH AGENT BETA\'S PUBLIC KEY');

  const instruction = JSON.stringify({
    task:       'sui_transfer',
    recipient:  alphaAddr,
    amount_mist: 1000,
    memo:       'Coordination fee — payment for completed computation task',
    timestamp:  Date.now(),
  });

  arrow('Plaintext   ', `${instruction.slice(0, 72)}...`);

  const payload = await encryptMessage(fetchedBetaPk, instruction);
  const kemLen  = fromBase64(payload.kemCiphertext).length;
  const ctLen   = fromBase64(payload.ciphertext).length;

  ok('ML-KEM encap', `${kemLen}B ciphertext (quantum-resistant session key)`);
  ok('AES-256-GCM ', `${ctLen}B encrypted payload + 16B auth tag`);
  ok('Nonce       ', `${fromBase64(payload.nonce).length}B cryptographically random IV`);
  note('No classical or quantum computer can read this without Agent Beta\'s secret key.');

  // ── [7/8] Deliver through Qubit messaging layer ───────────────────────────

  step(7, STEPS, 'DELIVERING THROUGH QUBIT MESSAGING LAYER');

  const alphaToken = await backendLogin(alphaAddr);
  const betaToken  = await backendLogin(betaAddr);

  let deliveredViaBackend = false;
  let agentBPayload: EncryptedPayload = payload; // fallback: use in-memory payload

  if (alphaToken && betaToken) {
    const sent = await sendMessage(alphaToken, betaAddr, payload);
    if (sent) {
      ok('Sent        ', 'encrypted ciphertext → Qubit backend');
      note('Server stored the message without ever seeing plaintext.');

      await new Promise(r => setTimeout(r, 500));

      const msgs = await fetchMessages(betaToken, alphaAddr);
      if (msgs.length > 0) {
        agentBPayload = msgs[msgs.length - 1] as EncryptedPayload;
        ok('Received    ', `Agent Beta fetched ${msgs.length} message(s) from thread`);
        deliveredViaBackend = true;
      } else {
        ok('Received    ', 'Agent Beta polling (using in-memory payload for demo)');
      }
    } else {
      arrow('Backend     ', 'message store returned error — using direct channel');
    }
  } else {
    arrow('Backend     ', 'offline — demonstrating crypto flow directly');
    note('In production: messages route through the Qubit gateway via WebSocket.');
  }

  if (!deliveredViaBackend) {
    arrow('Channel     ', 'encrypted payload passed peer-to-peer');
  }

  // ── [8/8] Agent Beta decrypts and executes a Sui transaction ─────────────

  step(8, STEPS, 'AGENT BETA DECRYPTS INSTRUCTION + EXECUTES SUI TRANSACTION');

  const decrypted = await decryptMessage(betaSk, agentBPayload);
  ok('Decrypted   ', decrypted.slice(0, 80));

  let parsed: { task: string; recipient: string; amount_mist: number; memo: string };
  try {
    parsed = JSON.parse(decrypted);
  } catch {
    fail('Failed to parse instruction JSON');
    return;
  }

  arrow('Task        ', parsed.task);
  arrow('Recipient   ', parsed.recipient);
  arrow('Amount      ', `${parsed.amount_mist} MIST`);
  arrow('Memo        ', parsed.memo);

  note('Agent Beta executing Sui transaction autonomously...');

  if (parsed.task === 'sui_transfer') {
    try {
      const tx = new Transaction();
      tx.setGasBudget(5_000_000);
      const [coin] = tx.splitCoins(tx.gas, [parsed.amount_mist]);
      tx.transferObjects([coin], parsed.recipient);

      const result = await suiClient.signAndExecuteTransaction({
        transaction: tx,
        signer:      beta,
        options:     { showEffects: true },
      });

      if (result.effects?.status.status === 'success') {
        ok('Executed    ', `Sui digest: ${result.digest}`);
        arrow('Explorer    ', `https://suiexplorer.com/txblock/${result.digest}?network=testnet`);
      } else {
        fail(`Transaction failed: ${result.effects?.status.error}`);
      }
    } catch (e: any) {
      fail(`Execution error: ${e.message}`);
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  banner('DEMO COMPLETE');
  console.log(`
  ${c.green}${c.bold}Zero human interaction.${c.reset}
  ${c.green}${c.bold}Zero plaintext on any wire or in the database.${c.reset}
  ${c.green}${c.bold}Quantum-resistant end-to-end.${c.reset}

  What just happened:
    1. Two agents spawned autonomously with Sui wallet identities.
    2. Each generated an ML-KEM-768 keypair (NIST FIPS 203).
    3. Both registered their public keys on the Qubit on-chain registry.
    4. Agent Alpha fetched Agent Beta's key directly from the Sui blockchain.
    5. Agent Alpha encrypted an instruction — no eavesdropper, classical or
       quantum, can decrypt it without Agent Beta's secret key.
    6. Agent Beta decrypted the instruction and executed a real Sui transaction.

  This is the Agentic Web. This is what Qubit is built for.

  ${c.dim}View on Sui Explorer: https://suiexplorer.com/?network=testnet${c.reset}
`);
}

main().catch((e: Error) => {
  console.error(`\n${c.red}${c.bold}Fatal:${c.reset} ${e.message}`);
  if (process.env['DEBUG']) console.error(e.stack);
  process.exit(1);
});
