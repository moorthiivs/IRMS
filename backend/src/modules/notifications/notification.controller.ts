import { Controller, Post, Body, BadRequestException, HttpCode } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('test-email')
  @HttpCode(200)
  async sendTestEmail(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email address is required');
    }
    const result = await this.notificationService.sendTestEmail(email);
    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to send test email');
    }
    return { message: 'Test email sent successfully' };
  }

  @Post('trigger-alerts')
  @HttpCode(200)
  async triggerAlerts() {
    // This runs asynchronously in the background. We don't await it to avoid timeout if there are many emails.
    // Or we can await it if we want immediate response on success/failure. Let's await it to give user feedback.
    try {
      await this.notificationService.handleOverdueAlerts();
      return { message: 'Alerts triggered successfully' };
    } catch (error) {
      throw new BadRequestException('Failed to trigger alerts: ' + error.message);
    }
  }
}
