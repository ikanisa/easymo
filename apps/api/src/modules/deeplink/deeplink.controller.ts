import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { DeeplinkService } from './deeplink.service';
import { IssueTokenSchema, IssueTokenDto } from './dto/issue-token.dto';
import { ResolveTokenSchema, ResolveTokenDto } from './dto/resolve-token.dto';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';
import { ZodError } from 'zod';

@Controller(getApiControllerBasePath('deeplink'))
export class DeeplinkController {
  constructor(private readonly deeplinkService: DeeplinkService) {}

  @Post(getApiEndpointSegment('deeplink', 'issue'))
  async issue(@Body() body: unknown) {
    try {
      const validated = IssueTokenSchema.parse(body);
      const token = await this.deeplinkService.issueToken(validated);
      return { token };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.errors);
      }
      throw error;
    }
  }

  @Post(getApiEndpointSegment('deeplink', 'resolve'))
  async resolve(@Body() body: unknown) {
    try {
      const validated = ResolveTokenSchema.parse(body);
      const result = await this.deeplinkService.resolveToken(validated);
      return result;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.errors);
      }
      throw error;
    }
  }
}
