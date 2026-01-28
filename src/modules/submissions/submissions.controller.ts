import {
  Controller,
  Get,
  Post,
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
import { SubmissionsService } from './submissions.service';
import { SaveAnswersDto } from './dtos/save-answers.dto';
import { SubmitAnswersDto } from './dtos/submit-answers.dto';

/**
 * Submissions Module
 * Xử lý bài làm của học sinh
 * - Bắt đầu làm bài
 * - Lưu đáp án
 * - Nộp bài
 * - Chấm điểm tự động
 * - Xem kết quả
 */
@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  /**
   * POST /submissions/start/:examId
   * Học sinh bắt đầu làm bài
   * Tạo một submission record và trả về thông tin bài thi
   */
  @Post('start/:examId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async startExam(@Param('examId') examId: string, @GetUser() user: any) {
    return this.submissionsService.startExam(examId, user.userId);
  }

  /**
   * POST /submissions/:submissionId/save
   * Lưu đáp án tạm thời
   * Học sinh có thể lưu và tiếp tục làm bài
   */
  @Post(':submissionId/save')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async saveAnswers(
    @Param('submissionId') submissionId: string,
    @Body() saveAnswersDto: SaveAnswersDto,
    @GetUser() user: any,
  ) {
    return this.submissionsService.saveAnswers(submissionId, saveAnswersDto, user.userId);
  }

  /**
   * POST /submissions/:submissionId/submit
   * Nộp bài
   * Tính điểm tự động và tạo result record
   */
  @Post(':submissionId/submit')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async submitExam(
    @Param('submissionId') submissionId: string,
    @Body() submitAnswersDto: SubmitAnswersDto,
    @GetUser() user: any,
  ) {
    return this.submissionsService.submitExam(submissionId, submitAnswersDto, user.userId);
  }

  /**
   * GET /submissions/exam/:examId
   * Lấy danh sách submission của một bài thi
   * (Chỉ teacher/admin)
   */
  @Get('exam/:examId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getExamSubmissions(@Param('examId') examId: string) {
    return this.submissionsService.getExamSubmissions(examId);
  }

  /**
   * GET /submissions/user
   * Lấy danh sách submission của học sinh hiện tại
   */
  @Get('user')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async getUserSubmissions(
    @GetUser() user: any,
    @Query('examId') examId?: string,
  ) {
    return this.submissionsService.getUserSubmissions(user.userId, examId);
  }

  /**
   * GET /submissions/result/:examId
   * Lấy kết quả làm bài của học sinh cho một bài thi
   * Nếu chưa nộp: trả về submission draft
   * Nếu đã nộp: trả về result với điểm
   */
  @Get('result/:examId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async getExamResult(@Param('examId') examId: string, @GetUser() user: any) {
    return this.submissionsService.getExamResult(examId, user.userId);
  }

  /**
   * GET /submissions/:submissionId
   * Chi tiết submission
   */
  @Get(':submissionId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async getSubmission(@Param('submissionId') submissionId: string, @GetUser() user: any) {
    return this.submissionsService.getSubmission(submissionId, user.userId);
  }

  /**
   * GET /submissions/:submissionId/review
   * Review bài làm (xem đáp án đúng)
   * Chỉ sau khi nộp bài
   */
  @Get(':submissionId/review')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  async reviewSubmission(@Param('submissionId') submissionId: string, @GetUser() user: any) {
    return this.submissionsService.reviewSubmission(submissionId, user.userId);
  }
}
