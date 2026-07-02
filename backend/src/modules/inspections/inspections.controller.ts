import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { CorrectInspectionDto } from './dto/correct-inspection.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('inspections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get('due')
  async checkDue(
    @Query('partId') partId: string,
    @Query('operationId') operationId: string,
    @Query('shiftId') shiftId: string,
    @Query('intervalName') intervalName: string,
  ) {
    return this.inspectionsService.checkInspectionDue(partId, operationId, shiftId, intervalName);
  }

  @Get('drafts')
  async getDrafts(@Request() req) {
    return this.inspectionsService.getDrafts(req.user.id);
  }

  @Post('drafts')
  async saveDraft(@Request() req, @Body() dto: any) {
    return this.inspectionsService.saveDraft(req.user.id, dto);
  }

  @Delete('drafts/:id')
  async deleteDraft(@Param('id') id: string) {
    return this.inspectionsService.deleteDraft(id);
  }

  @Post()
  async submitInspection(@Body() dto: CreateInspectionDto, @Request() req) {
    return this.inspectionsService.createInspection(req.user.id, dto);
  }

  @Get('dashboard')
  async getDashboard() {
    return this.inspectionsService.getDashboardData();
  }

  @Get('recent')
  async getRecent(
    @Query('status') status?: string,
    @Query('approval') approval?: string,
    @Query('date') date?: string,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.inspectionsService.getRecentInspections(status, approval, date, shiftId);
  }

  @Get('daily')
  async getDailyReport(
    @Query('partId') partId: string,
    @Query('operationId') operationId: string,
    @Query('mcNo') mcNo?: string,
    @Query('date') date?: string,
  ) {
    return this.inspectionsService.getDailyReport(partId, operationId, mcNo, date);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.inspectionsService.getInspectionById(id);
  }

  @Get(':id/audit-trail')
  async getAuditTrail(@Param('id') id: string) {
    return this.inspectionsService.getAuditTrail(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Request() req) {
    return this.inspectionsService.approveInspection(id, req.user.id);
  }

  @Patch(':id/correct')
  async correctInspection(
    @Param('id') id: string,
    @Body() dto: CorrectInspectionDto,
    @Request() req,
  ) {
    return this.inspectionsService.correctInspection(id, req.user.id, dto);
  }
  @Delete(':id')
  async deleteInspection(@Param('id') id: string) {
    return this.inspectionsService.deleteInspection(id);
  }
}
