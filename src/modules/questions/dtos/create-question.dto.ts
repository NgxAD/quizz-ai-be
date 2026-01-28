import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../../../common/enums/question-type.enum';

class OptionDto {
  @IsString()
  text: string;

  @IsString()
  isCorrect: boolean;
}

export class CreateQuestionDto {
  @IsString()
  content: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType;

  @IsString()
  quizId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
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
  subjectId?: string;

  @IsString()
  @IsOptional()
  level?: string; // easy, medium, hard
}
