import { IsArray, IsOptional, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerDto {
  @IsString()
  questionId: string;    // ID câu hỏi
  
  @IsString()
  answer: string;        // Đáp án (có thể là ID option hoặc text)
  
  @IsOptional()
  @IsNumber()
  timeSpent?: number;    // Thời gian trả lời (giây)
}

export class SaveAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];  // Danh sách đáp án

  @IsOptional()
  @IsNumber()
  timeElapsed?: number;  // Thời gian làm bài (giây)
}
