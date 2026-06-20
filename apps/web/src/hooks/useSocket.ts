import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export interface WsMessage {
  id: string;
  senderId: string;
  senderAddress: string;
  kemCiphertext: string;
  ciphertext: string;
  nonce: string;
  createdAt: string;
}

export function useSocket(onMessage: (msg: WsMessage) => void) {
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!token) return;

    const socket = io('http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('message:new', (msg: WsMessage) => onMessageRef.current(msg));

    return () => {
      socket.disconnect();
      setIsConnected(false);
    };
  }, [token]);

  return { isConnected };
}
