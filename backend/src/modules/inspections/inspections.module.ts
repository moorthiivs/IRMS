import { Module } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { PdfService } from './pdf.service';

@Module({
  controllers: [InspectionsController],
  providers: [InspectionsService, PdfService],
  exports: [InspectionsService, PdfService],
})
export class InspectionsModule {}
