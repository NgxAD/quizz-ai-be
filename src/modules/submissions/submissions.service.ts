import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Submission, SubmissionDocument } from '../../schemas/submission.schema';
import { Result, ResultDocument } from '../../schemas/result.schema';
import { Quiz, QuizDocument } from '../../schemas/quiz.schema';
import { Question, QuestionDocument } from '../../schemas/question.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { SaveAnswersDto } from './dtos/save-answers.dto';
import { SubmitAnswersDto } from './dtos/submit-answers.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectModel(Submission.name) private submissionModel: Model<SubmissionDocument>,
    @InjectModel(Result.name) private resultModel: Model<ResultDocument>,
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Bắt đầu làm bài
   * Tạo submission record và trả về bài thi
   */
  async startExam(examId: string, userId: string) {
    // Kiểm tra bài thi
    const exam = await this.quizModel.findById(examId).populate('questions');
    if (!exam) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    // Chỉ xem được bài thi công bố
    if (!exam.isPublished) {
      throw new ForbiddenException('Bài thi này chưa được công bố');
    }

    // Kiểm tra thời gian (nếu có)
    const now = new Date();
    if (exam.startDate && now < exam.startDate) {
      throw new ForbiddenException('Bài thi chưa bắt đầu');
    }
    if (exam.endDate && now > exam.endDate) {
      throw new ForbiddenException('Bài thi đã kết thúc');
    }

    // Kiểm tra đã có submission chưa
    let submission = await this.submissionModel.findOne({
      quizId: examId,
      userId,
      isSubmitted: false,
    });

    // Nếu chưa có, tạo submission mới
    if (!submission) {
      submission = await this.submissionModel.create({
        quizId: examId,
        userId,
        answers: [],
        startedAt: new Date(),
        isSubmitted: false,
      });
    }

    return {
      submission: {
        _id: submission._id,
        quizId: submission.quizId,
        userId: submission.userId,
        startedAt: submission.startedAt,
        timeLimit: exam.duration,
      },
      exam: {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        totalQuestions: exam.totalQuestions,
        isRandom: exam.isRandom,
        questions: exam.questions,
      },
    };
  }

  /**
   * Lưu đáp án tạm thời
   * Không tính điểm, chỉ lưu
   */
  async saveAnswers(submissionId: string, saveAnswersDto: SaveAnswersDto, userId: string) {
    const submission = await this.submissionModel.findById(submissionId);
    if (!submission) {
      throw new NotFoundException('Submission không tồn tại');
    }

    // Kiểm tra quyền
    if (submission.userId.toString() !== userId) {
      throw new ForbiddenException('Không có quyền sửa submission này');
    }

    // Không cho lưu nếu đã nộp
    if (submission.isSubmitted) {
      throw new BadRequestException('Bài đã nộp rồi, không thể sửa đáp án');
    }

    // Lưu đáp án
    submission.answers = saveAnswersDto.answers.map((answer) => ({
      questionId: answer.questionId as any,
      answer: answer.answer,
      isCorrect: false,
      points: 0,
    })) as any;

    if (saveAnswersDto.timeElapsed) {
      submission.timeElapsed = saveAnswersDto.timeElapsed;
    }

    await submission.save();

    return {
      message: 'Lưu đáp án thành công',
      submission: {
        _id: submission._id,
        totalAnswers: submission.answers.length,
        timeElapsed: submission.timeElapsed,
        savedAt: new Date(),
      },
    };
  }

  /**
   * Nộp bài
   * Tính điểm tự động và tạo result
   */
  async submitExam(submissionId: string, submitAnswersDto: SubmitAnswersDto, userId: string) {
    const submission = await this.submissionModel.findById(submissionId);
    if (!submission) {
      throw new NotFoundException('Submission không tồn tại');
    }

    // Kiểm tra quyền
    if (submission.userId.toString() !== userId) {
      throw new ForbiddenException('Không có quyền nộp bài này');
    }

    // Không cho nộp hai lần
    if (submission.isSubmitted) {
      throw new BadRequestException('Bài đã nộp rồi');
    }

    // Lấy bài thi
    const exam = await this.quizModel.findById(submission.quizId).populate('questions');
    if (!exam) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    // Tính điểm
    const scoringResult = await this.calculateScore(
      submission.answers,
      exam.questions,
      exam.passingPercentage,
    );

    // Cập nhật submission
    submission.isSubmitted = true;
    submission.submittedAt = new Date();
    if (submitAnswersDto.timeElapsed) {
      submission.timeElapsed = submitAnswersDto.timeElapsed;
    }
    await submission.save();

    // Tạo result
    const result = await this.resultModel.create({
      quizId: submission.quizId,
      userId: submission.userId,
      submissionId: submission._id,
      totalPoints: scoringResult.totalPoints,
      correctAnswers: scoringResult.correctAnswers,
      wrongAnswers: scoringResult.wrongAnswers,
      skipped: scoringResult.skipped,
      score: scoringResult.score,
      isPassed: scoringResult.isPassed,
      completedAt: new Date(),
    });

    return {
      message: 'Nộp bài thành công',
      result: {
        _id: result._id,
        score: result.score,
        isPassed: result.isPassed,
        correctAnswers: result.correctAnswers,
        wrongAnswers: result.wrongAnswers,
        skipped: result.skipped,
        totalPoints: result.totalPoints,
        completedAt: result.completedAt,
      },
    };
  }

  /**
   * Tính điểm
   */
  private async calculateScore(
    answers: any[],
    questions: any[],
    passingPercentage: number,
  ): Promise<any> {
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let skipped = 0;
    let totalPoints = 0;

    // Map answers by questionId for faster lookup
    const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));

    // Tính điểm từng câu
    for (const question of questions) {
      totalPoints += question.points || 1;

      const studentAnswer = answerMap.get(question._id.toString());

      if (!studentAnswer) {
        // Học sinh bỏ trống
        skipped++;
        continue;
      }

      // Kiểm tra xem câu trả lời đúng không
      const isCorrect = this.isAnswerCorrect(question, studentAnswer);

      if (isCorrect) {
        correctAnswers += 1;
      } else {
        wrongAnswers += 1;
      }
    }

    // Tính phần trăm
    const score = totalPoints > 0 ? (correctAnswers / questions.length) * 100 : 0;
    const isPassed = score >= passingPercentage;

    return {
      correctAnswers,
      wrongAnswers,
      skipped,
      totalPoints,
      score: Math.round(score * 100) / 100,
      isPassed,
    };
  }

  /**
   * Kiểm tra đáp án đúng
   */
  private isAnswerCorrect(question: any, studentAnswer: string | string[]): boolean {
    // Cho multiple choice hoặc true/false
    if (question.options && question.options.length > 0) {
      const correctOption = question.options.find((opt) => opt.isCorrect);
      if (correctOption) {
        const correctValue = correctOption.text || correctOption._id?.toString();
        if (Array.isArray(studentAnswer)) {
          return studentAnswer.includes(correctValue);
        }
        return studentAnswer === correctValue;
      }
    }

    // Cho short answer - exact match
    if (question.correctAnswer) {
      const answerText = Array.isArray(studentAnswer) ? studentAnswer[0] : studentAnswer;
      return answerText.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
    }

    return false;
  }

  /**
   * Lấy submission
   */
  async getSubmission(submissionId: string, userId: string) {
    const submission = await this.submissionModel
      .findById(submissionId)
      .populate('quizId')
      .populate('userId', '-password');

    if (!submission) {
      throw new NotFoundException('Submission không tồn tại');
    }

    // Chỉ xem được submission của mình (ngoại trừ admin)
    if (submission.userId.toString() !== userId) {
      throw new ForbiddenException('Không có quyền xem submission này');
    }

    return submission;
  }

  /**
   * Lấy kết quả làm bài
   */
  async getExamResult(examId: string, userId: string) {
    // Tìm result đã nộp
    const result = await this.resultModel
      .findOne({ quizId: examId, userId })
      .sort({ completedAt: -1 })
      .populate('quizId')
      .populate('submissionId');

    if (result) {
      return {
        status: 'submitted',
        result: {
          _id: result._id,
          score: result.score,
          isPassed: result.isPassed,
          correctAnswers: result.correctAnswers,
          wrongAnswers: result.wrongAnswers,
          skipped: result.skipped,
          totalPoints: result.totalPoints,
          completedAt: result.completedAt,
        },
      };
    }

    // Nếu chưa nộp, tìm submission draft
    const submission = await this.submissionModel.findOne({
      quizId: examId,
      userId,
      isSubmitted: false,
    });

    if (submission) {
      return {
        status: 'draft',
        submission: {
          _id: submission._id,
          totalAnswers: submission.answers.length,
          startedAt: submission.startedAt,
          timeElapsed: submission.timeElapsed,
        },
      };
    }

    // Chưa bắt đầu
    return {
      status: 'not_started',
      message: 'Chưa bắt đầu làm bài',
    };
  }

  /**
   * Xem lại bài (review)
   * Chỉ cho xem sau khi nộp bài
   */
  async reviewSubmission(submissionId: string, userId: string) {
    const submission = await this.submissionModel.findById(submissionId).populate('quizId');
    if (!submission) {
      throw new NotFoundException('Submission không tồn tại');
    }

    if (submission.userId.toString() !== userId) {
      throw new ForbiddenException('Không có quyền xem submission này');
    }

    if (!submission.isSubmitted) {
      throw new BadRequestException('Chỉ xem được bài đã nộp');
    }

    // Lấy questions
    const questions = await this.questionModel.find({
      _id: { $in: (submission.quizId as any).questions },
    });

    // Lấy result
    const result = await this.resultModel.findOne({
      submissionId: submission._id,
    });

    // Tạo review data
    const answerMap = new Map(submission.answers.map((a) => [a.questionId, a.answer]));

    const reviewData = questions.map((q) => {
      const studentAnswer = answerMap.get(q._id.toString());
      const isCorrect = studentAnswer ? this.isAnswerCorrect(q, studentAnswer) : false;

      return {
        questionId: q._id,
        content: q.content,
        type: q.type,
        studentAnswer,
        isCorrect,
        correctAnswer: q.correctAnswer,
        correctOption: q.options?.find((opt) => opt.isCorrect),
        explanation: q.explanation,
        points: q.points,
      };
    });

    return {
      submissionId: submission._id,
      quizId: submission.quizId,
      score: result?.score,
      isPassed: result?.isPassed,
      completedAt: submission.submittedAt,
      answers: reviewData,
    };
  }

  /**
   * Lấy submission của học sinh
   */
  async getUserSubmissions(userId: string, examId?: string) {
    const query: any = { userId };
    if (examId) query.quizId = examId;

    return this.submissionModel
      .find(query)
      .populate('quizId', 'title totalQuestions')
      .sort({ startedAt: -1 });
  }

  /**
   * Lấy submissions của bài thi (teacher/admin)
   */
  async getExamSubmissions(examId: string) {
    return this.submissionModel
      .find({ quizId: examId })
      .populate('userId', 'email fullName')
      .sort({ startedAt: -1 });
  }
}
