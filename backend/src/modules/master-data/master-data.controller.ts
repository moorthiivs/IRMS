import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Query,
  Param,
  Body,
  Res,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MasterDataService } from './master-data.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('master-data')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  // ── Customer Endpoints ──────────────────────────────────────────

  @Get('customers')
  async getCustomers(@Request() req) {
    return this.masterDataService.getCustomers(req.user);
  }

  @Roles(Role.ADMIN)
  @Post('customers')
  async createCustomer(@Body() body: { name: string; code?: string; machines?: string[] }) {
    return this.masterDataService.createCustomer(body.name, body.code, body.machines);
  }

  @Roles(Role.ADMIN)
  @Put('customers/:id')
  async updateCustomer(@Param('id') id: string, @Body() body: { name: string; code?: string; machines?: string[] }) {
    return this.masterDataService.updateCustomer(id, body.name, body.code, body.machines);
  }

  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @Put('customers/:id/active-machines')
  async updateCustomerActiveMachines(@Param('id') id: string, @Body() body: { activeMachines: string[], activeMachinesDate?: string }) {
    return this.masterDataService.updateCustomerActiveMachines(id, body.activeMachines, body.activeMachinesDate);
  }

  @Roles(Role.ADMIN)
  @Delete('customers/:id')
  async deleteCustomer(@Param('id') id: string) {
    return this.masterDataService.deleteCustomer(id);
  }

  @Roles(Role.ADMIN)
  @Patch('parts/:id/customer')
  async assignPartCustomer(@Param('id') id: string, @Body() body: { customerId: string | null }) {
    return this.masterDataService.assignPartCustomer(id, body.customerId);
  }

  // ── Part Endpoints ──────────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Put('parts/:id')
  async updatePart(
    @Param('id') id: string,
    @Body() body: { partNumber: string; partName: string; customerId?: string | null }
  ) {
    return this.masterDataService.updatePart(id, body.partNumber, body.partName, body.customerId);
  }

  @Get('parts')
  async getParts(@Request() req) {
    return this.masterDataService.getParts(req.user);
  }

  @Get('parts-with-operations')
  async getPartsWithOperations(@Request() req) {
    return this.masterDataService.getPartsWithOperations(req.user);
  }

  // ── Operation Endpoints ──────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Put('operations/:id')
  async updateOperation(
    @Param('id') id: string,
    @Body() body: { operationNumber: string; operationName: string }
  ) {
    return this.masterDataService.updateOperation(id, body.operationNumber, body.operationName);
  }

  // ── Other Endpoints ─────────────────────────────────────────────

  @Get('shifts')
  async getShifts() {
    return this.masterDataService.getShifts();
  }

  @Get('parts/:partId/operations')
  async getOperations(@Param('partId') partId: string) {
    return this.masterDataService.getOperationsByPart(partId);
  }

  @Get('parameters')
  async getParameters(
    @Query('partId') partId: string,
    @Query('operationId') operationId: string,
  ) {
    return this.masterDataService.getParameters(partId, operationId);
  }

  @Roles(Role.ADMIN)
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  previewUpload(@UploadedFile() file: Express.Multer.File) {
    return this.masterDataService.previewExcel(file.buffer);
  }

  @Roles(Role.ADMIN)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMasterData(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.masterDataService.importExcel(file.buffer, file.originalname, req.user.id);
  }

  @Roles(Role.ADMIN)
  @Get('upload/history')
  async getHistory() {
    return this.masterDataService.getUploadHistory();
  }

  // Route to download standard upload template
  @Get('template')
  downloadTemplate(@Res() res: Response) {
    // Return upload template (1).xlsx as attachment if present in workspace, else construct error
    const projectRoot = path.join(__dirname, '..', '..', '..');
    const filePath = path.join(projectRoot, '..', 'Documents', 'upload template (1).xlsx');

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="upload_template.xlsx"');
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } else {
      res.status(404).send('Template file not found.');
    }
  }

  @Roles(Role.ADMIN)
  @Delete('parts/:id')
  async deletePart(@Param('id') id: string) {
    return this.masterDataService.deletePart(id);
  }

  @Roles(Role.ADMIN)
  @Delete('parts/:partId/operations/:operationId')
  async deletePartOperation(
    @Param('partId') partId: string,
    @Param('operationId') operationId: string,
  ) {
    return this.masterDataService.deletePartOperation(partId, operationId);
  }

  @Roles(Role.ADMIN)
  @Delete('parameters/:id')
  async deleteParameter(@Param('id') id: string) {
    return this.masterDataService.deleteParameter(id);
  }

  @Roles(Role.ADMIN)
  @Put('parameters')
  async updateParameters(@Body() body: { parameters: any[] }) {
    return this.masterDataService.updateParameters(body.parameters);
  }
}
