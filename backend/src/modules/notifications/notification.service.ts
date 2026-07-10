import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { overdueAlertTemplate } from './templates/overdue-alert.template';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  private async getTransporter() {
    const settings = await this.prisma.systemSettings.findMany();
    const config = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as any);

    if (!config.smtp_host || !config.smtp_port || !config.smtp_user || !config.smtp_password) {
      return null;
    }

    let secure = parseInt(config.smtp_port, 10) === 465;
    let requireTLS = false;

    if (config.smtp_encryption === 'ssl') {
      secure = true;
    } else if (config.smtp_encryption === 'tls') {
      secure = false;
      requireTLS = true;
    } else if (config.smtp_encryption === 'none') {
      secure = false;
    }

    return {
      transporter: nodemailer.createTransport({
        host: config.smtp_host,
        port: parseInt(config.smtp_port, 10),
        secure: secure,
        requireTLS: requireTLS,
        auth: {
          user: config.smtp_user,
          pass: config.smtp_password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      }),
      fromEmail: config.smtp_user,
    };
  }

  // Run at 23:00 every day to check for overdue reports
  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async handleOverdueAlerts() {
    this.logger.log('Running daily overdue alerts check...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const parts = await this.prisma.part.findMany({
        include: {
          customer: true,
          pokaYokeItems: true,
          parameters: {
            include: {
              operation: true,
            },
          },
        },
      });

      interface AlertItem {
        customerId: string;
        partNumber: string;
        partName: string;
        missingType: string;
      }

      const alertsToSend: AlertItem[] = [];

      for (const part of parts) {
        const custId = part.customerId || 'no-customer';

        // 1. Poka-Yoke Check
        if (part.pokaYokeItems.length > 0) {
          const existingPokaYokeTxn = await this.prisma.pokaYokeTransaction.findFirst({
            where: {
              partId: part.id,
              date: {
                gte: today,
                lte: endOfDay,
              },
            },
          });

          if (!existingPokaYokeTxn) {
            alertsToSend.push({
              customerId: custId,
              partNumber: part.partNumber,
              partName: part.partName,
              missingType: 'Poka-Yoke Report',
            });
          }
        }

        // 2. Inspection Check
        if (part.parameters.length > 0) {
          const uniqueOps = new Map<string, string>(); // operationId -> operationName
          for (const param of part.parameters) {
            if (param.operation) {
              uniqueOps.set(param.operationId, param.operation.operationName);
            }
          }

          for (const [opId, opName] of uniqueOps.entries()) {
            // Check 1 Half
            const existing1Half = await this.prisma.inspectionTransaction.findFirst({
              where: {
                partId: part.id,
                operationId: opId,
                intervalName: '1 Half',
                inspectionTimestamp: { gte: today, lte: endOfDay },
              },
            });

            if (!existing1Half) {
              alertsToSend.push({
                customerId: custId,
                partNumber: part.partNumber,
                partName: part.partName,
                missingType: `Inspection (${opName} - 1 Half)`,
              });
            }

            // Check 2 Half
            const existing2Half = await this.prisma.inspectionTransaction.findFirst({
              where: {
                partId: part.id,
                operationId: opId,
                intervalName: '2 Half',
                inspectionTimestamp: { gte: today, lte: endOfDay },
              },
            });

            if (!existing2Half) {
              alertsToSend.push({
                customerId: custId,
                partNumber: part.partNumber,
                partName: part.partName,
                missingType: `Inspection (${opName} - 2 Half)`,
              });
            }
          }
        }
      }

      if (alertsToSend.length === 0) {
        this.logger.log('No overdue reports found.');
        return;
      }

      this.logger.log(`Found ${alertsToSend.length} overdue reports. Preparing alerts...`);

      const mailConfig = await this.getTransporter();
      if (!mailConfig) {
        this.logger.warn('SMTP configuration is missing or incomplete. Cannot send alerts.');
        return;
      }

      // Group alerts by customer to send to responsible users
      const groupedAlerts = alertsToSend.reduce((acc, alert) => {
        if (!acc[alert.customerId]) acc[alert.customerId] = [];
        acc[alert.customerId].push(alert);
        return acc;
      }, {} as Record<string, AlertItem[]>);

      for (const [customerId, customerAlerts] of Object.entries(groupedAlerts)) {
        // Find users responsible for this customer (SUPERVISOR, ADMIN)
        const whereClause = customerId !== 'no-customer' 
          ? { OR: [{ role: Role.ADMIN }, { role: Role.SUPERVISOR, customerId }] }
          : { role: Role.ADMIN };

        const usersToAlert = await this.prisma.user.findMany({
          where: {
            ...whereClause,
            email: { not: null },
          },
        });

        if (usersToAlert.length === 0) continue;

        const emailList = usersToAlert.map(u => u.email).join(',');
        let htmlStr = '';
        try {
          const template = handlebars.compile(overdueAlertTemplate);
          htmlStr = template({
            date: today.toLocaleDateString(),
            alerts: customerAlerts
          });
        } catch (e) {
          this.logger.error('Failed to compile Handlebars template:', e);
          // Fallback simple HTML
          const partListHtml = customerAlerts.map(a => `<li><strong>${a.partNumber} - ${a.partName}</strong>: Missing ${a.missingType}</li>`).join('');
          htmlStr = `<h2>Overdue Reports Alert</h2><p>The following parts do not have completed reports for today (${today.toLocaleDateString()}):</p><ul>${partListHtml}</ul>`;
        }

        const mailOptions = {
          from: mailConfig.fromEmail,
          to: emailList,
          subject: 'Overdue Reports Alert (Poka-Yoke & Inspection)',
          html: htmlStr,
        };

        await mailConfig.transporter.sendMail(mailOptions);
        this.logger.log(`Alert sent successfully to ${emailList}`);
      }

    } catch (error) {
      this.logger.error('Failed to process overdue alerts:', error);
    }
  }

  async sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      const mailConfig = await this.getTransporter();
      if (!mailConfig) {
        return { success: false, error: 'SMTP configuration is incomplete in system settings.' };
      }

      await mailConfig.transporter.verify();

      const mailOptions = {
        from: mailConfig.fromEmail,
        to: toEmail,
        subject: 'IRMS System - Test Email',
        html: `
          <h2>SMTP Configuration Test</h2>
          <p>If you are seeing this email, your SMTP configuration in the IRMS system is working correctly!</p>
          <p>Time sent: ${new Date().toLocaleString()}</p>
        `,
      };

      await mailConfig.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      this.logger.error('Test email failed:', error);
      return { success: false, error: error.message || 'Failed to send test email' };
    }
  }
}
