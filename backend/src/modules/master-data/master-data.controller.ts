import {
  Controller,
  Get,
  Post,
  Put,
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

  @Get('parts')
  async getParts() {
    return this.masterDataService.getParts();
  }

  @Get('parts-with-operations')
  async getPartsWithOperations() {
    return this.masterDataService.getPartsWithOperations();
  }

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
