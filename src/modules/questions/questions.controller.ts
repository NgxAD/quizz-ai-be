import {
  Controller,
  Get,
  Post,
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
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { QuestionsService } from './questions.service';
import { AiService } from '../ai/ai.service';
import { CreateQuestionDto } from './dtos/create-question.dto';
import { UpdateQuestionDto } from './dtos/update-question.dto';
import { GenerateQuestionsDto } from './dtos/generate-questions.dto';

@Controller('questions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuestionsController {
  constructor(
    private questionsService: QuestionsService,
    private aiService: AiService,
  ) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async createQuestion(@Body() createQuestionDto: CreateQuestionDto, @GetUser() user: any) {
    return this.questionsService.createQuestion(createQuestionDto, user.userId);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getAllQuestions(@Query('subjectId') subjectId?: string, @Query('level') level?: string) {
    return this.questionsService.findAll(subjectId, level);
  }

  @Get('quiz/:quizId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getQuestionsByQuizId(@Param('quizId') quizId: string) {
    return this.questionsService.findByQuizId(quizId);
  }

  @Get(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getQuestion(@Param('id') id: string) {
    return this.questionsService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateQuestion(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.questionsService.updateQuestion(id, updateQuestionDto);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async deleteQuestion(@Param('id') id: string) {
    return this.questionsService.deleteQuestion(id);
  }

  @Post('generate')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async generateQuestions(
    @Body() generateQuestionsDto: GenerateQuestionsDto,
    @GetUser() user: any,
  ) {
    return this.aiService.generateQuestions(generateQuestionsDto, user.userId);
  }

  @Put('quiz/:quizId/reorder')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async reorderQuestions(
    @Param('quizId') quizId: string,
    @Body() { questionOrder }: { questionOrder: { id: string; order: number }[] },
  ) {
    return this.questionsService.reorderQuestions(quizId, questionOrder);
  }
}
