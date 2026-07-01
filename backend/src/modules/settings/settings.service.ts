import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { key },
    });
    return setting?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.systemSettings.upsert({
      where: { key },
      update: { value },
      create: { id: key, key, value },
    });
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.prisma.systemSettings.findMany();
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);
  }

  async getDeletionPolicy(): Promise<string> {
    return (await this.get('deletion_policy')) ?? 'strict';
  }
}
