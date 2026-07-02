import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CorrectionItemDto {
  @IsString()
  @IsNotEmpty()
  detailId: string;

  @IsString()
  @IsNotEmpty()
  correctedValue: string;
}

export class CorrectInspectionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorrectionItemDto)
  corrections: CorrectionItemDto[];

  @IsString()
  @IsOptional()
  remarks?: string;
}
