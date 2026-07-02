import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Default Shifts
  const defaultShifts = [
    { name: 'Shift A', startTime: '06:00', endTime: '14:00' },
    { name: 'Shift B', startTime: '14:00', endTime: '22:00' },
    { name: 'Shift C', startTime: '22:00', endTime: '06:00' },
    { name: 'Shift D', startTime: '09:00', endTime: '17:00' }, // General/Overlap Shift
  ];

  for (const shift of defaultShifts) {
    await prisma.shift.upsert({
      where: { name: shift.name },
      update: {},
      create: shift,
    });
  }
  console.log('Shifts seeded.');

  // 2. Create Default Users
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const inspectorPasswordHash = await bcrypt.hash('inspector123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'Administrator',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { username: 'inspector' },
    update: {},
    create: {
      username: 'inspector',
      name: 'Line Inspector 01',
      passwordHash: inspectorPasswordHash,
      role: Role.INSPECTOR,
    },
  });

  console.log('Users seeded (admin/admin123 and inspector/inspector123).');

  // 3. Seed Default System Settings
  const defaultSettings = [
    { key: 'deletion_policy', value: 'strict' },
    { key: 'lot_number_required', value: 'true' },
    { key: 'frequency_unit', value: 'shift' },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: {},
      create: { id: setting.key, key: setting.key, value: setting.value },
    });
  }
  console.log('Default settings seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
