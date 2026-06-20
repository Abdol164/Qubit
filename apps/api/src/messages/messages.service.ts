import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(senderId: string, dto: CreateMessageDto) {
    const recipient = await this.prisma.user.findUnique({
      where: { address: dto.recipientAddress },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');

    const message = await this.prisma.message.create({
      data: {
        senderId,
        recipientId: recipient.id,
        kemCiphertext: dto.kemCiphertext,
        ciphertext: dto.ciphertext,
        nonce: dto.nonce,
      },
      include: { sender: true },
    });

    this.events.emit('message.created', {
      recipientAddress: recipient.address,
      payload: {
        id: message.id,
        senderId: message.senderId,
        senderAddress: message.sender.address,
        kemCiphertext: message.kemCiphertext,
        ciphertext: message.ciphertext,
        nonce: message.nonce,
        createdAt: message.createdAt,
      },
    });

    return message;
  }

  async getThread(userId: string, otherAddress: string) {
    const other = await this.prisma.user.findUnique({
      where: { address: otherAddress },
    });
    if (!other) throw new NotFoundException('User not found');

    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: other.id },
          { senderId: other.id, recipientId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        kemCiphertext: true,
        ciphertext: true,
        nonce: true,
        createdAt: true,
      },
    });
  }
}
