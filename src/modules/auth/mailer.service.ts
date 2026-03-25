import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // Initialize transporter with environment variables
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      const mailService = this.configService.get<string>('MAIL_SERVICE') || 'gmail';
      const mailUser = this.configService.get<string>('MAIL_USER');
      const mailPassword = this.configService.get<string>('MAIL_PASSWORD');

      if (!mailUser || !mailPassword) {
        console.warn('Email credentials not configured. Email sending disabled.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        service: mailService,
        auth: {
          user: mailUser,
          pass: mailPassword,
        },
      });

      // Verify transporter connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('SMTP connection failed:', error);
        } else {
          console.log('SMTP server is ready to send emails');
        }
      });
    } catch (error) {
      console.error('Error initializing mailer service:', error);
    }
  }

  async sendPasswordResetCode(email: string, code: string) {
    try {
      if (!this.transporter) {
        console.warn('Mailer not configured. Skipping email send.');
        return false;
      }

      const mailOptions = {
        from: this.configService.get<string>('MAIL_USER'),
        to: email,
        subject: 'Mã Xác Minh Đặt Lại Mật Khẩu - ADTest',
        html: `
          <h2>Đặt Lại Mật Khẩu</h2>
          <p>Xin chào,</p>
          <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản ADTest của mình.</p>
          <p>Mã xác minh của bạn là:</p>
          <h3 style="color: #007bff; font-size: 24px; letter-spacing: 3px;">${code}</h3>
          <p>Mã này sẽ hết hạn trong 15 phút.</p>
          <p>Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này.</p>
          <hr>
          <p>©2026 ADTest. Đã Bảo Lưu Mọi Quyền.</p>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent successfully to ${email}. Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }
}
