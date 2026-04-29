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

    if (!dto.subscription.endpoint || !dto.subscription.keys) {
      throw new BadRequestException(
        'subscription debe incluir endpoint y keys',
      );
    }

    return this.service.subscribePush(dto.tenant_id, dto.subscription);
  }
}
