import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quiz, QuizDocument } from '../../schemas/quiz.schema';
import { Question, QuestionDocument } from '../../schemas/question.schema';
import { Result, ResultDocument } from '../../schemas/result.schema';
import { Class, ClassDocument } from '../../schemas/class.schema';
import { QuestionType } from '../../common/enums/question-type.enum';
import { CreateExamDto } from './dtos/create-exam.dto';
import { UpdateExamDto } from './dtos/update-exam.dto';
import { UploadAndCreateExamDto } from './dtos/upload-and-create-exam.dto';
import { AiService } from '../ai/ai.service';
import { FileParserService } from '../../common/services/file-parser.service';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(Result.name) private resultModel: Model<ResultDocument>,
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    private aiService: AiService,
    private fileParserService: FileParserService,
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
      examType: quizData.type || 'exercise', // Set examType from type field
      isPublished: true, // Publish by default khi tạo từ upload/manual
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
   * Tạo đề thi từ file upload với cấu trúc trống
   * Giáo viên sẽ điền số lượng câu và chọn đáp án đúng thủ công
   */
  async createExamFromFileStructure(
    uploadAndCreateDto: UploadAndCreateExamDto,
    numberOfQuestions: number,
    numberOfAnswersPerQuestion: number,
    createdBy: string,
    fileContent?: string,
    fileName?: string,
  ) {
    const finalFileContent = fileContent || uploadAndCreateDto.fileContent;
    const finalFileName = fileName || uploadAndCreateDto.fileName;

    // Validate inputs
    if (numberOfQuestions <= 0) {
      throw new BadRequestException('Số lượng câu hỏi phải lớn hơn 0');
    }

    if (numberOfAnswersPerQuestion < 2 || numberOfAnswersPerQuestion > 10) {
      throw new BadRequestException('Số lượng đáp án phải từ 2 đến 10');
    }

    // Tạo Quiz
    const quiz = await this.quizModel.create({
      title: uploadAndCreateDto.title,
      description: uploadAndCreateDto.description || '',
      duration: uploadAndCreateDto.duration || 60,
      passingPercentage: uploadAndCreateDto.passingPercentage || 50,
      examType: uploadAndCreateDto.type || 'exercise', // Set examType from type field
      createdBy,
      isPublished: true,
      fileContent: finalFileContent || null,
      fileName: finalFileName || null,
    });

    // Tạo câu hỏi trống với cấu trúc A, B, C, D...
    const questionIds: string[] = [];
    const answerLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    
    for (let i = 0; i < numberOfQuestions; i++) {
      // Tạo cấu trúc đáp án
      const options: Array<{ text: string; isCorrect: boolean }> = [];
      const numAnswers = Math.min(numberOfAnswersPerQuestion, answerLetters.length);
      
      for (let j = 0; j < numAnswers; j++) {
        options.push({
          text: answerLetters[j],
          isCorrect: false, // Giáo viên sẽ chọn đáp án đúng
        });
      }

      const question = await this.questionModel.create({
        content: `Câu ${i + 1}`, // Placeholder question name
        type: 'multiple_choice',
        options,
        correctAnswer: '', // Will be set by teacher
        quizId: quiz._id,
        createdBy,
        order: i,
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
      image?: string; // base64 image data
    }>,
    createdBy: string,
    fileContent?: string,
    fileName?: string,
    examType?: 'exercise' | 'test',
  ) {
    // Use fileContent and fileName from parameters if provided, otherwise from DTO
    const finalFileContent = fileContent || uploadAndCreateDto.fileContent;
    const finalFileName = fileName || uploadAndCreateDto.fileName;

    // Check if questions are empty or invalid (all content is 'Câu hỏi' default)
    const areQuestionsEmpty = !extractedQuestions || extractedQuestions.length === 0 ||
      extractedQuestions.every(q =>
        !q.content?.trim() || 
        q.content === 'Câu hỏi' ||
        !q.options?.some((opt: any) => opt && opt.text && opt.text.trim())
      );

    // If questions are empty but fileContent exists, parse fileContent instead
    let questionsToCreate = extractedQuestions;
    if (areQuestionsEmpty && finalFileContent) {
      console.log('Questions are empty, parsing fileContent instead...');
      console.log('fileContent length:', finalFileContent.length);
      console.log('fileContent preview:', finalFileContent.substring(0, 300));
      
      const normalizedText = this.fileParserService.normalizeText(finalFileContent);
      console.log('normalizedText length:', normalizedText.length);
      console.log('normalizedText preview:', normalizedText.substring(0, 300));
      
      const parsedQuestions = this.fileParserService.extractQuestions(normalizedText);
      
      if (parsedQuestions && parsedQuestions.length > 0) {
        console.log(`Parsed ${parsedQuestions.length} questions from fileContent`);
        console.log('First parsed question:', {
          content: parsedQuestions[0].content.substring(0, 50),
          options: parsedQuestions[0].options,
          correctAnswer: parsedQuestions[0].correctAnswer,
        });
        questionsToCreate = parsedQuestions;
      } else {
        console.log('File parser returned no questions');
      }
    }

    // Tạo Quiz
    const quiz = await this.quizModel.create({
      title: uploadAndCreateDto.title,
      description: uploadAndCreateDto.description || '',
      duration: uploadAndCreateDto.duration || 60,
      passingPercentage: uploadAndCreateDto.passingPercentage || 50,
      createdBy,
      isPublished: true, // Publish by default when created from file/manual
      fileContent: finalFileContent || null,
      fileName: finalFileName || null,
      examType: examType || 'exercise', // Default to exercise if not provided
    });

    // Tạo Questions từ extracted data
    const questionIds: string[] = [];
    for (const extractedQ of questionsToCreate) {
      // Validate that question has content and options
      if (!extractedQ.content?.trim()) {
        console.warn('Skipping question with empty content:', extractedQ);
        continue;
      }

      // Validate that at least one option has non-empty text
      const hasValidOption = extractedQ.options?.some((opt: any) => {
        const optText = typeof opt === 'string' ? opt : opt?.text;
        return optText && optText.trim();
      });

      if (!hasValidOption) {
        console.warn('Question has no valid options (all empty):', {
          content: extractedQ.content.substring(0, 50),
          options: extractedQ.options,
        });
        throw new BadRequestException(
          `Question "${extractedQ.content.substring(0, 50)}" has no valid answer options. ` +
          `Please ensure the file contains complete questions with all options.`
        );
      }

      // Normalize options to ensure consistent format
      const questionOptions = this.normalizeOptions(
        extractedQ.options || [],
        extractedQ.correctAnswer,
      );

      // Find the correct answer text from options
      const correctOption = questionOptions.find((opt) => opt.isCorrect);
      const correctAnswerText = correctOption ? correctOption.text : '';

      console.log(`Creating question:`, {
        content: extractedQ.content.substring(0, 50),
        options: questionOptions,
        correctAnswerText,
        extractedCorrectAnswer: extractedQ.correctAnswer,
      });

      // Convert type from MULTIPLE_CHOICE to multiple_choice
      let questionType = 'multiple_choice';
      if (extractedQ.type) {
        questionType = extractedQ.type.toLowerCase().replace('_', '_');
      }

      const question = await this.questionModel.create({
        content: extractedQ.content,
        type: questionType,
        options: questionOptions,
        correctAnswer: correctAnswerText,
        quizId: quiz._id,
        createdBy,
        image: extractedQ.image, // Save image if provided
      });

      console.log(`Created question ${question._id}:`, {
        options: question.options,
        correctAnswer: question.correctAnswer,
      });

      questionIds.push(question._id.toString());
    }

    // Update quiz with questions
    quiz.questions = questionIds;
    quiz.totalQuestions = questionIds.length;
    await quiz.save();

    console.log(`Created exam with ${questionIds.length} questions`, {
      quizId: quiz._id,
      quizTitle: quiz.title,
    });

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
  async findById(id: string, userId?: string, userRole?: string) {
    try {
      // First get the quiz without populating questions
      let quiz = await this.quizModel
        .findById(id)
        .populate('createdBy', '-password')
        .populate('subjectId');

      if (!quiz) {
        throw new NotFoundException('Đề thi không tồn tại');
      }

      // Manually fetch questions to handle null/deleted questions better
      if (quiz.questions && Array.isArray(quiz.questions) && quiz.questions.length > 0) {
        try {
          const questionIds = quiz.questions.filter(q => q != null);
          console.log(`Loading ${questionIds.length} questions for quiz ${id}`);
          
          if (questionIds.length > 0) {
            const questions = await this.questionModel
              .find({ _id: { $in: questionIds } });
            
            console.log(`Found ${questions.length} questions in database`);
            
            // Log first 2 questions for debugging
            if (questions.length > 0) {
              console.log('First question sample:', {
                _id: questions[0]._id,
                content: questions[0].content.substring(0, 50),
                options: questions[0].options,
                correctAnswer: questions[0].correctAnswer,
              });
            }
            
            // Maintain the order from quiz.questions
            const orderedQuestions: any[] = [];
            const questionMap = new Map(questions.map(q => [q._id.toString(), q]));
            
            for (const qId of questionIds) {
              const q = questionMap.get(qId.toString());
              if (q) {
                orderedQuestions.push(q);
              }
            }
            
            quiz.questions = orderedQuestions;
            console.log(`Successfully loaded ${orderedQuestions.length} questions for quiz ${id}`);
          } else {
            quiz.questions = [];
          }
        } catch (questionsError) {
          console.error('Error loading questions:', questionsError);
          // If questions fail to load, try one more time with populate
          try {
            console.log('Attempting fallback question loading...');
            const quizWithQuestions = await this.quizModel
              .findById(id)
              .populate('questions');
            if (quizWithQuestions && quizWithQuestions.questions) {
              quiz.questions = (quizWithQuestions.questions as any[]).filter(q => q != null) as any;
              console.log(`Fallback loaded ${quiz.questions.length} questions`);
            } else {
              quiz.questions = [];
            }
          } catch (fallbackError) {
            console.error('Fallback question loading also failed:', fallbackError);
            quiz.questions = [];
          }
        }
      }

      return quiz;
    } catch (error) {
      console.error('Error in findById:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Fallback: Return quiz without questions if anything fails
      try {
        const quiz = await this.quizModel.findById(id);
        if (!quiz) {
          throw new NotFoundException('Đề thi không tồn tại');
        }
        quiz.questions = [] as any; // Return with empty questions as fallback
        console.log('Returning quiz without questions due to error');
        return quiz;
      } catch (fallbackErr) {
        console.error('Complete failure in fallback:', fallbackErr);
        throw new NotFoundException('Đề thi không tồn tại');
      }
    }
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
  /**
   * Normalize options để đảm bảo format consistent: {text: string, isCorrect: boolean}[]
   */
  private normalizeOptions(
    options: any[],
    correctAnswerIndex?: number,
  ): Array<{ text: string; isCorrect: boolean }> {
    if (!options || options.length === 0) return [];

    // Nếu là string array - convert thành object array
    if (typeof options[0] === 'string') {
      return options.map((opt, idx) => ({
        text: String(opt || ''),
        isCorrect: correctAnswerIndex !== undefined ? idx === correctAnswerIndex : false,
      }));
    }

    // Nếu đã là object array - ensure format consistent
    return options.map((opt: any) => ({
      text: String(opt.text || ''),
      isCorrect: Boolean(opt.isCorrect || false),
    }));
  }

  async updateExamWithQuestions(
    id: string,
    body: {
      title: string;
      description?: string;
      duration?: number;
      passingPercentage?: number;
      type?: 'exercise' | 'test';
      questions: Array<{
        _id?: string;
        content: string;
        type: 'multiple-choice' | 'essay' | 'short-answer' | 'true-false';
        options?: Array<{ text: string; isCorrect: boolean }>;
        answer?: string;
        explanation?: string;
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
    if (body.type) {
      quiz.examType = body.type;
    }

    // Process questions
    const questionIds: string[] = [];
    try {
      for (const questionData of body.questions) {
        if (questionData._id && !questionData._id.startsWith('temp_')) {
          // Update existing question
          const question = await this.questionModel.findById(questionData._id);
          if (question) {
            question.content = questionData.content;
            question.type = this.mapStringToQuestionType(questionData.type);
            
            // Handle options
            if (questionData.type === 'multiple-choice' && questionData.options) {
              question.options = this.normalizeOptions(questionData.options);
            } else {
              question.options = [];
            }
            
            // Update correctAnswer for all question types
            if (questionData.answer) {
              question.correctAnswer = questionData.answer;
            } else {
              question.correctAnswer = '';
            }
            
            // Update explanation
            if (questionData.explanation) {
              question.explanation = questionData.explanation;
            } else {
              question.explanation = '';
            }
            
            await question.save();
            questionIds.push(question._id.toString());
          } else {
            throw new NotFoundException(`Question with id ${questionData._id} not found`);
          }
        } else {
          // Create new question
          const newQuestion = await this.questionModel.create({
            content: questionData.content,
            type: this.mapStringToQuestionType(questionData.type),
            options: questionData.type === 'multiple-choice'
              ? this.normalizeOptions(questionData.options || [])
              : undefined,
            correctAnswer: (questionData.type === 'short-answer' || questionData.type === 'essay' || questionData.type === 'multiple-choice')
              ? questionData.answer
              : undefined,
            explanation: questionData.explanation,
            isActive: true,
            createdBy: userId,
            quizId: id, // Add the quiz ID
          });
          questionIds.push(newQuestion._id.toString());
        }
      }
    } catch (error: any) {
      console.error('Error processing questions:', error);
      throw error;
    }

    // Delete questions that are no longer in the exam
    const oldQuestionIds = quiz.questions.map(q => q.toString());
    console.log('[updateExamWithQuestions] Old questions:', oldQuestionIds);
    console.log('[updateExamWithQuestions] New questions:', questionIds);
    
    const questionsToDelete = oldQuestionIds.filter(id => !questionIds.includes(id));
    console.log('[updateExamWithQuestions] Questions to delete:', questionsToDelete);
    
    if (questionsToDelete.length > 0) {
      console.log(`[updateExamWithQuestions] Deleting ${questionsToDelete.length} unreferenced questions`);
      const deleteResult = await this.questionModel.deleteMany({
        _id: { $in: questionsToDelete }
      });
      console.log('[updateExamWithQuestions] Delete result - deletedCount:', deleteResult.deletedCount);
    }

    // Update quiz with questions
    quiz.questions = questionIds;
    quiz.totalQuestions = questionIds.length;
    await quiz.save();
    console.log('[updateExamWithQuestions] Quiz saved with questions:', quiz.questions);

    // Verify questions were deleted by checking database
    const remainingOldQuestions = await this.questionModel.find({
      _id: { $in: questionsToDelete }
    });
    if (remainingOldQuestions.length > 0) {
      console.warn(`[updateExamWithQuestions] WARNING: ${remainingOldQuestions.length} questions still exist after deletion!`);
    }

    // Force fresh fetch from database using lean for uncached data
    const updatedQuiz = await this.quizModel
      .findById(id)
      .select({ questions: 1 })
      .lean();
    
    if (!updatedQuiz) {
      throw new NotFoundException('Đề thi không tồn tại');
    }
    
    // Now fetch the actual questions
    const finalQuestions = await this.questionModel
      .find({ _id: { $in: updatedQuiz.questions } })
      .lean();
    
    console.log('[updateExamWithQuestions] Final questions count:', finalQuestions.length);
    console.log('[updateExamWithQuestions] Final questions:', finalQuestions.map(q => ({
      _id: q._id,
      content: q.content?.substring(0, 30)
    })));
    
    // Return full exam with all data
    return await this.quizModel
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

    // Check if exam is assigned to any classes
    const assignedClasses = await this.classModel.find({ 
      assignedExams: id 
    });

    if (assignedClasses && assignedClasses.length > 0) {
      const classNames = assignedClasses.map(cls => cls.name).join(', ');
      throw new BadRequestException(
        `Không thể xóa đề thi này vì nó đang được giao cho lớp: ${classNames}. Vui lòng xóa khỏi những lớp này trước khi xóa đề thi.`
      );
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
