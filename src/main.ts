import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  try {
    // Create app as NestExpressApplication to access express-specific methods
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    
    // Serve static files from the 'public' directory
    app.useStaticAssets(join(__dirname, '..', 'public'));
    
    
    // Try a different port (3001 instead of the default 3000)
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`Application is running on: ${await app.getUrl()}`);
  } catch (error) {
    console.error('Failed to start the application:', error);
  }
}
bootstrap();