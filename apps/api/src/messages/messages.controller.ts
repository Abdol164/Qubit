import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateMessageDto) {
    return this.messages.create(req.user.userId, dto);
  }

  @Get(':address')
  getThread(@Request() req: any, @Param('address') address: string) {
    return this.messages.getThread(req.user.userId, address);
  }
}
