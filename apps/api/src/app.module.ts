import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from './prisma/prisma.service';
import { SuiService } from './sui/sui.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MessagesModule } from './messages/messages.module';
import { ChatGateway } from './gateway/chat.gateway';
import { DemoController } from './demo/demo.controller';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    MessagesModule,
  ],
  controllers: [DemoController],
  providers: [PrismaService, SuiService, ChatGateway],
  exports: [PrismaService, SuiService],
})
export class AppModule {}
