import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        signature: true,
        customerId: true,
        customer: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        signature: true,
        customerId: true,
        customer: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new BadRequestException(`Username "${dto.username}" is already taken.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
        role: dto.role || 'INSPECTOR',
        customerId: dto.customerId,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.role) updateData.role = dto.role;
    if (dto.signature !== undefined) updateData.signature = dto.signature;
    if (dto.customerId !== undefined) updateData.customerId = dto.customerId;
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        signature: true,
        customerId: true,
        customer: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Check if user has inspection history
    const txCount = await this.prisma.inspectionTransaction.count({
      where: { inspectorId: id },
    });
    if (txCount > 0) {
      throw new BadRequestException(
        `Cannot delete user "${user.name}" because they have ${txCount} inspection record(s). Reassign or archive instead.`,
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully.' };
  }

  async updateSignature(id: string, signature: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: { signature },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        signature: true,
      },
    });
  }
}
