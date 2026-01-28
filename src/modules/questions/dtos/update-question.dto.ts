import { IsString, IsOptional, IsNumber, IsEnum, IsArray } from 'class-validator';
import { QuestionType } from '../../../common/enums/question-type.enum';

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType;

  @IsArray()
  @IsOptional()
  options?: Array<{
    text: string;
    isCorrect: boolean;
  }>;

  @IsString()
  @IsOptional()
  correctAnswer?: string;

  @IsNumber()
  @IsOptional()
  points?: number;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  level?: string; // easy, medium, hard

  @IsString()
  @IsOptional()
  subjectId?: string;
}
