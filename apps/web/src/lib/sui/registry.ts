import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { api } from '../api/client';

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

const PACKAGE_ID = import.meta.env.VITE_SUI_PACKAGE_ID as string;
const REGISTRY_ID = import.meta.env.VITE_SUI_REGISTRY_OBJECT_ID as string;
const NETWORK = (import.meta.env.VITE_SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet' | 'devnet' | 'localnet';

function getClient(): SuiJsonRpcClient {
  return new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK), network: NETWORK });
}

// Dummy sender for read-only devInspect calls (any valid address works)
const DUMMY_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000000';

export async function fetchRecipientPublicKey(recipientAddress: string): Promise<Uint8Array> {
  const client = getClient();
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::registry::get_public_key`,
    arguments: [tx.object(REGISTRY_ID), tx.pure.address(recipientAddress)],
  });

  const result = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: DUMMY_SENDER,
  });

  if (!result.error) {
    const returnVal = result.results?.[0]?.returnValues?.[0];
    if (returnVal) {
      return decodeBcsVector(new Uint8Array(returnVal[0]));
    }
  }

  // On-chain lookup failed — fall back to backend-stored key
  console.warn('[fetchRecipientPublicKey] on-chain miss, trying backend for', recipientAddress);
  const backendResp = await api.get(`/users/${recipientAddress}/pubkey`).catch(() => null);
  console.log('[fetchRecipientPublicKey] backend response:', backendResp);
  const keyStr = typeof backendResp?.pubKey === 'string' ? backendResp.pubKey : null;
  if (keyStr) {
    const binary = atob(keyStr);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  }

  throw new Error('This address has not registered on Qubit yet. They need to log in first.');
}

export async function isRegistered(address: string): Promise<boolean> {
  const client = getClient();
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::registry::is_registered`,
    arguments: [tx.object(REGISTRY_ID), tx.pure.address(address)],
  });

  const result = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: DUMMY_SENDER,
  });

  if (result.error) {
    console.error('[isRegistered] devInspect error:', result.error);
    return false;
  }

  const returnVal = result.results?.[0]?.returnValues?.[0];
  if (!returnVal) {
    console.warn('[isRegistered] no returnValues in result:', result.results);
    return false;
  }

  console.log('[isRegistered] raw returnVal:', returnVal);
  // bool is 1 byte: 0 = false, 1 = true
  return returnVal[0][0] === 1;
}

export function buildRegisterTx(pk: Uint8Array): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(10_000_000);
  tx.moveCall({
    target: `${PACKAGE_ID}::registry::register`,
    arguments: [tx.object(REGISTRY_ID), tx.pure.vector('u8', Array.from(pk))],
  });
  return tx;
}
