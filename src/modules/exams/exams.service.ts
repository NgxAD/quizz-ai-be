import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Quiz, QuizDocument } from '../../schemas/quiz.schema';
import { Question, QuestionDocument } from '../../schemas/question.schema';
import { Result, ResultDocument } from '../../schemas/result.schema';
import { QuestionType } from '../../common/enums/question-type.enum';
import { CreateExamDto } from './dtos/create-exam.dto';
import { UpdateExamDto } from './dtos/update-exam.dto';
import { UploadAndCreateExamDto } from './dtos/upload-and-create-exam.dto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(Result.name) private resultModel: Model<ResultDocument>,
    private aiService: AiService,
  ) {}

  /**
   * Tạo đề thi
   * Support: tạo tay, từ AI, trộn câu
   */
  async createExam(createExamDto: CreateExamDto, createdBy: string) {
    const { questionSelection, ...quizData } = createExamDto;

    // Tạo quiz
    const quiz = await this.quizModel.create({
      ...quizData,
      createdBy,
      duration: quizData.duration || 60,
      passingPercentage: quizData.passingPercentage || 50,
      isPublished: false, // Mặc định là draft
    });

    // Xử lý chọn câu hỏi
    if (questionSelection) {
      const questions = await this.handleQuestionSelection(
        questionSelection,
        quiz._id.toString(),
        createdBy,
      );

      quiz.questions = questions.map((q) => q._id.toString());
      quiz.totalQuestions = questions.length;
    }

    await quiz.save();
    return this.quizModel
      .findById(quiz._id)
      .populate('createdBy', '-password')
      .populate('questions');
  }

  /**
   * Tạo đề thi từ file upload
   * Tự động tạo questions từ content trích xuất
   */
  async createExamFromQuestions(
    uploadAndCreateDto: UploadAndCreateExamDto,
    extractedQuestions: Array<{
      content: string;
      options: string[];
      correctAnswer: number;
      type?: string;
    }>,
    createdBy: string,
  ) {
    // Tạo Quiz
    const quiz = await this.quizModel.create({
      title: uploadAndCreateDto.title,
      description: uploadAndCreateDto.description || '',
      duration: uploadAndCreateDto.duration || 60,
      passingPercentage: uploadAndCreateDto.passingPercentage || 50,
      createdBy,
      isPublished: false,
    });

    // Tạo Questions từ extracted data
    const questionIds: string[] = [];
    for (const extractedQ of extractedQuestions) {
      const questionOptions = (extractedQ.options || []).map((opt, idx) => ({
        text: opt,
        isCorrect: idx === extractedQ.correctAnswer,
      }));

      // Convert type from MULTIPLE_CHOICE to multiple_choice
      let questionType = 'multiple_choice';
      if (extractedQ.type) {
        questionType = extractedQ.type.toLowerCase().replace('_', '_');
      }

      const question = await this.questionModel.create({
        content: extractedQ.content,
        type: questionType,
        options: questionOptions,
        quizId: quiz._id,
        createdBy,
      });

      questionIds.push(question._id.toString());
    }

    // Update quiz with questions
    quiz.questions = questionIds;
    quiz.totalQuestions = questionIds.length;
    await quiz.save();

    return this.quizModel
      .findById(quiz._id)
      .populate('createdBy', '-password')
      .populate('questions');
  }

  /**
   * Xử lý chọn câu hỏi theo method
   */
  private async handleQuestionSelection(
    selection: any,
    quizId: string,
    createdBy: string,
  ): Promise<any[]> {
    const { method = 'manual', questionIds, count, aiTopic, aiDifficulty } = selection;

    switch (method) {
      // Chọn tay
      case 'manual':
        if (!questionIds || questionIds.length === 0) {
          return [];
        }
        const questions = await this.questionModel.find({
          _id: { $in: questionIds },
        });
        return questions;

      // Sinh từ AI
      case 'ai':
        if (!aiTopic) {
          throw new BadRequestException('Vui lòng cung cấp chủ đề AI');
        }
        const aiQuestions = await this.aiService.generateQuestions(
          {
            topic: aiTopic,
            numberOfQuestions: count || 5,
            difficulty: aiDifficulty || 'medium',
            quizId: quizId,
            language: 'vi',
          } as any,
          createdBy,
        );
        return aiQuestions;

      // Trộn câu hỏi có sẵn
      case 'shuffle':
        const allQuestions = await this.questionModel.find({
          isActive: true,
        });
        return this.shuffleArray(allQuestions).slice(0, count || 10);

      default:
        return [];
    }
  }

  /**
   * Lấy danh sách đề thi của giáo viên
   */
  async findAll(teacherId?: string, subjectId?: string, status?: string) {
    const query: any = teacherId ? { createdBy: teacherId } : {};
    if (subjectId) query.subjectId = subjectId;
    if (status === 'draft') query.isPublished = false;
    if (status === 'published') query.isPublished = true;

    return this.quizModel
      .find(query)
      .populate('createdBy', '-password')
      .populate('subjectId')
      .sort({ createdAt: -1 });
  }

  /**
   * Lấy danh sách đề thi công bố (cho học sinh)
   */
  async findAllPublished(subjectId?: string) {
    const query: any = { isPublished: true };
    if (subjectId) query.subjectId = subjectId;

    return this.quizModel
      .find(query)
      .populate('createdBy', '-password')
      .populate('subjectId')
      .sort({ createdAt: -1 });
  }

  /**
   * Lấy chi tiết đề thi
   */
  async findById(id: string, userId?: string) {
    const quiz = await this.quizModel
      .findById(id)
      .populate('createdBy', '-password')
      .populate('subjectId')
      .populate('questions');

    if (!quiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }

    // Học sinh chỉ xem được đề thi công bố
    if (userId && quiz.createdBy.toString() !== userId) {
      if (!quiz.isPublished) {
        throw new ForbiddenException('Đề thi này chưa được công bố');
      }
    }

    return quiz;
  }

  /**
   * Cập nhật đề thi
   */
  async updateExam(id: string, updateExamDto: UpdateExamDto, userId: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }

    if (quiz.createdBy.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền sửa đề thi này');
    }

    const updated = await this.quizModel.findByIdAndUpdate(id, updateExamDto, {
      new: true,
    });
    if (!updated) {
      throw new NotFoundException('Bài thi không tồn tại');
    }
    return this.quizModel
      .findById(id)
      .populate('createdBy', '-password')
      .populate('questions');
  }

  /**
   * Cập nhật đề thi với danh sách câu hỏi
   * Dùng khi user tạo đề thi thủ công và thêm câu hỏi
   */
  async updateExamWithQuestions(
    id: string,
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
    userId: string,
  ) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }

    if (quiz.createdBy.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền sửa đề thi này');
    }

    // Update quiz info
    quiz.title = body.title;
    quiz.description = body.description || '';
    quiz.duration = body.duration || 60;
    quiz.passingPercentage = body.passingPercentage || 50;

    // Process questions
    const questionIds: string[] = [];
    for (const questionData of body.questions) {
      if (questionData._id && !questionData._id.startsWith('temp_')) {
        // Update existing question
        const question = await this.questionModel.findById(questionData._id);
        if (question) {
          question.content = questionData.content;
          question.type = this.mapStringToQuestionType(questionData.type);
          if (questionData.type === 'multiple-choice') {
            question.options = questionData.options || [];
          }
          if (questionData.type === 'short-answer' || questionData.type === 'essay') {
            if (questionData.answer) {
              question.correctAnswer = questionData.answer;
            }
          }
          await question.save();
          questionIds.push(question._id.toString());
        }
      } else {
        // Create new question
        const newQuestion = await this.questionModel.create({
          _id: uuidv4(),
          content: questionData.content,
          type: this.mapStringToQuestionType(questionData.type),
          options: questionData.type === 'multiple-choice' ? questionData.options : undefined,
          correctAnswer: (questionData.type === 'short-answer' || questionData.type === 'essay') 
            ? questionData.answer 
            : undefined,
          isActive: true,
          createdBy: userId,
        });
        questionIds.push(newQuestion._id.toString());
      }
    }

    // Update quiz with questions
    quiz.questions = questionIds;
    quiz.totalQuestions = questionIds.length;
    await quiz.save();

    return this.quizModel
      .findById(id)
      .populate('createdBy', '-password')
      .populate('questions');
  }

  /**
   * Xóa đề thi
   */
  async deleteExam(id: string, userId: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }

    if (quiz.createdBy.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền xóa đề thi này');
    }

    await this.quizModel.deleteOne({ _id: id });
    return { message: 'Xóa đề thi thành công' };
  }

  /**
   * Công bố đề thi (học sinh có thể xem và làm)
   */
  async publishExam(id: string, userId: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }

    if (quiz.createdBy.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền công bố đề thi này');
    }

    if (quiz.totalQuestions === 0) {
      throw new BadRequestException('Đề thi phải có ít nhất 1 câu hỏi');
    }

    quiz.isPublished = true;
    await quiz.save();

    return quiz.populate('createdBy', '-password');
  }

  /**
   * Hủy công bố đề thi
   */
  async unpublishExam(id: string, userId: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }

    if (quiz.createdBy.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền sửa đề thi này');
    }

    quiz.isPublished = false;
    await quiz.save();

    return quiz.populate('createdBy', '-password');
  }

  /**
   * Trộn câu hỏi
   */
  async shuffleQuestions(id: string, count?: number) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }

    const availableQuestions = await this.questionModel.find({
      isActive: true,
    });

    const shuffled = this.shuffleArray(availableQuestions);
    const selected = shuffled.slice(0, count || quiz.totalQuestions || 10);

    quiz.questions = selected.map((q) => q._id.toString());
    quiz.totalQuestions = selected.length;
    await quiz.save();

    return quiz.populate('questions');
  }

  /**
   * Lấy thống kê đề thi
   */
  async getExamStats(id: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }

    const results = await this.resultModel.find({ quizId: id });

    const totalAttempts = results.length;
    const passedCount = results.filter((r) => r.isPassed).length;
    const failedCount = totalAttempts - passedCount;

    const averageScore =
      totalAttempts > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / totalAttempts
        : 0;

    return {
      quizId: id,
      title: quiz.title,
      totalAttempts,
      passedCount,
      failedCount,
      passRate: totalAttempts > 0 ? (passedCount / totalAttempts) * 100 : 0,
      averageScore: Math.round(averageScore * 100) / 100,
      totalQuestions: quiz.totalQuestions,
      duration: quiz.duration,
      passingPercentage: quiz.passingPercentage,
    };
  }

  /**
   * Trợ helper: Map string to QuestionType enum
   */
  private mapStringToQuestionType(type: string): QuestionType {
    switch (type) {
      case 'multiple-choice':
      case 'multiple_choice':
        return QuestionType.MULTIPLE_CHOICE;
      case 'short-answer':
      case 'short_answer':
        return QuestionType.SHORT_ANSWER;
      case 'true-false':
      case 'true_false':
        return QuestionType.TRUE_FALSE;
      default:
        return QuestionType.MULTIPLE_CHOICE;
    }
  }

  /**
   * Trợ helper: Shuffle array
   */
  private shuffleArray(array: any[]): any[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
