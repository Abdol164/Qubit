import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('No token');

      const payload = this.jwt.verify<{ sub: string; address: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      socket.data.address = payload.address;
      socket.data.userId = payload.sub;
      socket.join(payload.address);

      this.logger.log(`Connected: ${payload.address} (${socket.id})`);
    } catch {
      this.logger.warn(`Rejected unauthenticated socket: ${socket.id}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Disconnected: ${socket.data?.address ?? socket.id}`);
  }

  @OnEvent('message.created')
  handleMessageCreated(event: {
    recipientAddress: string;
    payload: {
      id: string;
      senderId: string;
      senderAddress: string;
      kemCiphertext: string;
      ciphertext: string;
      nonce: string;
      createdAt: Date;
    };
  }) {
    this.server.to(event.recipientAddress).emit('message:new', event.payload);
  }
}
