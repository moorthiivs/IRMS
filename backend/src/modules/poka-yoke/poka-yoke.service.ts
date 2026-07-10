import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus, ValidationStatus } from '@prisma/client';
import * as xlsx from 'xlsx';

@Injectable()
export class PokaYokeService {
  constructor(private prisma: PrismaService) {}

  async getItemsByPart(partId: string) {
    return this.prisma.pokaYokeItem.findMany({
      where: { partId },
      orderBy: { sequence: 'asc' },
    });
  }

  async checkTransactionExists(partId: string, date: string) {
    const transactionDate = new Date(date);
    const startOfDay = new Date(transactionDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(transactionDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingTransaction = await this.prisma.pokaYokeTransaction.findFirst({
      where: {
        partId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return { exists: !!existingTransaction, transaction: existingTransaction };
  }

  async createTransaction(user: any, dto: any) {
    const { partId, date, shiftId, mcNo, readings } = dto;
    
    // date should be a valid ISO string representing the day
    const transactionDate = new Date(date);
    const startOfDay = new Date(transactionDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(transactionDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if an entry already exists for this part on this day
    const existingTransaction = await this.prisma.pokaYokeTransaction.findFirst({
      where: {
        partId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existingTransaction) {
      throw new BadRequestException('A Poka-Yoke entry for this part on this date already exists. Only one entry is allowed per day.');
    }

    // Get customer ID from part
    const part = await this.prisma.part.findUnique({ where: { id: partId } });

    // Create transaction
    const transaction = await this.prisma.pokaYokeTransaction.create({
      data: {
        inspectorId: user.id,
        partId,
        shiftId,
        mcNo,
        customerId: part?.customerId,
        date: transactionDate,
        status: TransactionStatus.PASSED, // Default to passed, logic below will update if needed
        details: {
          create: readings.map((r: any) => ({
            pokaYokeItemId: r.itemId,
            observedValue: r.value,
            status: r.status, // PASS or FAIL
            correctionAction: r.correctionAction || null,
          })),
        },
      },
      include: { details: true },
    });

    const hasFailures = transaction.details.some(d => d.status === ValidationStatus.FAIL);
    if (hasFailures) {
      await this.prisma.pokaYokeTransaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.REJECTED },
      });
    }

    return transaction;
  }

  async getReportData(user: any, partId: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // End date should be end of day to include the whole day
    end.setHours(23, 59, 59, 999);

    const items = await this.prisma.pokaYokeItem.findMany({
      where: { partId },
      orderBy: { sequence: 'asc' },
    });

    const whereBase: any = {
      partId,
      date: {
        gte: start,
        lte: end,
      },
    };

    if (user && (user.role === 'SUPERVISOR' || user.role === 'OPERATOR' || user.role === 'INSPECTOR') && user.customerId) {
      whereBase.customerId = user.customerId;
    }

    const transactions = await this.prisma.pokaYokeTransaction.findMany({
      where: whereBase,
      include: {
        details: {
          include: { pokaYokeItem: true }
        },
        inspector: {
          select: { name: true, signature: true },
        },
        adminUser: {
          select: { name: true, signature: true },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return {
      items,
      transactions,
    };
  }

  async importExcel(buffer: Buffer, providedPartId?: string, partNumber?: string, partName?: string) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // We expect headers: SI.No, Operation, POKA-YOKE, Checking method, Frequency
    // It might start at a specific row. Let's convert to JSON array of arrays.
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let partId = providedPartId;

    if (!partId) {
      if (!partNumber || !partName) {
        throw new BadRequestException("Part ID or Part Number/Name is required for Poka Yoke upload");
      }
      // Check if part already exists
      let part = await this.prisma.part.findUnique({ where: { partNumber } });
      if (!part) {
        part = await this.prisma.part.create({
          data: {
            partNumber,
            partName,
          }
        });
      }
      partId = part.id;
    } else {
      // Verify part exists
      const part = await this.prisma.part.findUnique({ where: { id: partId } });
      if (!part) {
        throw new NotFoundException("Part not found");
      }
    }

    let headerRowIndex = -1;
    // Find the header row (contains 'POKA-YOKE' or 'Operation')
    for (let i = 0; i < rawData.length; i++) {
      const row: any = rawData[i];
      if (row && row.some((cell: any) => typeof cell === 'string' && (cell.toUpperCase().includes('POKA-YOKE') || cell.toUpperCase().includes('POKA YOKE')))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new BadRequestException("Could not find header row with 'POKA-YOKE'");
    }

    const headers: any = rawData[headerRowIndex];
    
    // Find column indexes
    const opIndex = headers.findIndex((h: string) => h && h.toString().toUpperCase().includes('OPERATION'));
    const pyIndex = headers.findIndex((h: string) => h && h.toString().toUpperCase().includes('POKA-YOKE'));
    const cmIndex = headers.findIndex((h: string) => h && h.toString().toUpperCase().includes('CHECKING METHOD'));
    const freqIndex = headers.findIndex((h: string) => h && h.toString().toUpperCase().includes('FREQUENCY'));

    if (opIndex === -1 || pyIndex === -1) {
      throw new BadRequestException("Missing required columns: Operation or POKA-YOKE");
    }

    let imported = 0;
    let sequence = 0;

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row: any = rawData[i];
      if (!row || row.length === 0) continue;

      const operation = row[opIndex]?.toString().trim();
      const pokaYokeName = row[pyIndex]?.toString().trim();
      const checkingMethod = cmIndex !== -1 ? row[cmIndex]?.toString().trim() : null;
      const frequency = freqIndex !== -1 ? row[freqIndex]?.toString().trim() : null;

      if (!operation || !pokaYokeName) continue;

      await this.prisma.pokaYokeItem.upsert({
        where: {
          partId_operation_pokaYokeName: {
            partId,
            operation,
            pokaYokeName
          }
        },
        update: {
          checkingMethod,
          frequency,
          sequence: ++sequence,
        },
        create: {
          partId,
          operation,
          pokaYokeName,
          checkingMethod,
          frequency,
          sequence: ++sequence,
        }
      });
      imported++;
    }

    return { success: true, imported };
  }

  // --- Poka Yoke Item Management ---
  async updateItem(id: string, dto: { pokaYokeName?: string; checkingMethod?: string; frequency?: string; readingType?: string }) {
    return this.prisma.pokaYokeItem.update({
      where: { id },
      data: dto,
    });
  }

  async deleteItem(id: string) {
    return this.prisma.pokaYokeItem.delete({
      where: { id },
    });
  }

  async bulkUpdateItems(partId: string, items: any[]) {
    // We'll upsert items. But we also need to delete ones that were removed.
    // To do this safely, we get existing items for this part, and delete any that are not in the 'items' payload (if they have an id).
    
    const itemIdsToKeep = items.filter(i => i.id).map(i => i.id);
    
    // Delete items that are no longer present
    await this.prisma.pokaYokeItem.deleteMany({
      where: {
        partId,
        id: { notIn: itemIdsToKeep }
      }
    });

    const results = [];
    for (const [index, item] of items.entries()) {
      if (item.id) {
        // Update
        const updated = await this.prisma.pokaYokeItem.update({
          where: { id: item.id },
          data: {
            operation: item.operation,
            pokaYokeName: item.pokaYokeName,
            checkingMethod: item.checkingMethod,
            frequency: item.frequency,
            readingType: item.readingType,
            sequence: index,
          }
        });
        results.push(updated);
      } else {
        // Create new
        const created = await this.prisma.pokaYokeItem.create({
          data: {
            partId,
            operation: item.operation,
            pokaYokeName: item.pokaYokeName,
            checkingMethod: item.checkingMethod,
            frequency: item.frequency,
            readingType: item.readingType,
            sequence: index,
          }
        });
        results.push(created);
      }
    }
    return results;
  }

  async getPendingApprovals(user: any) {
    const whereBase: any = {
      status: TransactionStatus.REJECTED,
    };
    if (user && (user.role === 'SUPERVISOR' || user.role === 'OPERATOR') && user.customerId) {
      whereBase.customerId = user.customerId;
    }

    return this.prisma.pokaYokeTransaction.findMany({
      where: whereBase,
      include: {
        part: true,
        inspector: true,
        details: {
          include: {
            pokaYokeItem: true,
          }
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async approveTransaction(id: string, user: any) {
    const transaction = await this.prisma.pokaYokeTransaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.adminId) {
      throw new BadRequestException('Transaction is already approved');
    }

    return this.prisma.pokaYokeTransaction.update({
      where: { id },
      data: {
        status: TransactionStatus.PASSED,
        adminId: user.id,
        adminApprovalDate: new Date(),
      },
      include: {
        part: true,
        inspector: true,
        adminUser: true,
      }
    });
  }

  async updateDetailStatus(detailId: string, status: ValidationStatus) {
    return this.prisma.pokaYokeDetail.update({
      where: { id: detailId },
      data: { status },
    });
  }

  async addCorrections(transactionId: string, data: { corrections: { pokaYokeItemId: string, observedValue: string }[], remarks: string }) {
    const creates = data.corrections.map(c => ({
      transactionId,
      pokaYokeItemId: c.pokaYokeItemId,
      observedValue: c.observedValue,
      status: ValidationStatus.PASS,
      correctionAction: data.remarks,
    }));
    
    // We cannot use createMany directly with Prisma SQLite if we need the returned items, but createMany is fine for just inserting.
    // However, createMany doesn't return the inserted records. PokaYokeDetail doesn't have createMany in some Prisma versions.
    // Let's use a transaction to create them sequentially.
    return this.prisma.$transaction(
      creates.map(data => this.prisma.pokaYokeDetail.create({ data }))
    );
  }

  async deleteTransaction(id: string) {
    return this.prisma.pokaYokeTransaction.delete({
      where: { id },
    });
  }

  async bulkDeleteTransactions(ids: string[]) {
    return this.prisma.pokaYokeTransaction.deleteMany({
      where: { id: { in: ids } },
    });
  }

  // --- Draft Management ---

  async getDraft(userId: string, partId: string) {
    return this.prisma.pokaYokeDraft.findUnique({
      where: {
        userId_partId: { userId, partId }
      }
    });
  }

  async saveDraft(userId: string, dto: any) {
    const { partId, date, shiftId, readings } = dto;
    return this.prisma.pokaYokeDraft.upsert({
      where: {
        userId_partId: { userId, partId }
      },
      update: {
        date: new Date(date),
        shiftId,
        readingsData: JSON.stringify(readings),
      },
      create: {
        userId,
        partId,
        date: new Date(date),
        shiftId,
        readingsData: JSON.stringify(readings),
      },
    });
  }

  async deleteDraft(id: string) {
    return this.prisma.pokaYokeDraft.delete({
      where: { id },
    });
  }
}
