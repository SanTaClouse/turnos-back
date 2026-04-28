import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Validate WhatsApp webhook request
   * WhatsApp sends a GET request with mode, token, and challenge
   */
  validateWebhookToken(
    mode: string,
    token: string,
    challenge: string,
  ): { valid: boolean; challenge?: string } {
    const verifyToken = this.configService.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified');
      return { valid: true, challenge };
    }

    this.logger.warn('Webhook verification failed');
    return { valid: false };
  }

  /**
   * Parse incoming WhatsApp message
   * This is a basic structure - adapt to your WhatsApp Business API version
   */
  parseMessage(body: any) {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const message = changes?.value?.messages?.[0];
      const contact = changes?.value?.contacts?.[0];

      if (!message || !contact) {
        return null;
      }

      return {
        messageId: message.id,
        timestamp: message.timestamp,
        from: message.from,
        type: message.type,
        text: message.text?.body,
        contact: {
          name: contact.profile?.name,
          phone: contact.wa_id,
        },
      };
    } catch (error) {
      this.logger.error('Error parsing WhatsApp message:', error);
      return null;
    }
  }

  /**
   * Log incoming webhook for debugging
   */
  logWebhook(body: any) {
    this.logger.debug(
      'Incoming WhatsApp webhook:',
      JSON.stringify(body, null, 2),
    );
  }
}
