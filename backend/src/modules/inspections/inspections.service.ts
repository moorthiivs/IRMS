import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationStatus, TransactionStatus } from '@prisma/client';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { CorrectInspectionDto } from './dto/correct-inspection.dto';

@Injectable()
export class InspectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDrafts(userId: string) {
    return this.prisma.inspectionDraft.findMany({
      where: { userId },
      include: {
        part: true,
        operation: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async saveDraft(userId: string, dto: any) {
    const { partId, operationId, shiftId, intervalName, mcNo, lotNumber, remarks, readings } = dto;
    return this.prisma.inspectionDraft.upsert({
      where: {
        userId_partId_operationId: {
          userId,
          partId,
          operationId,
        }
      },
      update: {
        shiftId,
        intervalName,
        mcNo,
        lotNumber,
        remarks,
        readingsData: JSON.stringify(readings || {}),
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
        readingsData: JSON.stringify(readings || {}),
      }
    });
  }

  async deleteDraft(id: string) {
    await this.prisma.inspectionDraft.delete({
      where: { id },
    });
    return { message: 'Draft deleted successfully' };
  }

  async checkInspectionDue(
    partId: string,
    operationId: string,
    intervalName: string,
    shiftId?: string,
    dateStr?: string,
    mcNo?: string,
  ) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    
    // Define start and end of the target day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await this.prisma.inspectionTransaction.findFirst({
      where: {
        partId,
        operationId,
        intervalName,
        ...(shiftId ? { shiftId } : {}),
        ...(mcNo ? { mcNo } : {}),
        inspectionTimestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return {
      due: !existing,
      message: existing
        ? `Inspection already completed for this Interval (${intervalName}) today.`
        : 'Inspection is due.',
    };
  }

  async createInspection(userId: string, dto: CreateInspectionDto) {
    const { partId, operationId, shiftId, lotNumber, mcNo, intervalName, remarks, details } = dto;

    // 0. Check if lot number is required
    const lotNumberRequired = await this.prisma.systemSettings.findUnique({ where: { key: 'lot_number_required' } });
    if ((!lotNumberRequired || lotNumberRequired.value === 'true') && (!lotNumber || lotNumber.trim() === '')) {
      throw new BadRequestException('Lot Number is required. You can make it optional in Settings.');
    }

    // 1. Prevent Duplicate Entry
    const { due, message } = await this.checkInspectionDue(partId, operationId, intervalName, shiftId, undefined, mcNo);
    if (!due) {
      throw new BadRequestException(message);
    }

    // 2. Fetch parameter specifications to validate the readings
    const dbParams = await this.prisma.inspectionParameter.findMany({
      where: { partId, operationId },
    });

    const paramMap = new Map(dbParams.map((p) => [p.id, p]));

    let overallStatus: TransactionStatus = TransactionStatus.PASSED;
    const finalDetailsData: any[] = [];

    for (const detail of details) {
      const param = paramMap.get(detail.parameterId);
      if (!param) {
        throw new BadRequestException(`Invalid inspection parameter ID: ${detail.parameterId}`);
      }

      let detailStatus: ValidationStatus = ValidationStatus.PASS;
      const obsStr = String(detail.observedValue).trim().toLowerCase();

      // Check numeric limits if they are set
      if (param.controlLimitMin !== null || param.controlLimitMax !== null) {
        const val = parseFloat(detail.observedValue);
        if (isNaN(val)) {
          // If not a number, but limits are numeric, it's a FAIL
          detailStatus = ValidationStatus.FAIL;
        } else {
          const EPSILON = 1e-6;
          if (param.controlLimitMin !== null && val < param.controlLimitMin - EPSILON) {
            detailStatus = ValidationStatus.FAIL;
          }
          if (param.controlLimitMax !== null && val > param.controlLimitMax + EPSILON) {
            detailStatus = ValidationStatus.FAIL;
          }
        }
      } else {
        // Visual/non-numeric parameter: "ok" or matching standard text is PASS, "ng" or empty is FAIL
        if (obsStr === 'ng' || obsStr === 'fail' || obsStr === '') {
          detailStatus = ValidationStatus.FAIL;
        }
      }

      if (detailStatus === ValidationStatus.FAIL) {
        overallStatus = TransactionStatus.REJECTED; // Visual Feedback Lock: any fail rejects entire lot
      }

      finalDetailsData.push({
        parameterId: detail.parameterId,
        observedValue: String(detail.observedValue),
        status: detailStatus,
      });
    }

    // 2.5 Get customer ID from part
    const part = await this.prisma.part.findUnique({ where: { id: partId } });

    // 3. Save Inspection Transaction + Details
    const transaction = await this.prisma.inspectionTransaction.create({
      data: {
        inspectorId: userId,
        partId,
        operationId,
        shiftId,
        lotNumber,
        mcNo,
        intervalName,
        remarks,
        status: overallStatus,
        customerId: part?.customerId,
        details: {
          create: finalDetailsData,
        },
      },
      include: {
        details: {
          include: {
            parameter: true,
          },
        },
        part: true,
        operation: true,
        shift: true,
        inspector: {
          select: { name: true, role: true },
        },
      },
    });

    // 4. Delete draft if it exists
    try {
      await this.prisma.inspectionDraft.delete({
        where: {
          userId_partId_operationId: {
            userId,
            partId,
            operationId,
          }
        }
      });
    } catch (e) {
      // Ignore if draft doesn't exist
    }

    return transaction;
  }

  async getRecentInspections(user: any, status?: string, approval?: string, dateStr?: string, shiftId?: string, partId?: string, operationId?: string, hasMc?: string) {
    const where: any = {};
    if (user && (user.role === 'SUPERVISOR' || user.role === 'OPERATOR' || user.role === 'INSPECTOR') && user.customerId) {
      where.customerId = user.customerId;
    }

    if (status === 'PASSED' || status === 'REJECTED') {
      where.status = status as any;
    }

    if (approval === 'pending') {
      where.approvedById = null;
    }

    if (dateStr) {
      const targetDate = new Date(dateStr);
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);
      where.inspectionTimestamp = { gte: start, lte: end };
    }

    if (shiftId) {
      where.shiftId = shiftId;
    }

    if (partId) {
      where.partId = partId;
    }

    if (operationId) {
      where.operationId = operationId;
    }

    if (hasMc === 'true') {
      where.mcNo = { not: null };
    }

    const query: any = {
      where,
      include: {
        part: { include: { customer: true } },
        operation: true,
        shift: true,
        inspector: {
          select: { name: true },
        },
      },
      orderBy: { inspectionTimestamp: 'desc' },
    };

    if (!dateStr) {
      query.take = 100;
    }

    return this.prisma.inspectionTransaction.findMany(query);
  }

  async getInspectionById(id: string) {
    return this.prisma.inspectionTransaction.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            parameter: true,
          },
        },
        corrections: {
          include: {
            correctedBy: {
              select: { name: true, username: true },
            },
            detail: {
              include: { parameter: true },
            },
          },
          orderBy: { correctedAt: 'asc' },
        },
        part: true,
        operation: true,
        shift: true,
        inspector: {
          select: { name: true, signature: true },
        },
        approvedBy: {
          select: { name: true, signature: true },
        },
      },
    });
  }

  async getDashboardData(user: any) {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const whereBase: any = {};
    if (user && (user.role === 'SUPERVISOR' || user.role === 'OPERATOR' || user.role === 'INSPECTOR') && user.customerId) {
      whereBase.customerId = user.customerId;
    }

    const [
      totalInspections,
      passCount,
      failCount,
      todayInspections,
      approvalPendingCount,
      shifts,
      transactionsToday,
    ] = await Promise.all([
      this.prisma.inspectionTransaction.count({ where: whereBase }),
      this.prisma.inspectionTransaction.count({ where: { ...whereBase, status: TransactionStatus.PASSED } }),
      this.prisma.inspectionTransaction.count({ where: { ...whereBase, status: TransactionStatus.REJECTED } }),
      this.prisma.inspectionTransaction.count({
        where: { ...whereBase, inspectionTimestamp: { gte: startOfDay, lte: endOfDay } },
      }),
      this.prisma.inspectionTransaction.count({
        where: { ...whereBase, approvedById: null },
      }),
      this.prisma.shift.findMany(),
      this.prisma.inspectionTransaction.findMany({
        where: { ...whereBase, inspectionTimestamp: { gte: startOfDay, lte: endOfDay } },
        include: { shift: true, part: { include: { customer: true } } },
      }),
    ]);

    // Calculate shift summaries
    const shiftSummary = shifts.reduce((acc, shift) => {
      acc[shift.name] = { total: 0, pass: 0, fail: 0 };
      return acc;
    }, {} as Record<string, { total: number; pass: number; fail: number }>);

    transactionsToday.forEach((tx) => {
      const sName = tx.shift?.name;
      if (sName && shiftSummary[sName]) {
        shiftSummary[sName].total++;
        if (tx.status === TransactionStatus.PASSED) {
          shiftSummary[sName].pass++;
        } else {
          shiftSummary[sName].fail++;
        }
      }
    });

    // ── Customer-wise summary (today) ────────────────────────────
    const customerSummary: Record<string, { name: string; total: number; pass: number; fail: number }> = {};
    transactionsToday.forEach((tx) => {
      const custName = tx.part?.customer?.name || 'Unassigned';
      const custId = tx.part?.customer?.id || '__unassigned';
      if (!customerSummary[custId]) {
        customerSummary[custId] = { name: custName, total: 0, pass: 0, fail: 0 };
      }
      customerSummary[custId].total++;
      if (tx.status === TransactionStatus.PASSED) {
        customerSummary[custId].pass++;
      } else {
        customerSummary[custId].fail++;
      }
    });

    // ── Part-wise summary (today) ────────────────────────────────
    const partSummary: Record<string, { partNumber: string; customerName: string | null; total: number; pass: number; fail: number }> = {};
    transactionsToday.forEach((tx) => {
      const partId = tx.partId;
      if (!partSummary[partId]) {
        partSummary[partId] = {
          partNumber: tx.part?.partNumber || 'Unknown',
          customerName: tx.part?.customer?.name || null,
          total: 0, pass: 0, fail: 0,
        };
      }
      partSummary[partId].total++;
      if (tx.status === TransactionStatus.PASSED) {
        partSummary[partId].pass++;
      } else {
        partSummary[partId].fail++;
      }
    });

    // Simple pending calculation:
    // Suppose for every Part & Operation combination in the system, we expect an inspection in 1 Half and 2 Half for each active shift today.
    // Let's determine how many active Part-Operation links exist.
    const partOpsCount = await this.prisma.partOperation.count();
    
    // Total scheduled = parts * operations configured * shifts * 2 (1 Half, 2 Half)
    const activeShiftsCount = shifts.length;
    const totalExpectedToday = partOpsCount * activeShiftsCount * 2;
    const pendingCount = Math.max(0, totalExpectedToday - todayInspections);

    // Get last 7 days activity
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentTransactions = await this.prisma.inspectionTransaction.findMany({
      where: {
        inspectionTimestamp: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        inspectionTimestamp: true,
        status: true,
      },
    });

    const activityMap = new Map<string, { date: string; passed: number; rejected: number }>();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      activityMap.set(dateStr, { date: dateStr, passed: 0, rejected: 0 });
    }

    recentTransactions.forEach((tx) => {
      const dateStr = new Date(tx.inspectionTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (activityMap.has(dateStr)) {
        const dayData = activityMap.get(dateStr)!;
        if (tx.status === TransactionStatus.PASSED) {
          dayData.passed++;
        } else {
          dayData.rejected++;
        }
      }
    });

    const categories = Array.from(activityMap.keys());
    const passedData = Array.from(activityMap.values()).map(d => d.passed);
    const rejectedData = Array.from(activityMap.values()).map(d => d.rejected);

    // --- MACHINE SUMMARY ---
    const customersForMc = await this.prisma.customer.findMany({
      where: whereBase.customerId ? { id: whereBase.customerId } : undefined,
      select: { machines: true }
    });
    const totalMcCount = customersForMc.reduce((sum, c) => sum + (c.machines ? c.machines.length : 0), 0);

    const activeMcTransactions = transactionsToday.filter(tx => tx.mcNo !== null && tx.mcNo !== undefined && tx.mcNo.trim() !== '');
    const activeMcSet = new Set(activeMcTransactions.map(t => t.mcNo));
    const activeMcCount = activeMcSet.size;
    const activeMcReportsTotal = activeMcTransactions.length;
    const activeMcReportsPassed = activeMcTransactions.filter(t => t.status === TransactionStatus.PASSED).length;
    const activeMcReportsFailed = activeMcTransactions.filter(t => t.status === TransactionStatus.REJECTED).length;

    const dynamicChart = {
      type: 'bar',
      series: [
        {
          name: 'Passed',
          data: passedData,
        },
        {
          name: 'Rejected',
          data: rejectedData,
        },
      ],
      options: {
        chart: {
          id: 'recent-activity-chart',
          toolbar: {
            show: false,
          },
        },
        colors: ['#40c057', '#fa5252'],
        xaxis: {
          categories: categories,
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        dataLabels: {
          enabled: false,
        },
        grid: {
          borderColor: '#f1f3f5',
          strokeDashArray: 4,
        },
        plotOptions: {
          bar: {
            borderRadius: 4,
            columnWidth: '55%',
          },
        },
      },
    };

    return {
      total: totalInspections,
      passed: passCount,
      rejected: failCount,
      pending: pendingCount,
      approvalPending: approvalPendingCount,
      totalInspections,
      passCount,
      failCount,
      todayInspections,
      pendingCount,
      approvalPendingCount,
      shiftSummary,
      customerSummary,
      partSummary,
      recentActivity: dynamicChart,
      machineSummary: {
        totalMcCount,
        activeMcCount,
        activeMcReportsTotal,
        activeMcReportsPassed,
        activeMcReportsFailed,
      }
    };
  }

  async getDailyOptions(user: any, dateStr: string, customerId?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const whereBase: any = {
      inspectionTimestamp: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (customerId) {
      whereBase.customerId = customerId;
    }

    if (user && (user.role === 'SUPERVISOR' || user.role === 'OPERATOR' || user.role === 'INSPECTOR') && user.customerId) {
      whereBase.customerId = user.customerId;
    }

    const transactions = await this.prisma.inspectionTransaction.findMany({
      where: whereBase,
      select: {
        partId: true,
        operationId: true,
        mcNo: true,
      },
      distinct: ['partId', 'operationId', 'mcNo'],
    });

    const partIds = [...new Set(transactions.map(t => t.partId))];
    const operationIds = [...new Set(transactions.map(t => t.operationId))];
    const mcNos = [...new Set(transactions.map(t => t.mcNo).filter(Boolean))];

    return { partIds, operationIds, mcNos };
  }

  async getDailyReport(user: any, partId: string, operationId: string, mcNo?: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const whereBase: any = {
      partId,
      operationId,
      ...(mcNo ? { mcNo } : {}),
      inspectionTimestamp: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (user && (user.role === 'SUPERVISOR' || user.role === 'OPERATOR' || user.role === 'INSPECTOR') && user.customerId) {
      whereBase.customerId = user.customerId;
    }

    const transactions = await this.prisma.inspectionTransaction.findMany({
      where: whereBase,
      include: {
        details: {
          include: {
            parameter: true,
          },
        },
        inspector: {
          select: { name: true, username: true, signature: true },
        },
        approvedBy: {
          select: { name: true, username: true, signature: true },
        },
        shift: true,
      },
      orderBy: {
        inspectionTimestamp: 'asc',
      },
    });

    return transactions;
  }

  async approveInspection(transactionId: string, approverId: string) {
    const tx = await this.prisma.inspectionTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) {
      throw new BadRequestException('Inspection transaction not found.');
    }

    if (tx.approvedById) {
      throw new BadRequestException('This inspection has already been approved.');
    }

    return this.prisma.inspectionTransaction.update({
      where: { id: transactionId },
      data: {
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: {
        inspector: {
          select: { name: true, signature: true },
        },
        approvedBy: {
          select: { name: true, signature: true },
        },
        part: true,
        operation: true,
      },
    });
  }

  async correctInspection(transactionId: string, userId: string, dto: CorrectInspectionDto) {
    const tx = await this.prisma.inspectionTransaction.findUnique({
      where: { id: transactionId },
      include: { details: { include: { parameter: true } } },
    });

    if (!tx) {
      throw new BadRequestException('Inspection transaction not found.');
    }

    if (tx.status !== TransactionStatus.REJECTED) {
      throw new BadRequestException('Only REJECTED inspections can be corrected.');
    }

    // Process each correction
    for (const correction of dto.corrections) {
      const detail = tx.details.find(d => d.id === correction.detailId);
      if (!detail) {
        throw new BadRequestException(`Inspection detail not found: ${correction.detailId}`);
      }

      if (detail.status !== ValidationStatus.FAIL) {
        throw new BadRequestException(`Only failed parameters can be corrected. Parameter "${detail.parameter?.parameterName}" is not failed.`);
      }

      const previousValue = detail.observedValue;
      const previousStatus = detail.status;

      // Revalidate the corrected value
      let newStatus: ValidationStatus = ValidationStatus.PASS;
      const obsStr = String(correction.correctedValue).trim().toLowerCase();
      const param = detail.parameter;

      if (param && (param.controlLimitMin !== null || param.controlLimitMax !== null)) {
        const val = parseFloat(correction.correctedValue);
        if (isNaN(val)) {
          newStatus = ValidationStatus.FAIL;
        } else {
          const EPSILON = 1e-6;
          if (param.controlLimitMin !== null && val < param.controlLimitMin - EPSILON) {
            newStatus = ValidationStatus.FAIL;
          }
          if (param.controlLimitMax !== null && val > param.controlLimitMax + EPSILON) {
            newStatus = ValidationStatus.FAIL;
          }
        }
      } else {
        if (obsStr === 'ng' || obsStr === 'fail' || obsStr === '') {
          newStatus = ValidationStatus.FAIL;
        }
      }

      // Create correction audit entry
      await this.prisma.correctionEntry.create({
        data: {
          transactionId,
          detailId: correction.detailId,
          previousValue,
          correctedValue: String(correction.correctedValue),
          previousStatus,
          correctedStatus: newStatus,
          correctedById: userId,
          remarks: dto.remarks || null,
        },
      });

      // Update the detail with corrected value and new status
      await this.prisma.inspectionDetail.update({
        where: { id: correction.detailId },
        data: {
          observedValue: String(correction.correctedValue),
          status: newStatus,
        },
      });
    }

    // Re-evaluate overall transaction status
    const updatedDetails = await this.prisma.inspectionDetail.findMany({
      where: { transactionId },
    });

    const anyStillFailed = updatedDetails.some(d => d.status === ValidationStatus.FAIL);
    const newOverallStatus = anyStillFailed ? TransactionStatus.REJECTED : TransactionStatus.PASSED;

    const updatedTx = await this.prisma.inspectionTransaction.update({
      where: { id: transactionId },
      data: { status: newOverallStatus },
      include: {
        details: { include: { parameter: true } },
        corrections: {
          include: {
            correctedBy: { select: { name: true, username: true } },
            detail: { include: { parameter: true } },
          },
          orderBy: { correctedAt: 'asc' },
        },
        part: true,
        operation: true,
        shift: true,
        inspector: { select: { name: true, signature: true } },
      },
    });

    return updatedTx;
  }

  async getAuditTrail(transactionId: string) {
    const tx = await this.prisma.inspectionTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) {
      throw new BadRequestException('Inspection transaction not found.');
    }

    return this.prisma.correctionEntry.findMany({
      where: { transactionId },
      include: {
        correctedBy: {
          select: { name: true, username: true },
        },
        detail: {
          include: { parameter: true },
        },
      },
      orderBy: { correctedAt: 'asc' },
    });
  }

  async deleteInspection(id: string) {
    const tx = await this.prisma.inspectionTransaction.findUnique({
      where: { id },
    });

    if (!tx) {
      throw new BadRequestException('Inspection not found');
    }

    // Relying on Prisma's onDelete: Cascade for details and corrections
    await this.prisma.inspectionTransaction.delete({
      where: { id },
    });

    return { message: 'Inspection report deleted successfully' };
  }

  async getTrends(user: any, partId: string, operationId: string, days: number = 7, startDate?: string, endDate?: string) {
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date();
      end.setHours(23, 59, 59, 999);
      start = new Date();
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
    }

    const whereBase: any = {
      partId,
      operationId,
      inspectionTimestamp: { gte: start, lte: end },
    };

    if (user && (user.role === 'SUPERVISOR' || user.role === 'OPERATOR' || user.role === 'INSPECTOR') && user.customerId) {
      whereBase.customerId = user.customerId;
    }

    // Get all transactions with details in the date range
    const transactions = await this.prisma.inspectionTransaction.findMany({
      where: whereBase,
      include: {
        shift: true,
        details: {
          include: { parameter: true },
        },
      },
      orderBy: { inspectionTimestamp: 'asc' },
    });

    // Get parameters for this part/operation
    const parameters = await this.prisma.inspectionParameter.findMany({
      where: { partId, operationId },
      orderBy: { sequence: 'asc' },
    });

    // Helper to get YYYY-MM-DD in local time
    const toLocalDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Build daily aggregation per parameter
    // Structure: { parameterId: { date: { min, max, avg, count, shiftCounts: { [shiftName]: count }, readings: [] } } }
    const trendMap: Record<string, Record<string, { 
      min: number; 
      max: number; 
      sum: number; 
      count: number; 
      shiftCounts: Record<string, number>;
      readings: Array<{ shiftName: string; interval: string; value: string; timestamp: Date }>
    }>> = {};

    transactions.forEach(tx => {
      const dateStr = toLocalDateStr(tx.inspectionTimestamp);
      const shiftName = tx.shift?.name || 'Unassigned Shift';
      tx.details.forEach(detail => {
        const val = parseFloat(detail.observedValue);
        if (isNaN(val)) return; // Skip non-numeric values

        if (!trendMap[detail.parameterId]) trendMap[detail.parameterId] = {};
        if (!trendMap[detail.parameterId][dateStr]) {
          trendMap[detail.parameterId][dateStr] = { 
            min: val, 
            max: val, 
            sum: val, 
            count: 1, 
            shiftCounts: { [shiftName]: 1 },
            readings: [{
              shiftName,
              interval: tx.intervalName,
              value: detail.observedValue,
              timestamp: tx.inspectionTimestamp
            }]
          };
        } else {
          const entry = trendMap[detail.parameterId][dateStr];
          entry.min = Math.min(entry.min, val);
          entry.max = Math.max(entry.max, val);
          entry.sum += val;
          entry.count++;
          entry.shiftCounts[shiftName] = (entry.shiftCounts[shiftName] || 0) + 1;
          entry.readings.push({
            shiftName,
            interval: tx.intervalName,
            value: detail.observedValue,
            timestamp: tx.inspectionTimestamp
          });
        }
      });
    });

    // Build date labels
    const dateLabels: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      dateLabels.push(toLocalDateStr(current));
      current.setDate(current.getDate() + 1);
    }

    // Build series per parameter
    const parameterTrends = parameters.map(param => {
      const paramData = trendMap[param.id] || {};
      return {
        parameterId: param.id,
        parameterName: param.parameterName,
        specText: param.specText,
        nominalValue: param.nominalValue,
        methodOfChecking: param.methodOfChecking,
        controlLimitMin: param.controlLimitMin,
        controlLimitMax: param.controlLimitMax,
        daily: dateLabels.map(date => {
          const entry = paramData[date];
          return {
            date,
            min: entry ? entry.min : null,
            max: entry ? entry.max : null,
            avg: entry ? Math.round((entry.sum / entry.count) * 1000) / 1000 : null,
            count: entry ? entry.count : 0,
            shiftCounts: entry ? entry.shiftCounts : {},
            readings: entry ? entry.readings : [],
          };
        }),
      };
    });

    return {
      dateLabels,
      parameters: parameterTrends,
    };
  }
}
