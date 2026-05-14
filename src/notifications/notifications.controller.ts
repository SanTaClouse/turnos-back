import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('subscribe')
  @ApiOperation({
    summary: 'Suscribirse a notificaciones push',
    description:
      'Guardar la suscripción de push notification del cliente para poder enviarle notificaciones en el futuro',
  })
  @ApiCreatedResponse({ description: 'Suscripción guardada exitosamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  async subscribe(
    @Body()
    dto: {
      tenant_id: string;
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
    },
  ) {
    if (!dto.tenant_id || !dto.subscription) {
      throw new BadRequestException('tenant_id y subscription son requeridos');
    }

    const { endpoint, keys } = dto.subscription;
    if (!endpoint || typeof endpoint !== 'string') {
      throw new BadRequestException(
        'subscription.endpoint es requerido y debe ser string',
      );
    }
    // Validamos que p256dh/auth sean strings no vacíos.
    // Si llegan {} o "", el frontend serializó ArrayBuffer mal — fallar acá
    // evita guardar suscripciones rotas que después no entregan push.
    if (
      !keys ||
      typeof keys.p256dh !== 'string' ||
      typeof keys.auth !== 'string' ||
      keys.p256dh.length === 0 ||
      keys.auth.length === 0
    ) {
      throw new BadRequestException(
        'subscription.keys.p256dh y .auth deben ser strings base64url no vacíos',
      );
    }

    return this.service.subscribePush(dto.tenant_id, { endpoint, keys });
  }
}
