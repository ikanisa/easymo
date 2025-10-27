import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { BrokerService } from './broker.service';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';
import { SearchCandidatesDtoSchema } from './dto/search-candidates.dto';

@Controller(getApiControllerBasePath('broker'))
export class BrokerController {
  constructor(private readonly brokerService: BrokerService) {}

  @Post(getApiEndpointSegment('broker', 'candidates'))
  async searchCandidates(@Body() body: unknown) {
    const result = SearchCandidatesDtoSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(`Validation failed: ${result.error.message}`);
    }
    return this.brokerService.searchCandidates(result.data);
  }
}
