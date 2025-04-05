import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_SERVER'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<number>('SMTP_PORT') === 465,
      auth: {
        user: this.configService.get<string>('EMAIL_SENDER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendNotificationEmail(clientNumber: string, message: string): Promise<boolean> {
    const mailOptions = {
      from: this.configService.get<string>('EMAIL_SENDER'),
      to: this.configService.get<string>('EMAIL_RECIPIENT'),
      subject: 'Nuevo paciente en WhatsApp',
      text: `
        ${message}
        
        WhatsApp: ${clientNumber}
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error al enviar correo:', error);
      return false;
    }
  }

  async notificarError(error: any): Promise<boolean> {
    const mailOptions = {
      from: this.configService.get<string>('EMAIL_SENDER'),
      to: this.configService.get<string>('EMAIL_RECIPIENT'),
      subject: '🚨 Error crítico en Bot de WhatsApp',
      text: `Ocurrió un error en el bot:\n\n${error}`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (e) {
      console.error('No se pudo enviar el correo de error:', e);
      return false;
    }
  }
}