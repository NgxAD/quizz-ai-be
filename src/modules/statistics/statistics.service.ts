import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Result, ResultDocument } from '../../schemas/result.schema';
import { Submission, SubmissionDocument } from '../../schemas/submission.schema';
import { Quiz, QuizDocument } from '../../schemas/quiz.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Question, QuestionDocument } from '../../schemas/question.schema';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Result.name) private resultModel: Model<ResultDocument>,
    @InjectModel(Submission.name) private submissionModel: Model<SubmissionDocument>,
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  async getSystemStatistics() {
    const totalUsers = await this.userModel.countDocuments();
    const totalQuizzes = await this.quizModel.countDocuments({ isPublished: true });
    const totalQuestions = await this.questionModel.countDocuments();
    const totalSubmissions = await this.submissionModel.countDocuments({ isSubmitted: true });

    const allResults = await this.resultModel.find();
    const averageScore = allResults.length > 0 
      ? allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length 
      : 0;

    const passedCount = allResults.filter((r) => r.isPassed).length;
    const passRate = allResults.length > 0 ? (passedCount / allResults.length) * 100 : 0;

    return {
      totalUsers,
      totalQuizzes,
      totalQuestions,
      totalSubmissions,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      totalResults: allResults.length,
    };
  }

  async getUserStatistics(userId: string) {
    const results = await this.resultModel.find({ userId });
    
    if (results.length === 0) {
      return {
        userId,
        totalAttempts: 0,
        totalQuizzesCompleted: 0,
        averageScore: 0,
        passedQuizzes: 0,
        failedQuizzes: 0,
        passRate: 0,
        bestScore: 0,
        worstScore: 0,
      };
    }

    const scores = results.map((r) => r.score);
    const passedCount = results.filter((r) => r.isPassed).length;

    return {
      userId,
      totalAttempts: results.length,
      totalQuizzesCompleted: new Set(results.map((r) => r.quizId)).size,
      averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
      passedQuizzes: passedCount,
      failedQuizzes: results.length - passedCount,
      passRate: Math.round((passedCount / results.length) * 100 * 100) / 100,
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores),
    };
  }

  async getQuizStatistics(quizId: string) {
    const quiz = await this.quizModel.findById(quizId);
    if (!quiz) {
      throw new Error('Quiz không tồn tại');
    }

    const results = await this.resultModel.find({ quizId });

    if (results.length === 0) {
      return {
        quizId,
        title: quiz.title,
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        minScore: 0,
        maxScore: 0,
        totalPassedStudents: 0,
        totalFailedStudents: 0,
        scoreDistribution: {
          excellent: 0, // 90-100
          good: 0, // 75-89
          average: 0, // 60-74
          poor: 0, // <60
        },
      };
    }

    const scores = results.map((r) => r.score);
    const passedCount = results.filter((r) => r.isPassed).length;

    const scoreDistribution = {
      excellent: scores.filter((s) => s >= 90).length,
      good: scores.filter((s) => s >= 75 && s < 90).length,
      average: scores.filter((s) => s >= 60 && s < 75).length,
      poor: scores.filter((s) => s < 60).length,
    };

    return {
      quizId,
      title: quiz.title,
      totalAttempts: results.length,
      averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
      passRate: Math.round((passedCount / results.length) * 100 * 100) / 100,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      totalPassedStudents: passedCount,
      totalFailedStudents: results.length - passedCount,
      scoreDistribution,
    };
  }

  async getQuestionStatistics(questionId: string) {
    const question = await this.questionModel.findById(questionId);
    if (!question) {
      throw new Error('Câu hỏi không tồn tại');
    }

    const submissions = await this.submissionModel.find({ isSubmitted: true });
    
    let correctCount = 0;
    let totalAttempts = 0;

    submissions.forEach((submission) => {
      const answer = submission.answers.find((a) => a.questionId.toString() === questionId);
      if (answer) {
        totalAttempts++;
        if (answer.isCorrect) {
          correctCount++;
        }
      }
    });

    const correctRate = totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 0;

    return {
      questionId,
      content: question.content,
      totalAttempts,
      correctAnswers: correctCount,
      wrongAnswers: totalAttempts - correctCount,
      correctRate: Math.round(correctRate * 100) / 100,
      difficulty: correctRate > 80 ? 'easy' : correctRate > 50 ? 'medium' : 'hard',
    };
  }

  async getStudentRanking(quizId: string, limit = 100) {
    const results = await this.resultModel
      .find({ quizId })
      .populate('userId', 'fullName email')
      .sort({ score: -1 })
      .limit(limit);

    return results.map((result, index) => ({
      rank: index + 1,
      userId: result.userId,
      score: result.score,
      totalPoints: result.totalPoints,
      correctAnswers: result.correctAnswers,
      wrongAnswers: result.wrongAnswers,
      isPassed: result.isPassed,
      completedAt: result.completedAt,
    }));
  }

  async getSubjectStatistics(subjectId: string) {
    const quizzes = await this.quizModel.find({ subjectId });
    const quizIds = quizzes.map((q) => q._id);

    const results = await this.resultModel.find({ quizId: { $in: quizIds } });

    if (results.length === 0) {
      return {
        subjectId,
        totalQuizzes: quizzes.length,
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
      };
    }

    const scores = results.map((r) => r.score);
    const passedCount = results.filter((r) => r.isPassed).length;

    return {
      subjectId,
      totalQuizzes: quizzes.length,
      totalAttempts: results.length,
      averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
      passRate: Math.round((passedCount / results.length) * 100 * 100) / 100,
    };
  }
}
