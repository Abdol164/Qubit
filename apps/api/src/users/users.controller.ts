import { Controller, Get, Put, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // search must come before :address or NestJS matches "search" as an address param
  @Get('search')
  @UseGuards(JwtAuthGuard)
  search(@Query('address') address: string) {
    return this.users.search(address ?? '');
  }

  @Get(':address')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('address') address: string) {
    return this.users.findByAddress(address);
  }

  @Put('pubkey')
  @UseGuards(JwtAuthGuard)
  savePubKey(@Request() req: any, @Body() body: { pubKey: string }) {
    return this.users.savePublicKey(req.user.address, body.pubKey);
  }

  // Public — ML-KEM public keys are not secret
  @Get(':address/pubkey')
  async getPubKey(@Param('address') address: string) {
    const pubKey = await this.users.getPublicKey(address);
    return { pubKey };
  }
}
