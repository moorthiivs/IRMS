import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { SpcService } from './spc.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('spc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SpcController {
  constructor(private readonly spcService: SpcService) {}

  @Get('dashboard')
  async getDashboardData(
    @Request() req,
    @Query('customerId') customerId?: string,
    @Query('partNumber') partNumber?: string,
    @Query('machineNumber') machineNumber?: string,
  ) {
    return this.spcService.getDashboardData(req.user, { customerId, partNumber, machineNumber });
  }

  @Post('characteristics/upload')
  async uploadCharacteristics(@Body() body: { records: any[] }) {
    return this.spcService.uploadCharacteristics(body.records);
  }

  @Get('characteristics')
  async getCharacteristics(
    @Query('partNumber') partNumber?: string,
    @Query('machineNumber') machineNumber?: string,
  ) {
    return this.spcService.getCharacteristics({ partNumber, machineNumber });
  }

  @Put('characteristics/:id')
  async updateCharacteristic(@Param('id') id: string, @Body() body: any) {
    return this.spcService.updateCharacteristic(id, body);
  }

  @Delete('characteristics/:id')
  async deleteCharacteristic(@Param('id') id: string) {
    return this.spcService.deleteCharacteristic(id);
  }

  @Get('due')
  async checkDue(
    @Query('partId') partId: string,
    @Query('operationId') operationId: string,
    @Query('shiftId') shiftId: string,
    @Query('intervalName') intervalName: string,
  ) {
    return this.spcService.checkDue(partId, operationId, shiftId, intervalName);
  }

  @Get('drafts')
  async getDrafts(@Request() req) {
    return this.spcService.getDrafts(req.user.id);
  }

  @Post('drafts')
  async saveDraft(@Request() req, @Body() dto: any) {
    return this.spcService.saveDraft(req.user.id, dto);
  }

  @Delete('drafts/:id')
  async deleteDraft(@Param('id') id: string) {
    return this.spcService.deleteDraft(id);
  }

  @Post('entry')
  async submitSpcEntry(@Request() req, @Body() dto: any) {
    return this.spcService.createSpcTransaction(req.user.id, dto);
  }

  @Get('check-duplicate')
  async checkDuplicate(
    @Query('date') date: string,
    @Query('partNumber') partNumber: string,
    @Query('machineNumber') machineNumber?: string,
  ) {
    return this.spcService.checkDuplicate(date, partNumber, machineNumber);
  }

  @Get('recent')
  async getRecent(
    @Request() req,
    @Query('status') status?: string,
    @Query('shiftId') shiftId?: string,
    @Query('partId') partId?: string,
    @Query('partNumber') partNumber?: string,
    @Query('operationId') operationId?: string,
    @Query('customerId') customerId?: string,
    @Query('machineNumber') machineNumber?: string,
    @Query('date') date?: string,
  ) {
    return this.spcService.getRecent(req.user, { status, shiftId, partId, partNumber, operationId, customerId, machineNumber, date });
  }

  @Get('reports/:id')
  async getById(@Param('id') id: string) {
    return this.spcService.getById(id);
  }

  @Delete(':id')
  async deleteSpc(@Param('id') id: string) {
    return this.spcService.deleteSpc(id);
  }

  @Post('upload-partno')
  async uploadSpcDataByPartNo(@Body() body: { records: any[] }) {
    return this.spcService.uploadSpcDataByPartNo(body.records);
  }

  @Get('part-data/:partNumber')
  async getSpcDataByPartNumber(@Param('partNumber') partNumber: string) {
    return this.spcService.getSpcDataByPartNumber(partNumber);
  }
}
