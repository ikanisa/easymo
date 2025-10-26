import { Allow, IsObject, IsOptional, IsString } from 'class-validator';
import { Expose, Transform } from 'class-transformer';

export class RealtimeSessionDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  project_id?: string;

  @IsOptional()
  @IsString()
  sip_session_id?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  twilio_call_sid?: string;

  @IsOptional()
  @IsString()
  agent_profile?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @Allow()
  @Expose()
  @Transform(({ obj }) => obj, { toClassOnly: true })
  raw!: Record<string, unknown>;
}
