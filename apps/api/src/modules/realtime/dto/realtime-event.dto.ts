import { Allow, IsObject, IsOptional, IsString } from 'class-validator';
import { Expose, Transform } from 'class-transformer';

export class RealtimeEventDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @Allow()
  @Expose()
  @Transform(({ obj }) => obj, { toClassOnly: true })
  raw!: Record<string, unknown>;
}
