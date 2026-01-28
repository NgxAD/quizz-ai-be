import { IsString, IsOptional } from 'class-validator';

export class SubmitAnswersDto {
  @IsString()
  @IsOptional()
  notes?: string;  // Ghi chú thêm từ học sinh

  @IsOptional()
  timeElapsed?: number;  // Thời gian làm bài thực tế
}
