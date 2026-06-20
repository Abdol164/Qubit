import { useState, useCallback } from 'react';

const KEY = 'qubit_nicknames';

function readStore(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function useNicknames() {
  const [store, setStore] = useState<Record<string, string>>(readStore);

  const getNickname = useCallback((address: string) => store[address] ?? null, [store]);

  const setNickname = useCallback((address: string, name: string) => {
    setStore((prev) => {
      const next = { ...prev, [address]: name };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { getNickname, setNickname };
}
