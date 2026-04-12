import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // CORS — Allow frontend and production origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24h preflight cache
  });

  // Global validation pipe with security hardening
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip unknown properties
      transform: true,       // Auto-transform types
      forbidNonWhitelisted: true,  // Reject payloads with unknown props
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Security Hardening: Payload limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.setGlobalPrefix('api');

  // Swagger Setup (only in development)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Social Pivot API')
      .setDescription('The Social Pivot API — AI-Powered Social Media Management')
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('📚 Swagger Docs enabled at /api/docs');
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 Social Pivot API running on http://localhost:${port}`);
  logger.log(`🔒 CORS enabled for origins: ${allowedOrigins.join(', ')}`);
}
bootstrap();
