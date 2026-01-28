import { IsString, IsArray } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  quizId: string;

  @IsArray()
  answers: Array<{
    questionId: string;
    answer: string | string[];
  }>;
}
