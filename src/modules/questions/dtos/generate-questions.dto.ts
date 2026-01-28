import { IsString, IsOptional } from 'class-validator';

export class GenerateQuestionsDto {
  @IsString()
  customPrompt: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  quizId?: string;

  @IsOptional()
  @IsString()
  quizTitle?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  numberOfQuestions?: number;

  @IsOptional()
  difficulty?: 'easy' | 'medium' | 'hard';
}

