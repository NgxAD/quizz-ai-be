import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { ResultsService } from './results.service';
import { SubmitAnswerDto } from './dtos/submit-answer.dto';

@Controller('results')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultsController {
  constructor(private resultsService: ResultsService) {}

  @Post('start/:quizId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async startQuiz(@Param('quizId') quizId: string, @GetUser() user: any) {
    return this.resultsService.startQuiz(quizId, user.userId);
  }

  @Post(':submissionId/submit')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async submitQuiz(@Param('submissionId') submissionId: string, @GetUser() user: any) {
    return this.resultsService.submitQuiz(submissionId, user.userId);
  }

  @Post(':submissionId/save')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async saveAnswers(
    @Param('submissionId') submissionId: string,
    @Body() { answers }: { answers: any[] },
  ) {
    return this.resultsService.saveAnswers(submissionId, answers);
  }

  @Get('user')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async getUserResults(@GetUser() user: any) {
    return this.resultsService.getUserResults(user.userId);
  }

  @Get('quiz/:quizId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getQuizResults(@Param('quizId') quizId: string) {
    return this.resultsService.getQuizResults(quizId);
  }

  @Get('quiz/:quizId/statistics')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getQuizStatistics(@Param('quizId') quizId: string) {
    return this.resultsService.getQuizStatistics(quizId);
  }

  @Get('quiz/:quizId/leaderboard')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getLeaderboard(@Param('quizId') quizId: string) {
    return this.resultsService.getLeaderboard(quizId);
  }

  @Get(':resultId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async getResult(@Param('resultId') resultId: string) {
    return this.resultsService.getResult(resultId);
  }
}
