import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { DeeplinkService } from '../deeplink/deeplink.service';
import { BootstrapSchema } from '../deeplink/dto/bootstrap.dto';
import { SupportedFlow } from '../deeplink/dto/issue-token.dto';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';
import { ZodError } from 'zod';

interface FlowTemplate {
  type: 'text' | 'interactive';
  content: string | Record<string, unknown>;
}

@Controller(getApiControllerBasePath('whatsappFlow'))
export class FlowBootstrapController {
  constructor(private readonly deeplinkService: DeeplinkService) {}

  @Post(getApiEndpointSegment('whatsappFlow', 'bootstrap'))
  async bootstrap(@Body() body: unknown) {
    try {
      const validated = BootstrapSchema.parse(body);
      const resolved = await this.deeplinkService.resolveToken(validated);

      // Map flow to first-message template
      const flowState = this.getFlowState(resolved.flow, resolved.payload);

      return {
        flow: resolved.flow,
        flowState,
        payload: resolved.payload,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.errors);
      }
      throw error;
    }
  }

  private getFlowState(flow: SupportedFlow, payload?: Record<string, unknown>): FlowTemplate {
    switch (flow) {
      case 'insurance_attach':
        return {
          type: 'text',
          content: 'Welcome! Let\'s help you attach your insurance. Please provide your policy number.',
        };

      case 'basket_open':
        return {
          type: 'text',
          content: payload?.basketId 
            ? `Opening your basket (ID: ${payload.basketId}). What would you like to do?`
            : 'Welcome! Let\'s open your shopping basket. What would you like to order?',
        };

      case 'generate_qr':
        return {
          type: 'text',
          content: 'I\'ll help you generate a QR code. Please provide the details you\'d like to encode.',
        };

      default:
        return {
          type: 'text',
          content: 'How can I help you today?',
        };
    }
  }
}
