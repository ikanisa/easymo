import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DriverService } from './driver.service';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';
import {
  CreateParkingDtoSchema,
  UpdateParkingDtoSchema,
  type CreateParkingDto,
  type UpdateParkingDto,
} from './dto/parking.dto';
import {
  CreateAvailabilityDtoSchema,
  UpdateAvailabilityDtoSchema,
  type CreateAvailabilityDto,
  type UpdateAvailabilityDto,
} from './dto/availability.dto';

@Controller(getApiControllerBasePath('driverParking'))
export class DriverParkingController {
  constructor(private readonly driverService: DriverService) {}

  // TODO: Get driver_id from auth context
  private getDriverId(): string {
    // This should be extracted from the authenticated user context
    // For now, throwing an error as it needs proper auth middleware
    throw new UnauthorizedException('Authentication required');
  }

  @Get(getApiEndpointSegment('driverParking', 'list'))
  async list() {
    const driverId = this.getDriverId();
    const { data, error } = await this.driverService.listParking(driverId);
    if (error) {
      throw new BadRequestException(`Failed to list parking: ${error.message}`);
    }
    return { data };
  }

  @Post(getApiEndpointSegment('driverParking', 'create'))
  async create(@Body() body: unknown) {
    const result = CreateParkingDtoSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(`Validation failed: ${result.error.message}`);
    }
    const driverId = this.getDriverId();
    const { data, error } = await this.driverService.createParking(driverId, result.data);
    if (error) {
      throw new BadRequestException(`Failed to create parking: ${error.message}`);
    }
    return { data };
  }

  @Put(getApiEndpointSegment('driverParking', 'update'))
  async update(@Param('id') id: string, @Body() body: unknown) {
    if (!id) {
      throw new BadRequestException('Parking ID is required');
    }
    const result = UpdateParkingDtoSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(`Validation failed: ${result.error.message}`);
    }
    const driverId = this.getDriverId();
    const { data, error } = await this.driverService.updateParking(driverId, id, result.data);
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException(`Parking not found: ${id}`);
      }
      throw new BadRequestException(`Failed to update parking: ${error.message}`);
    }
    return { data };
  }

  @Delete(getApiEndpointSegment('driverParking', 'delete'))
  async delete(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Parking ID is required');
    }
    const driverId = this.getDriverId();
    const { error } = await this.driverService.deleteParking(driverId, id);
    if (error) {
      throw new BadRequestException(`Failed to delete parking: ${error.message}`);
    }
    return { success: true };
  }
}

@Controller(getApiControllerBasePath('driverAvailability'))
export class DriverAvailabilityController {
  constructor(private readonly driverService: DriverService) {}

  // TODO: Get driver_id from auth context
  private getDriverId(): string {
    // This should be extracted from the authenticated user context
    // For now, throwing an error as it needs proper auth middleware
    throw new UnauthorizedException('Authentication required');
  }

  @Get(getApiEndpointSegment('driverAvailability', 'list'))
  async list() {
    const driverId = this.getDriverId();
    const { data, error } = await this.driverService.listAvailability(driverId);
    if (error) {
      throw new BadRequestException(`Failed to list availability: ${error.message}`);
    }
    return { data };
  }

  @Post(getApiEndpointSegment('driverAvailability', 'create'))
  async create(@Body() body: unknown) {
    const result = CreateAvailabilityDtoSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(`Validation failed: ${result.error.message}`);
    }
    const driverId = this.getDriverId();
    const { data, error } = await this.driverService.createAvailability(driverId, result.data);
    if (error) {
      throw new BadRequestException(`Failed to create availability: ${error.message}`);
    }
    return { data };
  }

  @Put(getApiEndpointSegment('driverAvailability', 'update'))
  async update(@Param('id') id: string, @Body() body: unknown) {
    if (!id) {
      throw new BadRequestException('Availability ID is required');
    }
    const result = UpdateAvailabilityDtoSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(`Validation failed: ${result.error.message}`);
    }
    const driverId = this.getDriverId();
    const { data, error } = await this.driverService.updateAvailability(driverId, id, result.data);
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException(`Availability not found: ${id}`);
      }
      throw new BadRequestException(`Failed to update availability: ${error.message}`);
    }
    return { data };
  }

  @Delete(getApiEndpointSegment('driverAvailability', 'delete'))
  async delete(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Availability ID is required');
    }
    const driverId = this.getDriverId();
    const { error } = await this.driverService.deleteAvailability(driverId, id);
    if (error) {
      throw new BadRequestException(`Failed to delete availability: ${error.message}`);
    }
    return { success: true };
  }
}
