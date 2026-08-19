import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SpcService {
  constructor(private readonly prisma: PrismaService) {}

  // ── SPC Characteristics / Master Data Methods ───────────────────
  async uploadCharacteristics(records: Array<{
    productDescription?: string;
    partNumber: string;
    machineNumber?: string;
    qualityCharacteristic: string;
    usl?: number;
    lsl?: number;
    frequency?: string;
    subgroupSize?: number;
    customerName?: string;
    customerId?: string;
  }>) {
    if (!records || !records.length) {
      throw new BadRequestException('No SPC characteristic records provided.');
    }

    const upserted = [];
    for (const rec of records) {
      if (!rec.partNumber || !rec.qualityCharacteristic) continue;

      let finalCustomerId = rec.customerId || null;
      if (!finalCustomerId && rec.customerName) {
        const foundCustomer = await this.prisma.customer.findFirst({
          where: { name: { equals: rec.customerName, mode: 'insensitive' } },
        });
        if (foundCustomer) {
          finalCustomerId = foundCustomer.id;
        }
      }

      const item = await this.prisma.spcCharacteristic.upsert({
        where: {
          partNumber_machineNumber_qualityCharacteristic: {
            partNumber: rec.partNumber,
            machineNumber: rec.machineNumber || '',
            qualityCharacteristic: rec.qualityCharacteristic,
          },
        },
        update: {
          productDescription: rec.productDescription || null,
          usl: rec.usl !== undefined && !isNaN(rec.usl) ? rec.usl : null,
          lsl: rec.lsl !== undefined && !isNaN(rec.lsl) ? rec.lsl : null,
          frequency: rec.frequency || '1/shift',
          subgroupSize: rec.subgroupSize || 5,
          customerId: finalCustomerId,
        },
        create: {
          productDescription: rec.productDescription || null,
          partNumber: rec.partNumber,
          machineNumber: rec.machineNumber || '',
          qualityCharacteristic: rec.qualityCharacteristic,
          usl: rec.usl !== undefined && !isNaN(rec.usl) ? rec.usl : null,
          lsl: rec.lsl !== undefined && !isNaN(rec.lsl) ? rec.lsl : null,
          frequency: rec.frequency || '1/shift',
          subgroupSize: rec.subgroupSize || 5,
          customerId: finalCustomerId,
        },
      });

      // Ensure Part exists or create if missing
      const existingPart = await this.prisma.part.findUnique({
        where: { partNumber: rec.partNumber },
      });

      if (!existingPart) {
        await this.prisma.part.create({
          data: {
            partNumber: rec.partNumber,
            partName: rec.productDescription || rec.partNumber,
          },
        }).catch(() => null);
      }

      upserted.push(item);
    }

    return {
      message: `Successfully processed ${upserted.length} SPC characteristics.`,
      records: upserted,
    };
  }

  async getCharacteristics(filters?: { partNumber?: string; machineNumber?: string }) {
    const where: any = {};
    if (filters?.partNumber) where.partNumber = filters.partNumber;
    if (filters?.machineNumber) where.machineNumber = filters.machineNumber;

    return this.prisma.spcCharacteristic.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ partNumber: 'asc' }, { qualityCharacteristic: 'asc' }],
    });
  }

  async updateCharacteristic(id: string, data: any) {
    const existing = await this.prisma.spcCharacteristic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`SPC Characteristic ${id} not found`);

    return this.prisma.spcCharacteristic.update({
      where: { id },
      data: {
        productDescription: data.productDescription !== undefined ? data.productDescription : existing.productDescription,
        partNumber: data.partNumber !== undefined ? data.partNumber : existing.partNumber,
        machineNumber: data.machineNumber !== undefined ? data.machineNumber : existing.machineNumber,
        qualityCharacteristic: data.qualityCharacteristic !== undefined ? data.qualityCharacteristic : existing.qualityCharacteristic,
        usl: data.usl !== undefined ? (data.usl !== null && !isNaN(parseFloat(data.usl)) ? parseFloat(data.usl) : null) : existing.usl,
        lsl: data.lsl !== undefined ? (data.lsl !== null && !isNaN(parseFloat(data.lsl)) ? parseFloat(data.lsl) : null) : existing.lsl,
        frequency: data.frequency !== undefined ? data.frequency : existing.frequency,
        subgroupSize: data.subgroupSize !== undefined ? parseInt(data.subgroupSize, 10) : existing.subgroupSize,
        customerId: data.customerId !== undefined ? data.customerId : existing.customerId,
      },
    });
  }

  async deleteCharacteristic(id: string) {
    return this.prisma.spcCharacteristic.delete({
      where: { id },
    });
  }

  // ── SPC Dashboard Metrics ───────────────────────────────────────
  async getDashboardData(user: any, filters?: { customerId?: string; partNumber?: string; machineNumber?: string }) {
    const totalCharacteristics = await this.prisma.spcCharacteristic.count();
    const totalSpcDataRecords = await this.prisma.spcData.count();
    const totalTransactions = await this.prisma.spcTransaction.count();
    const passedTransactions = await this.prisma.spcTransaction.count({ where: { status: 'PASSED' } });
    const rejectedTransactions = await this.prisma.spcTransaction.count({ where: { status: 'REJECTED' } });

    // Recent SPC data records
    const recentData = await this.prisma.spcData.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    // Recent transactions
    const recentTransactions = await this.prisma.spcTransaction.findMany({
      include: {
        part: { select: { partNumber: true, partName: true } },
        operation: { select: { operationNumber: true } },
        inspector: { select: { name: true } },
      },
      orderBy: { inspectionTimestamp: 'desc' },
      take: 10,
    });

    // Aggregate unique active machines & parts
    const characteristics = await this.prisma.spcCharacteristic.findMany();
    const machines = Array.from(new Set(characteristics.map(c => c.machineNumber).filter(Boolean)));
    const parts = Array.from(new Set(characteristics.map(c => c.partNumber).filter(Boolean)));

    return {
      metrics: {
        totalCharacteristics,
        totalSpcDataRecords,
        totalSubgroupsSampled: totalTransactions + totalSpcDataRecords,
        passedLots: passedTransactions,
        rejectedLots: rejectedTransactions,
        totalMachinesConfigured: machines.length,
        totalPartsConfigured: parts.length,
        passRate: totalTransactions > 0 ? ((passedTransactions / totalTransactions) * 100).toFixed(1) : '100.0',
      },
      recentData,
      recentTransactions,
      machines,
      parts,
    };
  }

  // ── SPC Drafts ──────────────────────────────────────────────────
  async getDrafts(userId: string) {
    return this.prisma.spcDraft.findMany({
      where: { userId },
      include: {
        part: { select: { id: true, partNumber: true, partName: true } },
        operation: { select: { id: true, operationNumber: true, operationName: true } },
        shift: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async saveDraft(userId: string, dto: any) {
    const { partId, operationId, shiftId, intervalName, mcNo, lotNumber, remarks, readingsData } = dto;
    return this.prisma.spcDraft.upsert({
      where: {
        userId_partId_operationId: {
          userId,
          partId,
          operationId,
        },
      },
      update: {
        shiftId,
        intervalName,
        mcNo,
        lotNumber,
        remarks,
        readingsData: typeof readingsData === 'string' ? readingsData : JSON.stringify(readingsData),
      },
      create: {
        userId,
        partId,
        operationId,
        shiftId,
        intervalName,
        mcNo,
        lotNumber,
        remarks,
        readingsData: typeof readingsData === 'string' ? readingsData : JSON.stringify(readingsData),
      },
    });
  }

  async deleteDraft(id: string) {
    return this.prisma.spcDraft.delete({
      where: { id },
    });
  }

  // ── SPC Transactions ──────────────────────────────────────────
  async checkDue(partId: string, operationId: string, shiftId: string, intervalName: string) {
    const existing = await this.prisma.spcTransaction.findFirst({
      where: {
        partId,
        operationId,
        shiftId,
        intervalName,
      },
    });
    return !!existing;
  }

  async getMonthlyStatus(year: number, month: number, partId: string, operationId: string, mcNo: string) {
    if (!partId || !operationId || !mcNo) return {};

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const today = new Date();

    const shifts = await this.prisma.shift.findMany();

    // Dynamically calculate expected intervals per shift
    const parameters = await this.prisma.inspectionParameter.findMany({
      where: { partId, operationId }
    });

    let maxIntervalsPerShift = 1; // Default fallback
    if (parameters.length > 0) {
      maxIntervalsPerShift = 0;
      for (const param of parameters) {
        if (param.frequencyUnit === 'day' || param.frequencyUnit === 'Day-wise') {
          continue;
        }
        
        let target = 1;
        const freqStr = String(param.freqOfInspn || '').toLowerCase().trim();
        const parsedFreq = parseInt(freqStr.replace(/\D/g, ''), 10);
        if (!isNaN(parsedFreq) && parsedFreq > 0) {
          target = parsedFreq;
        }
        
        if (target > maxIntervalsPerShift) {
          maxIntervalsPerShift = target;
        }
      }
    }

    const expectedPerDay = maxIntervalsPerShift === 0 ? 1 : shifts.length * maxIntervalsPerShift;

    const transactions = await this.prisma.spcTransaction.findMany({
      where: {
        partId,
        operationId,
        mcNo,
        inspectionTimestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        inspectionTimestamp: true,
      },
    });

    const statusMap: Record<string, 'COMPLETE' | 'PARTIAL' | 'MISSING'> = {};
    const countsPerDay: Record<string, number> = {};

    transactions.forEach(tx => {
      const dateStr = `${tx.inspectionTimestamp.getFullYear()}-${String(tx.inspectionTimestamp.getMonth() + 1).padStart(2, '0')}-${String(tx.inspectionTimestamp.getDate()).padStart(2, '0')}`;
      countsPerDay[dateStr] = (countsPerDay[dateStr] || 0) + 1;
    });

    const daysInMonth = endDate.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date > today) continue;

      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const count = countsPerDay[dateStr] || 0;

      if (count >= expectedPerDay) {
        statusMap[dateStr] = 'COMPLETE';
      } else if (count > 0) {
        statusMap[dateStr] = 'PARTIAL';
      } else {
        statusMap[dateStr] = 'MISSING';
      }
    }

    return statusMap;
  }

  async createSpcTransaction(userId: string, dto: any) {
    const { shiftId, partId, operationId, lotNumber, mcNo, intervalName, remarks, details, entryDate, operatorId } = dto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === 'ADMIN';
    const finalInspectorId = (isAdmin && operatorId) ? operatorId : userId;
    const finalDate = (isAdmin && entryDate) ? new Date(entryDate) : new Date();

    const part = await this.prisma.part.findUnique({
      where: { id: partId },
      include: { customer: true },
    });

    if (!part) {
      throw new NotFoundException(`Part with ID ${partId} not found`);
    }

    const parameters = await this.prisma.inspectionParameter.findMany({
      where: { partId, operationId },
    });

    let overallStatus: 'PASSED' | 'REJECTED' = 'PASSED';
    const detailRecords = details.map((d: any) => {
      const param = parameters.find((p) => p.id === d.parameterId);
      let status: 'PASS' | 'FAIL' = 'PASS';

      if (param && d.observedValue) {
        const val = parseFloat(d.observedValue);
        if (!isNaN(val)) {
          if (param.controlLimitMin !== null && param.controlLimitMin !== undefined && val < param.controlLimitMin) {
            status = 'FAIL';
          }
          if (param.controlLimitMax !== null && param.controlLimitMax !== undefined && val > param.controlLimitMax) {
            status = 'FAIL';
          }
        }
      }

      if (status === 'FAIL') overallStatus = 'REJECTED';

      return {
        parameterId: d.parameterId,
        observedValue: String(d.observedValue),
        status,
      };
    });

    const transaction = await this.prisma.spcTransaction.create({
      data: {
        inspectorId: finalInspectorId,
        inspectionTimestamp: finalDate,
        shiftId: shiftId || null,
        partId,
        operationId,
        lotNumber: lotNumber || null,
        mcNo: mcNo || null,
        intervalName,
        remarks: remarks || null,
        status: overallStatus,
        customerId: part.customerId,
        details: {
          create: detailRecords,
        },
      },
      include: {
        part: true,
        operation: true,
        details: { include: { parameter: true } },
      },
    });

    // Delete matching draft if exists
    await this.prisma.spcDraft.deleteMany({
      where: { userId, partId, operationId },
    });

    return transaction;
  }

  async getRecent(user: any, filters?: any) {
    const whereTx: any = {};
    const whereSpcData: any = {};

    if (user.role === 'INSPECTOR') {
      whereTx.inspectorId = user.id;
    } else if (user.customerId) {
      whereTx.customerId = user.customerId;
    }

    if (filters?.status) whereTx.status = filters.status;
    if (filters?.partId) whereTx.partId = filters.partId;
    if (filters?.operationId) whereTx.operationId = filters.operationId;
    if (filters?.shiftId) whereTx.shiftId = filters.shiftId;
    if (filters?.customerId) whereTx.customerId = filters.customerId;
    if (filters?.mcNo || filters?.machineNumber) whereTx.mcNo = filters.mcNo || filters.machineNumber;

    if (filters?.partNumber) {
      whereSpcData.partNumber = filters.partNumber;
      const p = await this.prisma.part.findUnique({ where: { partNumber: filters.partNumber } });
      if (p) whereTx.partId = p.id;
    }

    if (filters?.date) {
      const targetDate = new Date(filters.date);
      const startOfDay = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
      const endOfDay = new Date(new Date(targetDate).setHours(23, 59, 59, 999));
      whereTx.inspectionTimestamp = { gte: startOfDay, lte: endOfDay };
      whereSpcData.timestamp = { gte: startOfDay, lte: endOfDay };
    }

    const transactions = await this.prisma.spcTransaction.findMany({
      where: whereTx,
      include: {
        inspector: { select: { id: true, name: true, username: true } },
        part: { select: { id: true, partNumber: true, partName: true } },
        operation: { select: { id: true, operationNumber: true, operationName: true } },
        shift: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        details: { include: { parameter: true } },
      },
      orderBy: { inspectionTimestamp: 'desc' },
      take: 100,
    });

    const spcDataRecords = await this.prisma.spcData.findMany({
      where: whereSpcData,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    const partNumbers = Array.from(new Set(spcDataRecords.map(s => s.partNumber)));
    const configuredChars = await this.prisma.spcCharacteristic.findMany({
      where: { partNumber: { in: partNumbers } },
    });

    const charDescMap = new Map<string, string>();
    configuredChars.forEach((c) => {
      if (c.productDescription) {
        charDescMap.set(`${c.partNumber}___${c.qualityCharacteristic}`, c.productDescription);
      }
    });

    const groupedSpcData: { [groupKey: string]: any[] } = {};
    spcDataRecords.forEach((sd) => {
      const minuteKey = sd.timestamp ? new Date(sd.timestamp).toISOString().slice(0, 16) : 'unknown';
      const key = `${sd.partNumber}___${sd.batchLot || 'nobatch'}___${minuteKey}`;
      if (!groupedSpcData[key]) {
        groupedSpcData[key] = [];
      }
      groupedSpcData[key].push(sd);
    });

    const mappedSpcData = Object.values(groupedSpcData).map((groupItems) => {
      const first = groupItems[0];
      const details = groupItems.map((sd) => {
        let sampleVals: number[] = [];
        try { sampleVals = JSON.parse(sd.sampleValues); } catch {}
        const isPassed = sampleVals.every(v => (sd.usl === null || v <= sd.usl) && (sd.lsl === null || v >= sd.lsl));
        const prodDesc = charDescMap.get(`${sd.partNumber}___${sd.parameterName}`) || undefined;

        return {
          id: sd.id,
          productDescription: prodDesc,
          parameter: {
            parameterName: sd.parameterName,
            productDescription: prodDesc,
            specText: `USL: ${sd.usl ?? '-'} / LSL: ${sd.lsl ?? '-'}`
          },
          qualityCharacteristic: sd.parameterName,
          usl: sd.usl,
          lsl: sd.lsl,
          observedValue: sampleVals.join(', '),
          status: isPassed ? 'PASS' : 'FAIL',
        };
      });

      const overallPassed = details.every(d => d.status === 'PASS');

      return {
        id: first.id,
        inspectionTimestamp: first.timestamp,
        part: { id: first.partNumber, partNumber: first.partNumber, partName: first.partNumber },
        partId: first.partNumber,
        operation: { id: 'N/A', operationNumber: 'SPC Subgroup', operationName: 'SPC Subgroup' },
        shift: { id: 'N/A', name: 'Standard' },
        mcNo: 'N/A',
        intervalName: 'Subgroup',
        inspector: { id: 'SYSTEM', name: 'Inspector', username: 'inspector' },
        status: overallPassed ? 'PASSED' : 'REJECTED',
        lotNumber: first.batchLot,
        details: details,
      };
    });

    return [...transactions, ...mappedSpcData];
  }

  async getById(id: string) {
    const tx = await this.prisma.spcTransaction.findUnique({
      where: { id },
      include: {
        inspector: { select: { id: true, name: true, username: true } },
        part: { select: { id: true, partNumber: true, partName: true } },
        operation: { select: { id: true, operationNumber: true, operationName: true } },
        shift: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        details: { include: { parameter: true } },
      },
    });
    if (!tx) throw new NotFoundException(`SPC Transaction ${id} not found`);
    return tx;
  }

  async deleteSpc(id: string) {
    const tx = await this.prisma.spcTransaction.findUnique({ where: { id } });
    if (tx) {
      return this.prisma.spcTransaction.delete({ where: { id } });
    }

    const spcData = await this.prisma.spcData.findUnique({ where: { id } });
    if (spcData) {
      const targetTime = spcData.timestamp;
      const startOfMinute = new Date(new Date(targetTime).setSeconds(0, 0));
      const endOfMinute = new Date(new Date(targetTime).setSeconds(59, 999));

      await this.prisma.spcData.deleteMany({
        where: {
          partNumber: spcData.partNumber,
          timestamp: { gte: startOfMinute, lte: endOfMinute },
        },
      });
      return { success: true };
    }

    return { success: true, message: 'Record already deleted or not found' };
  }

  // ── SPC Data Upload By Part Number ──────────────────────────────
  async uploadSpcDataByPartNo(records: Array<{
    partNumber: string;
    parameterName: string;
    subgroupSize?: number;
    usl?: number;
    lsl?: number;
    target?: number;
    sampleValues: number[];
    batchLot?: string;
    timestamp?: string | Date;
  }>) {
    if (!records || !records.length) {
      throw new BadRequestException('No SPC records provided for upload.');
    }

    const createdRecords = [];
    for (const record of records) {
      const part = await this.prisma.part.findUnique({
        where: { partNumber: record.partNumber },
      });

      if (!part) {
        throw new BadRequestException(`Part number '${record.partNumber}' does not exist in master data.`);
      }

      const spcRecord = await this.prisma.spcData.create({
        data: {
          partNumber: record.partNumber,
          parameterName: record.parameterName,
          subgroupSize: record.subgroupSize || 5,
          usl: record.usl || null,
          lsl: record.lsl || null,
          target: record.target || null,
          sampleValues: JSON.stringify(record.sampleValues || []),
          batchLot: record.batchLot || null,
          ...(record.timestamp ? { timestamp: new Date(record.timestamp) } : {}),
        },
      });
      createdRecords.push(spcRecord);
    }

    return {
      message: `Successfully uploaded ${createdRecords.length} SPC records.`,
      records: createdRecords,
    };
  }

  async getSpcDataByPartNumber(partNumber: string) {
    return this.prisma.spcData.findMany({
      where: { partNumber },
      orderBy: { timestamp: 'desc' },
    });
  }

  async checkDuplicate(dateString: string, partNumber: string, machineNumber?: string) {
    if (!dateString || !partNumber) return { isDuplicate: false };

    const targetDate = new Date(dateString);
    const startOfDay = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

    // Check spcData
    const existingSpcData = await this.prisma.spcData.findFirst({
      where: {
        partNumber,
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existingSpcData) {
      return { isDuplicate: true, message: `An SPC report for Part Number '${partNumber}' has already been submitted for date ${dateString.split('T')[0]}!` };
    }

    // Check spcTransaction
    const part = await this.prisma.part.findUnique({ where: { partNumber } });
    if (part) {
      const whereTx: any = {
        partId: part.id,
        inspectionTimestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
      if (machineNumber) whereTx.mcNo = machineNumber;

      const existingTx = await this.prisma.spcTransaction.findFirst({ where: whereTx });
      if (existingTx) {
        return { isDuplicate: true, message: `An SPC entry report for Part Number '${partNumber}' has already been submitted for date ${dateString.split('T')[0]}!` };
      }
    }

    return { isDuplicate: false };
  }
}
