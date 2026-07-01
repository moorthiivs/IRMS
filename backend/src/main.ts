import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for Vite frontend
  app.enableCors({
    origin: '*', // Allow all origins for tablet communication, configure in production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Prefix routes with /api
  app.setGlobalPrefix('api');

  // Enforce global data validation DTO pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`IRMS Backend is running on: http://0.0.0.0:${port}/api`);
}
bootstrap();
