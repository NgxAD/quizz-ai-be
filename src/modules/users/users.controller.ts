import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dtos/update-user.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async getAllUsers(@Query('role') role?: UserRole) {
    return this.usersService.findAll(role);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  async getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Put(':id/change-password')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  async changePassword(
    @Param('id') id: string,
    @Body() { oldPassword, newPassword }: { oldPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(id, oldPassword, newPassword);
  }

  @Put(':id/toggle-status')
  @Roles(UserRole.ADMIN)
  async toggleUserStatus(@Param('id') id: string) {
    return this.usersService.toggleUserStatus(id);
  }

  @Put(':id/role')
  @Roles(UserRole.ADMIN)
  async updateUserRole(@Param('id') id: string, @Body() { role }: { role: UserRole }) {
    return this.usersService.updateUserRole(id, role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
