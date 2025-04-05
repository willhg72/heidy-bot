import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'WhatsApp Bot Service is running!';
  }
}