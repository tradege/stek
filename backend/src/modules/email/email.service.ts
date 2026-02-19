import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brevoApiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private prisma: PrismaService) {
    this.brevoApiKey = process.env.BREVO_API_KEY || '';
    if (!this.brevoApiKey) {
      this.logger.warn('BREVO_API_KEY not set - emails will not be sent');
    }
    this.fromEmail = process.env.BREVO_FROM_EMAIL || 'marketedgepros@gmail.com';
    this.fromName = process.env.BREVO_FROM_NAME || 'Betworkss';
    this.logger.log(`Email service initialized with Brevo (from: ${this.fromName} <${this.fromEmail}>)`);
  }

  /**
   * Get site branding from database
   */
  private async getSiteBranding(siteId?: string | null): Promise<{ brandName: string; logoUrl?: string; primaryColor: string }> {
    if (siteId) {
      try {
        const siteConfig = await this.prisma.siteConfiguration.findUnique({
          where: { id: siteId },
          select: { brandName: true, logoUrl: true, primaryColor: true },
        });
        if (siteConfig) {
          return {
            brandName: siteConfig.brandName,
            logoUrl: siteConfig.logoUrl || undefined,
            primaryColor: siteConfig.primaryColor || '#00F0FF',
          };
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch site config: ${err.message}`);
      }
    }
    return { brandName: 'Betworkss', primaryColor: '#00F0FF' };
  }

  /**
   * Professional casino-themed email template with dark background
   */
  private getBaseTemplate(content: string, brandName: string, logoUrl?: string, primaryColor: string = '#00F0FF'): string {
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${brandName}" style="max-width:180px;height:auto;margin:0 auto 12px;" />`
      : `<h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${brandName}</h1>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${brandName}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a2e;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:600px;">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);padding:40px 30px;text-align:center;border-bottom:2px solid ${primaryColor};">
              ${logoHtml}
              <p style="margin:8px 0 0;color:${primaryColor};font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;">Premium Gaming Platform</p>
            </td>
          </tr>
          
          <!-- Content Area -->
          <tr>
            <td style="padding:40px 30px;background-color:#1a1a2e;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:30px;background-color:#0f0f1e;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6;">This email was sent by ${brandName}. Please do not reply to this email.</p>
              <p style="margin:0;color:#4b5563;font-size:11px;">&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Send verification email with 6-digit code
   */
  async sendVerificationEmail(email: string, code: string, siteId?: string | null): Promise<boolean> {
    const branding = await this.getSiteBranding(siteId);
    const { brandName, logoUrl, primaryColor } = branding;

    const content = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom:24px;">
            <h2 style="margin:0 0 12px;color:#ffffff;font-size:24px;font-weight:700;">Verify Your Email Address</h2>
            <p style="margin:0;color:#9ca3af;font-size:15px;line-height:1.6;">
              Welcome to ${brandName}! To complete your registration and start playing, please verify your email address using the code below.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 24px;">
            <!-- Verification Code Box -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, ${primaryColor}15, ${primaryColor}25);border:2px solid ${primaryColor};border-radius:12px;">
              <tr>
                <td style="padding:32px;text-align:center;">
                  <p style="margin:0 0 8px;color:${primaryColor};font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Your Verification Code</p>
                  <p style="margin:0;color:#ffffff;font-size:42px;font-weight:700;letter-spacing:12px;font-family:'Courier New',Courier,monospace;">${code}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f1e;border-radius:8px;border-left:3px solid ${primaryColor};">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;color:#d1d5db;font-size:14px;font-weight:600;">&#9201; Important:</p>
                  <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">This code expires in <strong style="color:${primaryColor};">15 minutes</strong>. Enter it on the verification page to activate your account.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top:8px;">
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">If you didn't create an account with ${brandName}, you can safely ignore this email.</p>
          </td>
        </tr>
      </table>
    `;

    return this.sendMail(email, `${brandName} - Verify Your Email`, this.getBaseTemplate(content, brandName, logoUrl, primaryColor));
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(email: string, username: string, siteId?: string | null): Promise<boolean> {
    const branding = await this.getSiteBranding(siteId);
    const { brandName, logoUrl, primaryColor } = branding;

    const content = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom:24px;">
            <h2 style="margin:0 0 12px;color:#ffffff;font-size:24px;font-weight:700;">Welcome to ${brandName}! &#127920;</h2>
            <p style="margin:0;color:#9ca3af;font-size:15px;line-height:1.6;">
              Hey <strong style="color:${primaryColor};">${username}</strong>, your account has been verified and you're all set to start playing!
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #0f0f1e, #1a1a2e);border-radius:12px;border:1px solid rgba(255,255,255,0.1);">
              <tr>
                <td style="padding:24px;">
                  <h3 style="margin:0 0 16px;color:${primaryColor};font-size:16px;font-weight:700;">&#128640; Get Started:</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:8px 0;">
                        <p style="margin:0;color:#d1d5db;font-size:14px;line-height:1.6;">&#128176; Make your first deposit and claim your welcome bonus</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <p style="margin:0;color:#d1d5db;font-size:14px;line-height:1.6;">&#127918; Try our provably fair casino games</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <p style="margin:0;color:#d1d5db;font-size:14px;line-height:1.6;">&#128101; Invite friends and earn commission rewards</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <p style="margin:0;color:#d1d5db;font-size:14px;line-height:1.6;">&#11088; Level up your VIP rank for exclusive perks</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top:8px;">
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">Play responsibly. If you need help, contact our 24/7 support team.</p>
          </td>
        </tr>
      </table>
    `;

    return this.sendMail(email, `Welcome to ${brandName}!`, this.getBaseTemplate(content, brandName, logoUrl, primaryColor));
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, code: string, siteId?: string | null): Promise<boolean> {
    const branding = await this.getSiteBranding(siteId);
    const { brandName, logoUrl, primaryColor } = branding;

    const content = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom:24px;">
            <h2 style="margin:0 0 12px;color:#ffffff;font-size:24px;font-weight:700;">Reset Your Password</h2>
            <p style="margin:0;color:#9ca3af;font-size:15px;line-height:1.6;">
              We received a request to reset your password. Use the code below to proceed with resetting your password.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 24px;">
            <!-- Reset Code Box -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #ef444415, #f9731625);border:2px solid #f97316;border-radius:12px;">
              <tr>
                <td style="padding:32px;text-align:center;">
                  <p style="margin:0 0 8px;color:#f97316;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Password Reset Code</p>
                  <p style="margin:0;color:#ffffff;font-size:42px;font-weight:700;letter-spacing:12px;font-family:'Courier New',Courier,monospace;">${code}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f1e;border-radius:8px;border-left:3px solid #f97316;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;color:#d1d5db;font-size:14px;font-weight:600;">&#9888;&#65039; Security Notice:</p>
                  <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">This code expires in <strong style="color:#f97316;">15 minutes</strong>. If you didn't request a password reset, please secure your account immediately.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    return this.sendMail(email, `${brandName} - Password Reset`, this.getBaseTemplate(content, brandName, logoUrl, primaryColor));
  }

  /**
   * Send deposit confirmation email
   */
  async sendDepositConfirmationEmail(email: string, amount: string, currency: string, siteId?: string | null): Promise<boolean> {
    const branding = await this.getSiteBranding(siteId);
    const { brandName, logoUrl, primaryColor } = branding;

    const content = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom:24px;">
            <h2 style="margin:0 0 12px;color:#ffffff;font-size:24px;font-weight:700;">Deposit Confirmed &#9989;</h2>
            <p style="margin:0;color:#9ca3af;font-size:15px;line-height:1.6;">
              Your deposit has been confirmed and credited to your account. You're ready to play!
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #10b98115, #05966925);border:2px solid #10b981;border-radius:12px;">
              <tr>
                <td style="padding:32px;text-align:center;">
                  <p style="margin:0 0 8px;color:#10b981;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Amount Credited</p>
                  <p style="margin:0;color:#ffffff;font-size:36px;font-weight:700;">${amount} ${currency}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">Your balance has been updated. Good luck and enjoy playing!</p>
          </td>
        </tr>
      </table>
    `;

    return this.sendMail(email, `${brandName} - Deposit Confirmed`, this.getBaseTemplate(content, brandName, logoUrl, primaryColor));
  }

  /**
   * Send email via Brevo HTTP API (uses HTTPS port 443, not blocked by DigitalOcean)
   */
  private sendMail(to: string, subject: string, html: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.brevoApiKey) {
        this.logger.error('Brevo API key not configured');
        resolve(false);
        return;
      }

      const payload = JSON.stringify({
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      });

      const options: https.RequestOptions = {
        hostname: 'api.brevo.com',
        port: 443,
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.brevoApiKey,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 201) {
            this.logger.log(`Email sent to ${to} via Brevo: ${body}`);
            resolve(true);
          } else {
            this.logger.error(`Brevo API error for ${to}: status=${res.statusCode} body=${body}`);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        this.logger.error(`Brevo request failed for ${to}: ${err.message}`);
        resolve(false);
      });

      req.setTimeout(15000, () => {
        this.logger.error(`Brevo request timed out for ${to}`);
        req.destroy();
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  }
}
