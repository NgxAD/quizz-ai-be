import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AiService } from './ai.service';
import { GenerateQuestionsDto } from '../questions/dtos/generate-questions.dto';

interface SaveQuestionsDto {
  quizId: string;
  questions: any[];
}

/**
 * AI Module Controller
 * Chỉ giáo viên được dùng
 * Sinh đề tự động từ AI
 */
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  /**
   * POST /ai/generate-questions
   * Sinh đề bằng AI
   * Chỉ TEACHER, ADMIN
   *
   * Luồng:
   * 1. Nhận nội dung (topic, số câu, độ khó)
   * 2. Gửi prompt cho AI
   * 3. AI trả về JSON
   * 4. Validate dữ liệu
   * 5. Return questions (KHÔNG lưu DB) - status: draft
   */
  @Post('generate-questions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(201)
  async generateQuestions(
    @Body() generateQuestionsDto: GenerateQuestionsDto,
    @GetUser() user: any,
  ) {
    return this.aiService.generateQuestions(generateQuestionsDto, user.userId);
  }

  /**
   * POST /ai/save-questions
   * Lưu questions được sinh từ AI vào DB
   * Called when user clicks "Save" button on frontend
   * Chỉ TEACHER, ADMIN
   */
  @Post('save-questions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(201)
  async saveQuestions(
    @Body() saveQuestionsDto: SaveQuestionsDto,
    @GetUser() user: any,
  ) {
    return this.aiService.saveGeneratedQuestions(
      saveQuestionsDto.quizId,
      saveQuestionsDto.questions,
      user.userId,
    );
  }

  /**
   * POST /ai/validate-content
   * Validate nội dung đề thi trước khi sinh
   */
  @Post('validate-content')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(200)
  async validateContent(
    @Body() { topic, numberOfQuestions, difficulty }: any,
  ) {
    return this.aiService.validateContent(topic, numberOfQuestions, difficulty);
  }
}
