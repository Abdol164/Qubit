import { create } from 'zustand';
import { loadKeypairFromStorage } from '../lib/crypto/keygen';

interface AuthState {
  address: string | null;
  userId: string | null;
  token: string | null;
  mlkemPk: Uint8Array | null;
  mlkemSk: Uint8Array | null;
}

interface AuthActions {
  login: (address: string, token: string) => void;
  logout: () => void;
  setKeypair: (pk: Uint8Array, sk: Uint8Array) => void;
}

type AuthStore = AuthState & AuthActions;

function decodeJwtSub(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function loadSession(): Pick<AuthState, 'address' | 'token' | 'userId'> {
  try {
    const raw = localStorage.getItem('qubit_session');
    if (!raw) return { address: null, token: null, userId: null };
    const { address, token } = JSON.parse(raw);
    const userId = decodeJwtSub(token);
    return { address: address ?? null, token: token ?? null, userId };
  } catch {
    return { address: null, token: null, userId: null };
  }
}

const { address, token, userId } = loadSession();
const keypair = loadKeypairFromStorage();

export const useAuthStore = create<AuthStore>((set) => ({
  address,
  token,
  userId,
  mlkemPk: keypair?.pk ?? null,
  mlkemSk: keypair?.sk ?? null,

  login(address, token) {
    const userId = decodeJwtSub(token);
    localStorage.setItem('qubit_session', JSON.stringify({ address, token }));
    set({ address, token, userId });
  },

  logout() {
    localStorage.removeItem('qubit_session');
    set({ address: null, token: null, userId: null, mlkemPk: null, mlkemSk: null });
  },

  setKeypair(pk, sk) {
    set({ mlkemPk: pk, mlkemSk: sk });
  },
}));
