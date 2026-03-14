import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadAndCreateExamDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  passingPercentage?: number;

  @IsOptional()
  @IsEnum(['exercise', 'test'])
  type?: 'exercise' | 'test'; // Loại đề (bài tập / bài kiểm tra)

  @IsOptional()
  @IsString()
  fileContent?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}
