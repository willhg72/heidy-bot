import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

const logger = new Logger('Main');

// Global keep-alive interval reference
let keepAliveInterval: NodeJS.Timeout;

async function bootstrap() {
  logger.log('Starting application...');
  
  try {
    const app = await NestFactory.create(AppModule);
    
    // Get the port from environment variables
    const port = process.env.PORT || 8080;
    
    // Enable CORS
    app.enableCors();
    
    // Listen on all interfaces
    await app.listen(port, '0.0.0.0');
    
    logger.log(`Application is running on: http://localhost:${port}`);
    
    // Add a more robust keep-alive mechanism
    keepAliveInterval = setInterval(() => {
      logger.log('Keep-alive: Application is still running...');
      
      // Force Node.js to stay alive by creating a small task
      Promise.resolve().then(() => {
        const timestamp = new Date().toISOString();
        logger.log(`Heartbeat at ${timestamp}`);
      });
    }, 30000); // Every 30 seconds
    
    // Handle shutdown signals properly
    process.on('SIGINT', async () => {
      logger.log('SIGINT received, shutting down gracefully...');
      clearInterval(keepAliveInterval);
      await app.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM received, shutting down gracefully...');
      clearInterval(keepAliveInterval);
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Failed to start application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error) {
      logger.error(error.stack || 'No stack trace available');
    }
    process.exit(1);
  }
}

// Add error handling for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error instanceof Error ? error.message : error}`);
  logger.error(error instanceof Error ? error.stack : 'No stack trace available');
});

// Start the application
bootstrap().catch(err => {
  logger.error(`Fatal error during bootstrap: ${err}`);
  process.exit(1);
});