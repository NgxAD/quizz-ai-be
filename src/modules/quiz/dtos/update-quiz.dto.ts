import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export class UpdateQuizDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsBoolean()
  @IsOptional()
  isRandom?: boolean;

  @IsNumber()
  @IsOptional()
  passingPercentage?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
