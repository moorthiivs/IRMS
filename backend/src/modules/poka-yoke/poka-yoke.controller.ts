import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PokaYokeService } from './poka-yoke.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('pokayoke')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PokaYokeController {
  constructor(private readonly pokaYokeService: PokaYokeService) {}

  @Get('items')
  async getItems(@Query('partId') partId: string) {
    return this.pokaYokeService.getItemsByPart(partId);
  }

  @Get('transaction/check')
  async checkTransaction(@Query('partId') partId: string, @Query('date') date: string) {
    return this.pokaYokeService.checkTransactionExists(partId, date);
  }

  @Post('transaction')
  async submitTransaction(@Request() req, @Body() dto: any) {
    return this.pokaYokeService.createTransaction(req.user, dto);
  }

  @Get('approvals/pending')
  async getPendingApprovals(@Request() req) {
    return this.pokaYokeService.getPendingApprovals(req.user);
  }

  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @Post('transaction/:id/approve')
  async approveTransaction(@Param('id') id: string, @Request() req) {
    return this.pokaYokeService.approveTransaction(id, req.user);
  }

  @Put('transaction/detail/:id/status')
  async updateDetailStatus(@Param('id') id: string, @Body() body: { status: 'PASS' | 'FAIL' }) {
    return this.pokaYokeService.updateDetailStatus(id, body.status as any);
  }

  @Post('transaction/:id/corrections')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async addCorrections(@Param('id') transactionId: string, @Body() body: { corrections: { pokaYokeItemId: string, observedValue: string }[], remarks: string }) {
    return this.pokaYokeService.addCorrections(transactionId, body);
  }

  @Delete('transaction/:id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async deleteTransaction(@Param('id') id: string) {
    return this.pokaYokeService.deleteTransaction(id);
  }

  @Post('transaction/bulk-delete')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async bulkDeleteTransactions(@Body() body: { ids: string[] }) {
    return this.pokaYokeService.bulkDeleteTransactions(body.ids);
  }

  @Get('report')
  async getReport(
    @Request() req,
    @Query('partId') partId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.pokaYokeService.getReportData(req.user, partId, startDate, endDate);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMasterData(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any
  ) {
    return this.pokaYokeService.importExcel(file.buffer, body.partId, body.partNumber, body.partName);
  }

  // --- Item Management ---
  @Put('items/bulk')
  async bulkUpdateItems(@Body() body: { partId: string; items: any[] }) {
    return this.pokaYokeService.bulkUpdateItems(body.partId, body.items);
  }

  @Put('items/:id')
  async updateItem(@Param('id') id: string, @Body() dto: any) {
    return this.pokaYokeService.updateItem(id, dto);
  }

  @Delete('items/:id')
  async deleteItem(@Param('id') id: string) {
    return this.pokaYokeService.deleteItem(id);
  }

  // --- Draft Management ---
  @Post('drafts')
  async saveDraft(@Request() req, @Body() dto: any) {
    return this.pokaYokeService.saveDraft(req.user.id, dto);
  }

  @Get('drafts')
  async getDraft(@Request() req, @Query('partId') partId: string) {
    return this.pokaYokeService.getDraft(req.user.id, partId);
  }

  @Delete('drafts/:id')
  async deleteDraft(@Param('id') id: string) {
    return this.pokaYokeService.deleteDraft(id);
  }
}
