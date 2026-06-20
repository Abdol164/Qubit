import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('nonce')
  @ApiOperation({ summary: 'Get a nonce to sign with your Sui wallet' })
  getNonce(@Query('address') address: string) {
    return { nonce: this.auth.generateNonce(address) };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with Sui wallet signature' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.address, dto.nonce, dto.signature);
  }
}
