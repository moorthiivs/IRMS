import { Module } from '@nestjs/common';
import { SpcService } from './spc.service';
import { SpcController } from './spc.controller';

@Module({
  controllers: [SpcController],
  providers: [SpcService],
  exports: [SpcService],
})
export class SpcModule {}
