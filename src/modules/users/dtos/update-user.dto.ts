import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../../../common/enums/role.enum';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
