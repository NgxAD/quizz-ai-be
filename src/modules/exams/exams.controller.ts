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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dtos/create-exam.dto';
import { UpdateExamDto } from './dtos/update-exam.dto';
import { UploadAndCreateExamDto } from './dtos/upload-and-create-exam.dto';
import { FileParserService } from '../../common/services/file-parser.service';

@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamsController {
  constructor(
    private examsService: ExamsService,
    private fileParserService: FileParserService,
  ) {}

  /**
   * POST /exams
   * Tạo đề thi mới
   * Giáo viên chọn câu hỏi: tạo tay, từ AI, hoặc trộn
   */
  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async createExam(@Body() createExamDto: CreateExamDto, @GetUser() user: any) {
    return this.examsService.createExam(createExamDto, user.userId);
  }

  /**
   * POST /exams/preview-file
   * Xem trước nội dung file được tải lên (không xử lý câu hỏi)
   */
  @Post('preview-file')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async previewFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, XLSX, TXT, JPG, PNG, GIF, ZIP`,
      );
    }

    try {
      const extractedText = await this.fileParserService.parseFile(
        file.buffer,
        file.mimetype,
      );
      const normalizedText = this.fileParserService.normalizeText(extractedText);
      const questions = this.fileParserService.extractQuestions(normalizedText);

      return {
        success: true,
        rawText: normalizedText,
        questionsFound: questions.length,
        preview: questions.slice(0, 3), // First 3 questions for preview
      };
    } catch (error) {
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * POST /exams/extract-questions
   * Trích xuất câu hỏi từ text đã chỉnh sửa
   */
  @Post('extract-questions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async extractQuestionsFromText(@Body() body: { text: string }) {
    if (!body.text || body.text.trim().length === 0) {
      throw new BadRequestException('Text is required');
    }

    const normalizedText = this.fileParserService.normalizeText(body.text);
    const questions = this.fileParserService.extractQuestions(normalizedText);

    if (questions.length === 0) {
      throw new BadRequestException(
        'No questions found in text. Please ensure text contains questions in supported formats:\n' +
        '1. "1. Question?\nA) Option A\nB) Option B\nC) Option C\nD) Option D\nAnswer: A"\n' +
        '2. "Câu 1:\nQuestion text\nA) Option\nB) Option\nC) Option\nD) Option\nĐáp án: A"\n' +
        'Questions must have at least 2 options.',
      );
    }

    return {
      success: true,
      questionsFound: questions.length,
      questions: questions,
    };
  }

  /**
   * POST /exams/create-from-questions
   * Tạo đề thi từ danh sách câu hỏi đã phân tích
   * Dùng khi user đã chỉnh sửa nội dung trước tạo đề
   */
  @Post('create-from-questions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async createFromQuestions(
    @Body()
    body: {
      title: string;
      description?: string;
      duration?: number;
      passingPercentage?: number;
      questions: Array<{
        content: string;
        options: string[];
        correctAnswer: number;
        type?: string;
      }>;
    },
    @GetUser() user: any,
  ) {
    if (!body.title || body.title.trim().length === 0) {
      throw new BadRequestException('Title is required');
    }

    if (!body.questions || body.questions.length === 0) {
      throw new BadRequestException('Questions are required');
    }

    try {
      const dto: UploadAndCreateExamDto = {
        title: body.title,
        description: body.description,
        duration: body.duration,
        passingPercentage: body.passingPercentage,
      };

      return this.examsService.createExamFromQuestions(
        dto,
        body.questions,
        user.userId,
      );
    } catch (error) {
      console.error('Error creating exam from questions:', error);
      throw error;
    }
  }

  /**
   * POST /exams/upload-and-create
   * Tạo đề thi từ file upload (PDF, DOCX, XLSX, TXT, v.v.)
   */
  @Post('upload-and-create')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndCreateExam(
    @UploadedFile() file: any,
    @Body() dto: UploadAndCreateExamDto,
    @GetUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, XLSX, TXT, JPG, PNG, GIF, ZIP`,
      );
    }

    // Parse file
    let extractedText = '';
    try {
      extractedText = await this.fileParserService.parseFile(
        file.buffer,
        file.mimetype,
      );
    } catch (error) {
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }

    // Normalize text
    const normalizedText = this.fileParserService.normalizeText(extractedText);

    // Extract questions từ text
    const questions = this.fileParserService.extractQuestions(normalizedText);

    if (questions.length === 0) {
      throw new BadRequestException(
        'No questions found in file. Please ensure file contains questions in supported formats:\n' +
        '1. "1. Question?\nA) Option A\nB) Option B\nC) Option C\nD) Option D\nAnswer: A"\n' +
        '2. "Câu 1:\nQuestion text\nA) Option\nB) Option\nC) Option\nD) Option\nĐáp án: A"\n' +
        'Questions must have at least 2 options.',
      );
    }

    // Create exam with extracted questions
    return this.examsService.createExamFromQuestions(
      dto,
      questions,
      user.userId,
    );
  }

  /**
   * GET /exams
   * Lấy danh sách đề thi
   */
  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getAllExams(
    @GetUser() user: any,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: 'draft' | 'published',
  ) {
    if (user.role === UserRole.TEACHER) {
      return this.examsService.findAll(user.userId, subjectId, status);
    }
    return this.examsService.findAllPublished(subjectId);
  }

  /**
   * GET /exams/:id
   * Lấy chi tiết đề thi
   */
  @Get(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async getExamById(@Param('id') id: string, @GetUser() user: any) {
    return this.examsService.findById(id, user.userId);
  }

  /**
   * PUT /exams/:id/with-questions
   * Cập nhật đề thi với danh sách câu hỏi
   * Dùng khi user tạo đề thi thủ công và thêm câu hỏi
   */
  @Put(':id/with-questions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateExamWithQuestions(
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
      description?: string;
      duration?: number;
      passingPercentage?: number;
      questions: Array<{
        _id?: string;
        content: string;
        type: 'multiple-choice' | 'essay' | 'short-answer';
        options?: Array<{ text: string; isCorrect: boolean }>;
        answer?: string;
      }>;
    },
    @GetUser() user: any,
  ) {
    if (!body.questions || body.questions.length === 0) {
      throw new BadRequestException('Questions are required');
    }

    return this.examsService.updateExamWithQuestions(id, body, user.userId);
  }

  /**
   * PUT /exams/:id
   * Cập nhật đề thi
   */
  @Put(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async updateExam(
    @Param('id') id: string,
    @Body() updateExamDto: UpdateExamDto,
    @GetUser() user: any,
  ) {
    return this.examsService.updateExam(id, updateExamDto, user.userId);
  }

  /**
   * DELETE /exams/:id
   * Xóa đề thi
   */
  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async deleteExam(@Param('id') id: string, @GetUser() user: any) {
    return this.examsService.deleteExam(id, user.userId);
  }

  /**
   * POST /exams/:id/publish
   * Công bố đề thi (học sinh có thể xem)
   */
  @Post(':id/publish')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async publishExam(@Param('id') id: string, @GetUser() user: any) {
    return this.examsService.publishExam(id, user.userId);
  }

  /**
   * POST /exams/:id/unpublish
   * Hủy công bố đề thi
   */
  @Post(':id/unpublish')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async unpublishExam(@Param('id') id: string, @GetUser() user: any) {
    return this.examsService.unpublishExam(id, user.userId);
  }

  /**
   * POST /exams/:id/shuffle-questions
   * Trộn câu hỏi
   */
  @Post(':id/shuffle-questions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async shuffleQuestions(
    @Param('id') id: string,
    @Body() { count }: { count?: number },
  ) {
    return this.examsService.shuffleQuestions(id, count);
  }

  /**
   * GET /exams/:id/stats
   * Lấy thống kê đề thi
   */
  @Get(':id/stats')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getExamStats(@Param('id') id: string) {
    return this.examsService.getExamStats(id);
  }
}
