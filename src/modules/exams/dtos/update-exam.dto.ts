import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export class UpdateExamDto {
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

  @IsBoolean()
  @IsOptional()
  isRandomAnswers?: boolean;

  @IsNumber()
  @IsOptional()
  passingPercentage?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  showCorrectAnswers?: boolean;

  @IsBoolean()
  @IsOptional()
  showExplanation?: boolean;
}
