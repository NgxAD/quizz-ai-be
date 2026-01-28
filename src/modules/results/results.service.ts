import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Submission, SubmissionDocument } from '../../schemas/submission.schema';
import { Result, ResultDocument } from '../../schemas/result.schema';
import { Question, QuestionDocument } from '../../schemas/question.schema';
import { Quiz, QuizDocument } from '../../schemas/quiz.schema';

@Injectable()
export class ResultsService {
  constructor(
    @InjectModel(Submission.name) private submissionModel: Model<SubmissionDocument>,
    @InjectModel(Result.name) private resultModel: Model<ResultDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
  ) {}

  async startQuiz(quizId: string, userId: string) {
    const quiz = await this.quizModel.findById(quizId);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    const existingSubmission = await this.submissionModel.findOne({
      quizId,
      userId,
      isSubmitted: false,
    });

    if (existingSubmission) {
      return existingSubmission;
    }

    const submission = await this.submissionModel.create({
      quizId,
      userId,
      startedAt: new Date(),
      answers: [],
    });

    return submission;
  }

  async saveAnswers(submissionId: string, answers: any) {
    const submission = await this.submissionModel.findById(submissionId);
    if (!submission) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }

    submission.answers = answers;
    await submission.save();

    return submission;
  }

  async submitQuiz(submissionId: string, userId: string) {
    const submission = await this.submissionModel.findById(submissionId);
    if (!submission) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }

    if (submission.isSubmitted) {
      throw new BadRequestException('Bài thi đã được nộp');
    }

    const quiz = await this.quizModel.findById(submission.quizId);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    // Calculate score
    const { totalPoints, correctCount } = await this.calculateScore(
      submission.answers,
      submission.quizId,
    );

    const score = (correctCount / submission.answers.length) * 100;
    const isPassed = score >= quiz.passingPercentage;

    submission.isSubmitted = true;
    submission.totalPoints = totalPoints;
    submission.score = score;
    submission.submittedAt = new Date();
    submission.duration = Math.round(
      (submission.submittedAt.getTime() - submission.startedAt.getTime()) / 1000,
    );
    await submission.save();

    // Update quiz attempt count
    quiz.totalAttempts += 1;
    await quiz.save();

    // Create result record
    const result = await this.resultModel.create({
      quizId: submission.quizId,
      userId: submission.userId,
      submissionId: submission._id,
      totalPoints,
      correctAnswers: correctCount,
      wrongAnswers: submission.answers.length - correctCount,
      skipped: 0,
      score,
      isPassed,
      completedAt: new Date(),
    });

    return {
      message: 'Nộp bài thành công',
      submission,
      result,
    };
  }

  private async calculateScore(
    answers: any[],
    quizId: string,
  ): Promise<{ totalPoints: number; correctCount: number }> {
    let totalPoints = 0;
    let correctCount = 0;

    for (const answer of answers) {
      const question = await this.questionModel.findById(answer.questionId);
      if (!question) continue;

      totalPoints += question.points;

      const isCorrect = this.compareAnswers(
        answer.answer,
        question.options || [{ text: question.correctAnswer, isCorrect: true }],
      );

      if (isCorrect) {
        correctCount += 1;
      }
    }

    return { totalPoints, correctCount };
  }

  private compareAnswers(userAnswer: string | string[], correctOptions: any[]): boolean {
    if (typeof userAnswer === 'string') {
      return correctOptions.some(
        (opt) => opt.isCorrect && opt.text.toLowerCase() === userAnswer.toLowerCase(),
      );
    }

    const correctAnswers = correctOptions
      .filter((opt) => opt.isCorrect)
      .map((opt) => opt.text.toLowerCase());
    const userAnswers = userAnswer.map((a) => a.toLowerCase());

    return (
      correctAnswers.length === userAnswers.length &&
      correctAnswers.every((ans) => userAnswers.includes(ans))
    );
  }

  async getQuizResults(quizId: string) {
    return this.resultModel.find({ quizId }).populate('userId', '-password');
  }

  async getUserResults(userId: string) {
    return this.resultModel
      .find({ userId })
      .populate('quizId')
      .populate('userId', '-password');
  }

  async getResult(resultId: string) {
    const result = await this.resultModel
      .findById(resultId)
      .populate('quizId')
      .populate('userId', '-password')
      .populate('submissionId');

    if (!result) {
      throw new NotFoundException('Kết quả không tồn tại');
    }
    return result;
  }

  async getQuizStatistics(quizId: string) {
    const results = await this.resultModel.find({ quizId });

    if (results.length === 0) {
      return {
        quizId,
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        minScore: 0,
        maxScore: 0,
      };
    }

    const scores = results.map((r) => r.score);
    const passedCount = results.filter((r) => r.isPassed).length;

    return {
      quizId,
      totalAttempts: results.length,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      passRate: (passedCount / results.length) * 100,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
    };
  }

  async getLeaderboard(quizId: string, limit = 10) {
    return this.resultModel
      .find({ quizId })
      .populate('userId', '-password')
      .sort({ score: -1 })
      .limit(limit);
  }
}
