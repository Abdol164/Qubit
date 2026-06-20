import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { PrismaService } from '../prisma/prisma.service';
import { SuiService } from '../sui/sui.service';

const NONCE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sui: SuiService,
  ) {}

  generateNonce(address: string): string {
    const ts = Date.now().toString();
    const secret = this.config.get<string>('JWT_SECRET')!;
    const mac = createHmac('sha256', secret)
      .update(`${address}.${ts}`)
      .digest('hex');
    return `${ts}.${mac}`;
  }

  async login(address: string, nonce: string, signature?: string) {
    // 1. Validate nonce freshness and HMAC
    const parts = nonce.split('.');
    if (parts.length !== 2) throw new UnauthorizedException('Invalid nonce');
    const [ts, mac] = parts;
    const elapsed = Date.now() - parseInt(ts, 10);
    if (elapsed > NONCE_TTL_MS || elapsed < 0) {
      throw new UnauthorizedException('Nonce expired');
    }
    const secret = this.config.get<string>('JWT_SECRET')!;
    const expected = createHmac('sha256', secret)
      .update(`${address}.${ts}`)
      .digest('hex');
    if (mac !== expected) throw new UnauthorizedException('Invalid nonce');

    // 2. Verify wallet signature when provided (some wallets don't support signPersonalMessage)
    if (signature) {
      try {
        await verifyPersonalMessageSignature(
          new TextEncoder().encode(nonce),
          signature,
          { address, client: this.sui.getClient() },
        );
      } catch (err) {
        this.logger.warn(`Signature verification failed for ${address}: ${err}`);
        throw new UnauthorizedException('Invalid signature');
      }
    }

    // 3. Upsert user
    let user = await this.prisma.user.findUnique({ where: { address } });
    if (!user) {
      user = await this.prisma.user.create({ data: { address } });
    }

    // 4. Issue JWT
    const payload = { sub: user.id, address: user.address };
    return { access_token: this.jwt.sign(payload), userId: user.id };
  }
}
