import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client'),
      exclude: ['/api/(.*)'],
    }),
    PrismaModule,
    AuthModule,
    MasterDataModule,
    InspectionsModule,
    UsersModule,
    SettingsModule,
  ],
})
export class AppModule {}
