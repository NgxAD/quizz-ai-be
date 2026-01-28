import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dtos/create-class.dto';
import { UpdateClassDto } from './dtos/update-class.dto';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private classesService: ClassesService) {}

  /**
   * POST /classes
   * Create a new class
   */
  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async createClass(
    @Body() createClassDto: CreateClassDto,
    @GetUser() user: any,
  ) {
    return this.classesService.createClass(createClassDto, user.userId);
  }

  /**
   * GET /classes
   * Get all classes for the current user (teacher or student)
   */
  @Get()
  async getClasses(@GetUser() user: any) {
    if (user.role === UserRole.TEACHER) {
      return this.classesService.getTeacherClasses(user.userId);
    }
    if (user.role === UserRole.STUDENT) {
      return this.classesService.getStudentClasses(user.userId);
    }
    // Admin can see all classes
    return [];
  }

  /**
   * GET /classes/:id
   * Get class by ID
   */
  @Get(':id')
  async getClassById(@Param('id') id: string) {
    return this.classesService.getClassById(id);
  }

  /**
   * PUT /classes/:id
   * Update class
   */
  @Put(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateClass(
    @Param('id') id: string,
    @Body() updateClassDto: UpdateClassDto,
    @GetUser() user: any,
  ) {
    return this.classesService.updateClass(id, updateClassDto, user.userId);
  }

  /**
   * DELETE /classes/:id
   * Delete class
   */
  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async deleteClass(@Param('id') id: string, @GetUser() user: any) {
    await this.classesService.deleteClass(id, user.userId);
    return { success: true };
  }

  /**
   * GET /classes/:id/members
   * Get class members
   */
  @Get(':id/members')
  async getClassMembers(@Param('id') id: string) {
    return this.classesService.getClassMembers(id);
  }

  /**
   * DELETE /classes/:id/members/:studentId
   * Remove member from class
   */
  @Delete(':id/members/:studentId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async removeMember(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
  ) {
    await this.classesService.removeMember(classId, studentId);
    return { success: true };
  }

  /**
   * POST /classes/join
   * Join class by code
   */
  @Post('join')
  @Roles(UserRole.STUDENT)
  async joinClassByCode(
    @Body() body: { code: string },
    @GetUser() user: any,
  ) {
    return this.classesService.joinClassByCode(body.code, user.userId);
  }

  /**
   * POST /classes/:classId/exams/:examId
   * Assign exam to class
   */
  @Post(':classId/exams/:examId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async assignExamToClass(
    @Param('classId') classId: string,
    @Param('examId') examId: string,
  ) {
    await this.classesService.assignExamToClass(classId, examId);
    return { success: true };
  }
}
