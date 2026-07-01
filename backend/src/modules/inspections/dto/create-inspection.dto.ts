import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInspectionDetailDto {
  @IsString()
  @IsNotEmpty()
  parameterId: string;

  @IsString()
  @IsNotEmpty()
  observedValue: string;
}

export class CreateInspectionDto {
  @IsString()
  @IsNotEmpty()
  partId: string;

  @IsString()
  @IsNotEmpty()
  operationId: string;

  @IsString()
  @IsOptional()
  shiftId?: string;

  @IsString()
  @IsNotEmpty()
  lotNumber: string;

  @IsString()
  @IsOptional()
  mcNo?: string;

  @IsString()
  @IsNotEmpty()
  intervalName: string; // e.g. "1 Half" or "2 Half"

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInspectionDetailDto)
  details: CreateInspectionDetailDto[];
}
