import { Module } from '@nestjs/common';
import { PokaYokeController } from './poka-yoke.controller';
import { PokaYokeService } from './poka-yoke.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PokaYokeController],
  providers: [PokaYokeService],
})
export class PokaYokeModule {}
