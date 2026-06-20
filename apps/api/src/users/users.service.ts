import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByAddress(address: string) {
    const user = await this.prisma.user.findUnique({ where: { address } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async search(address: string) {
    return this.prisma.user.findMany({
      where: { address: { contains: address } },
      select: { id: true, address: true, nickname: true, createdAt: true },
      take: 20,
    });
  }

  async savePublicKey(address: string, pubKeyBase64: string) {
    return this.prisma.user.update({
      where: { address },
      data: { mlkemPubKey: pubKeyBase64 },
    });
  }

  async getPublicKey(address: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { address }, select: { mlkemPubKey: true } });
    return user?.mlkemPubKey ?? null;
  }
}
