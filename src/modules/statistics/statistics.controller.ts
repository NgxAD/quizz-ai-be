import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @Get('system')
  @Roles(UserRole.ADMIN)
  async getSystemStatistics() {
    return this.statisticsService.getSystemStatistics();
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  async getUserStatistics(@Param('userId') userId: string) {
    return this.statisticsService.getUserStatistics(userId);
  }

  @Get('quiz/:quizId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getQuizStatistics(@Param('quizId') quizId: string) {
    return this.statisticsService.getQuizStatistics(quizId);
  }

  @Get('question/:questionId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getQuestionStatistics(@Param('questionId') questionId: string) {
    return this.statisticsService.getQuestionStatistics(questionId);
  }

  @Get('quiz/:quizId/ranking')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  async getStudentRanking(@Param('quizId') quizId: string) {
    return this.statisticsService.getStudentRanking(quizId);
  }

  @Get('subject/:subjectId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getSubjectStatistics(@Param('subjectId') subjectId: string) {
    return this.statisticsService.getSubjectStatistics(subjectId);
  }
}
