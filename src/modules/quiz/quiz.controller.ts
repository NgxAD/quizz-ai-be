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
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { UpdateQuizDto } from './dtos/update-quiz.dto';

@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizController {
  constructor(private quizService: QuizService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async createQuiz(@Body() createQuizDto: CreateQuizDto, @GetUser() user: any) {
    return this.quizService.createQuiz(createQuizDto, user.userId);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getAllQuizzes(@GetUser() user: any) {
    if (user.role === UserRole.TEACHER) {
      return this.quizService.findAll(user.userId);
    }
    return this.quizService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getQuizById(@Param('id') id: string) {
    return this.quizService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateQuiz(
    @Param('id') id: string,
    @Body() updateQuizDto: UpdateQuizDto,
    @GetUser() user: any,
  ) {
    return this.quizService.updateQuiz(id, updateQuizDto, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async deleteQuiz(@Param('id') id: string, @GetUser() user: any) {
    return this.quizService.deleteQuiz(id, user.userId);
  }

  @Post(':id/publish')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async publishQuiz(@Param('id') id: string, @GetUser() user: any) {
    return this.quizService.publishQuiz(id, user.userId);
  }

  @Get(':id/stats')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getQuizStats(@Param('id') id: string) {
    return this.quizService.getQuizStats(id);
  }

  @Post(':quizId/questions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async addQuestions(
    @Param('quizId') quizId: string,
    @Body() { questionIds }: { questionIds: string[] },
  ) {
    return this.quizService.addQuestions(quizId, questionIds);
  }

  @Delete(':quizId/questions/:questionId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async removeQuestion(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.quizService.removeQuestion(quizId, questionId);
  }
}
