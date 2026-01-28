import { IsString, IsOptional } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;
}
