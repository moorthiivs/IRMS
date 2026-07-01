import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';
import { UploadStatus } from '@prisma/client';

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getParts() {
    return this.prisma.part.findMany({
      orderBy: { partNumber: 'asc' },
    });
  }

  async getPartsWithOperations() {
    const parts = await this.prisma.part.findMany({
      orderBy: { partNumber: 'asc' },
      include: {
        operations: {
          include: {
            operation: true,
          },
        },
        parameters: {
          select: { id: true, operationId: true },
        },
      },
    });

    return parts.map((part) => ({
      id: part.id,
      partNumber: part.partNumber,
      partName: part.partName,
      operations: part.operations.map((po) => ({
        id: po.operation.id,
        operationNumber: po.operation.operationNumber,
        operationName: po.operation.operationName,
        parameterCount: part.parameters.filter(
          (p) => p.operationId === po.operation.id,
        ).length,
      })),
    }));
  }

  private async getDeletionPolicy(): Promise<string> {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { key: 'deletion_policy' },
    });
    return setting?.value ?? 'strict';
  }

  async deletePart(partId: string) {
    const policy = await this.getDeletionPolicy();

    // Check for existing inspection history
    const txCount = await this.prisma.inspectionTransaction.count({
      where: { partId },
    });

    if (txCount > 0 && policy === 'strict') {
      throw new BadRequestException(
        `Cannot delete this part because it has ${txCount} inspection record(s). Change Deletion Policy to "Cascade" in Settings to force delete.`,
      );
    }

    // If cascade, delete transactions first
    if (txCount > 0 && policy === 'cascade') {
      // Delete details first, then transactions
      await this.prisma.inspectionDetail.deleteMany({
        where: { transaction: { partId } },
      });
      await this.prisma.inspectionTransaction.deleteMany({
        where: { partId },
      });
    }

    // Delete parameters, partOperations, then the part (cascade handles params via schema)
    await this.prisma.inspectionParameter.deleteMany({ where: { partId } });
    await this.prisma.partOperation.deleteMany({ where: { partId } });
    await this.prisma.part.delete({ where: { id: partId } });

    return { message: 'Part deleted successfully.' };
  }

  async deletePartOperation(partId: string, operationId: string) {
    const policy = await this.getDeletionPolicy();

    const txCount = await this.prisma.inspectionTransaction.count({
      where: { partId, operationId },
    });

    if (txCount > 0 && policy === 'strict') {
      throw new BadRequestException(
        `Cannot delete this operation because it has ${txCount} inspection record(s). Change Deletion Policy to "Cascade" in Settings to force delete.`,
      );
    }

    if (txCount > 0 && policy === 'cascade') {
      await this.prisma.inspectionDetail.deleteMany({
        where: { transaction: { partId, operationId } },
      });
      await this.prisma.inspectionTransaction.deleteMany({
        where: { partId, operationId },
      });
    }

    await this.prisma.inspectionParameter.deleteMany({
      where: { partId, operationId },
    });
    await this.prisma.partOperation.deleteMany({
      where: { partId, operationId },
    });

    return { message: 'Operation removed from part successfully.' };
  }

  async deleteParameter(id: string) {
    await this.prisma.inspectionParameter.delete({
      where: { id },
    });
    return { message: 'Parameter deleted successfully.' };
  }

  async updateParameters(
    parameters: any[]
  ) {
    const results = [];
    for (const param of parameters) {
      const { id, partId, operationId, ...updateData } = param;
      if (id && !id.startsWith('new-')) {
        const updated = await this.prisma.inspectionParameter.update({
          where: { id },
          data: updateData,
        });
        results.push(updated);
      } else {
        const created = await this.prisma.inspectionParameter.create({
          data: {
            ...updateData,
            partId: partId,
            operationId: operationId,
          },
        });
        results.push(created);
      }
    }
    return results;
  }

  async getShifts() {
    return this.prisma.shift.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getOperationsByPart(partId: string) {
    const partOps = await this.prisma.partOperation.findMany({
      where: { partId },
      include: { operation: true },
    });
    return partOps.map((po) => po.operation);
  }

  async getParameters(partId: string, operationId: string) {
    return this.prisma.inspectionParameter.findMany({
      where: { partId, operationId },
      orderBy: { sequence: 'asc' },
    });
  }

  // Parse Excel buffer and return preview with validation errors
  previewExcel(fileBuffer: Buffer) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (json.length < 2) {
        throw new BadRequestException('The uploaded file is empty or missing data rows.');
      }

      const headers = json[0].map(h => String(h).trim());
      
      // Expected headers (minimum matching we need to extract parameter configs)
      const reqHeaders = [
        'Part No',
        'Part Name',
        'Operation No',
        'Characteristic (Parameter)',
      ];

      for (const req of reqHeaders) {
        if (!headers.includes(req)) {
          throw new BadRequestException(`Missing required header column: "${req}"`);
        }
      }

      const partNoIdx = headers.indexOf('Part No');
      const partNameIdx = headers.indexOf('Part Name');
      const opNoIdx = headers.indexOf('Operation No');
      const paramNameIdx = headers.indexOf('Characteristic (Parameter)');
      
      // Optional columns
      const snoIdx = headers.indexOf('SI.NO');
      const classIdx = headers.indexOf('Class');
      const specIdx = headers.indexOf('SPEC');
      const minIdx = headers.indexOf('Control limit MIN');
      const maxIdx = headers.indexOf('Control Limit MAX');
      const methodIdx = headers.indexOf('Method of Checking');
      const freqIdx = headers.indexOf('Freq. of Inspn.');
      const lcIdx = headers.indexOf('Lc');

      const previewRows: any[] = [];
      const errors: string[] = [];
      
      // Loop over rows starting from index 1 (skip header)
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!row || row.length === 0 || row.every(c => c === null || c === '')) {
          continue; // skip blank rows
        }

        const partNo = row[partNoIdx] ? String(row[partNoIdx]).trim() : '';
        const partName = row[partNameIdx] ? String(row[partNameIdx]).trim() : 'Unnamed Part';
        const operationNo = row[opNoIdx] ? String(row[opNoIdx]).trim() : '';
        const parameterName = row[paramNameIdx] ? String(row[paramNameIdx]).trim() : '';

        const rowNum = i + 1;
        const rowErrors: string[] = [];

        if (!partNo) rowErrors.push('Part No is required.');
        if (!operationNo) rowErrors.push('Operation No is required.');
        if (!parameterName) rowErrors.push('Characteristic (Parameter) is required.');

        // Tolerances parsing
        const rawMin = row[minIdx] !== undefined && row[minIdx] !== null ? String(row[minIdx]).trim() : '';
        const rawMax = row[maxIdx] !== undefined && row[maxIdx] !== null ? String(row[maxIdx]).trim() : '';

        const isVisualCheckValue = (val: string) => {
          const lower = val.toLowerCase();
          return lower === '' || lower === 'ok' || lower === 'ng' || lower === 'pass' || lower === 'fail' || lower === '-';
        };

        let limitMinVal: number | null = null;
        if (rawMin && !isVisualCheckValue(rawMin)) {
          limitMinVal = parseFloat(rawMin);
          if (isNaN(limitMinVal)) {
            rowErrors.push('Control Limit MIN must be a number or a visual check indicator ("ok", "ng", "pass", "fail", "-").');
          }
        }

        let limitMaxVal: number | null = null;
        if (rawMax && !isVisualCheckValue(rawMax)) {
          limitMaxVal = parseFloat(rawMax);
          if (isNaN(limitMaxVal)) {
            rowErrors.push('Control Limit MAX must be a number or a visual check indicator ("ok", "ng", "pass", "fail", "-").');
          }
        }

        if (rowErrors.length > 0) {
          errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
        }

        // SPEC / tolerances extraction
        let nominalValue = '';
        let lowerTolerance = '';
        let upperTolerance = '';
        const specText = row[specIdx] ? String(row[specIdx]).trim() : '';

        // Simple spec parser if MIN/MAX are numeric
        if (specText) {
          const parts = specText.split(/[±\+\-~]/);
          nominalValue = parts[0]?.trim() || '';
        }

        // LC (Least Count) parsing
        let leastCountVal: number | null = null;
        const rawLc = row[lcIdx] !== undefined && row[lcIdx] !== null ? String(row[lcIdx]).trim() : '';
        if (rawLc && rawLc !== '-' && rawLc !== '') {
          leastCountVal = parseFloat(rawLc);
          if (isNaN(leastCountVal)) {
            leastCountVal = null;
          }
        }

        previewRows.push({
          rowNumber: rowNum,
          partNumber: partNo,
          partName: partName,
          operationNumber: operationNo,
          parameterName: parameterName,
          sequence: row[snoIdx] ? parseInt(row[snoIdx], 10) : i,
          class: row[classIdx] ? String(row[classIdx]).trim() : null,
          specText: specText,
          nominalValue: nominalValue,
          controlLimitMin: limitMinVal,
          controlLimitMax: limitMaxVal,
          methodOfChecking: row[methodIdx] ? String(row[methodIdx]).trim() : null,
          freqOfInspn: row[freqIdx] ? String(row[freqIdx]).trim() : 'Once per shift',
          leastCount: leastCountVal,
          errors: rowErrors,
        });
      }

      return {
        headers,
        rows: previewRows,
        errors,
        isValid: errors.length === 0,
      };
    } catch (e) {
      throw new BadRequestException('Error parsing spreadsheet: ' + e.message);
    }
  }

  // Import validated rows and log history
  async importExcel(fileBuffer: Buffer, filename: string, userId: string) {
    const { rows, errors, isValid } = this.previewExcel(fileBuffer);
    
    if (!isValid) {
      // Create a FAILED UploadHistory record
      await this.prisma.uploadHistory.create({
        data: {
          filename,
          uploadedById: userId,
          status: UploadStatus.FAILED,
          totalRecords: rows.length,
          importedRecords: 0,
          errorLog: JSON.stringify(errors),
        },
      });
      throw new BadRequestException({
        message: 'Import failed due to spreadsheet validation errors.',
        errors,
      });
    }

    let importedCount = 0;
    try {
      for (const row of rows) {
        // 1. Create/Find Part
        const part = await this.prisma.part.upsert({
          where: { partNumber: row.partNumber },
          update: { partName: row.partName },
          create: { partNumber: row.partNumber, partName: row.partName },
        });

        // 2. Create/Find Operation
        const operation = await this.prisma.operation.upsert({
          where: { operationNumber: row.operationNumber },
          update: {},
          create: { operationNumber: row.operationNumber, operationName: `Operation ${row.operationNumber}` },
        });

        // 3. Link Part and Operation
        await this.prisma.partOperation.upsert({
          where: {
            partId_operationId: {
              partId: part.id,
              operationId: operation.id,
            },
          },
          update: {},
          create: {
            partId: part.id,
            operationId: operation.id,
          },
        });

        // 4. Create/Find Parameter Configuration
        await this.prisma.inspectionParameter.upsert({
          where: {
            partId_operationId_parameterName: {
              partId: part.id,
              operationId: operation.id,
              parameterName: row.parameterName,
            },
          },
          update: {
            specText: row.specText,
            nominalValue: row.nominalValue,
            controlLimitMin: row.controlLimitMin,
            controlLimitMax: row.controlLimitMax,
            methodOfChecking: row.methodOfChecking,
            freqOfInspn: row.freqOfInspn,
            leastCount: row.leastCount,
            class: row.class,
            sequence: row.sequence,
          },
          create: {
            partId: part.id,
            operationId: operation.id,
            parameterName: row.parameterName,
            specText: row.specText,
            nominalValue: row.nominalValue,
            controlLimitMin: row.controlLimitMin,
            controlLimitMax: row.controlLimitMax,
            methodOfChecking: row.methodOfChecking,
            freqOfInspn: row.freqOfInspn,
            leastCount: row.leastCount,
            class: row.class,
            sequence: row.sequence,
          },
        });

        importedCount++;
      }

      // Record SUCCESSful upload log
      await this.prisma.uploadHistory.create({
        data: {
          filename,
          uploadedById: userId,
          status: UploadStatus.SUCCESS,
          totalRecords: rows.length,
          importedRecords: importedCount,
        },
      });

      return {
        message: `Imported ${importedCount} parameter configuration records successfully.`,
        importedCount,
      };
    } catch (err) {
      // Record PARTIAL/FAILED upload log
      await this.prisma.uploadHistory.create({
        data: {
          filename,
          uploadedById: userId,
          status: UploadStatus.PARTIAL,
          totalRecords: rows.length,
          importedRecords: importedCount,
          errorLog: JSON.stringify([err.message]),
        },
      });
      throw new BadRequestException('Database transaction failed during import: ' + err.message);
    }
  }

  async getUploadHistory() {
    return this.prisma.uploadHistory.findMany({
      include: {
        uploadedBy: {
          select: { name: true, username: true },
        },
      },
      orderBy: { uploadTimestamp: 'desc' },
    });
  }
}
