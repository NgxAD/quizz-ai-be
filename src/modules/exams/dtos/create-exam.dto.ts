import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class QuestionSelectionDto {
  @IsString()
  @IsOptional()
  method?: 'manual' | 'ai' | 'shuffle'; // manual | từ AI | trộn câu

  @IsArray()
  @IsOptional()
  questionIds?: string[]; // for manual selection

  @IsNumber()
  @IsOptional()
  count?: number; // số câu hỏi cần tạo/trộn

  @IsString()
  @IsOptional()
  aiTopic?: string; // chủ đề cho AI sinh đề

  @IsString()
  @IsOptional()
  aiDifficulty?: 'easy' | 'medium' | 'hard'; // độ khó AI
}

export class CreateExamDto {
  @IsString()
  title: string; // Tên đề thi

  @IsString()
  @IsOptional()
  description?: string; // Mô tả

  @IsString()
  @IsOptional()
  subjectId?: string; // Môn học

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(480)
  duration?: number; // Giới hạn thời gian (phút), default: 60

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  passingPercentage?: number; // Điểm qua (%), default: 50

  @IsBoolean()
  @IsOptional()
  isRandom?: boolean; // Trộn câu hỏi?, default: false

  @IsBoolean()
  @IsOptional()
  isRandomAnswers?: boolean; // Trộn đáp án?, default: false

  @IsDateString()
  @IsOptional()
  startDate?: string; // Ngày bắt đầu

  @IsDateString()
  @IsOptional()
  endDate?: string; // Ngày kết thúc

  @ValidateNested()
  @Type(() => QuestionSelectionDto)
  @IsOptional()
  questionSelection?: QuestionSelectionDto; // Chọn câu hỏi: tạo tay, từ AI, trộn

  @IsBoolean()
  @IsOptional()
  showCorrectAnswers?: boolean; // Hiển thị đáp án đúng sau khi kết thúc?, default: false

  @IsBoolean()
  @IsOptional()
  showExplanation?: boolean; // Hiển thị giải thích?, default: false
}
