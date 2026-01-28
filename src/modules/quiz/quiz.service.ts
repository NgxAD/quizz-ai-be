import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quiz, QuizDocument } from '../../schemas/quiz.schema';
import { Question, QuestionDocument } from '../../schemas/question.schema';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { UpdateQuizDto } from './dtos/update-quiz.dto';

@Injectable()
export class QuizService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  async createQuiz(createQuizDto: CreateQuizDto, createdBy: string) {
    const quiz = await this.quizModel.create({
      ...createQuizDto,
      createdBy,
    });
    return quiz.populate('createdBy', '-password');
  }

  async findAll(teacherId?: string) {
    const query = teacherId ? { createdBy: teacherId } : { isPublished: true };
    return this.quizModel.find(query).populate('createdBy', '-password');
  }

  async findById(id: string) {
    const quiz = await this.quizModel
      .findById(id)
      .populate('createdBy', '-password')
      .populate('questions');

    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }
    return quiz;
  }

  async updateQuiz(id: string, updateQuizDto: UpdateQuizDto, userId: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    if (quiz.createdBy.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền sửa bài thi này');
    }

    const updated = await this.quizModel.findByIdAndUpdate(id, updateQuizDto, {
      new: true,
    });
    if (!updated) {
      throw new NotFoundException('Bài thi không tồn tại');
    }
    return await updated.populate('createdBy', '-password');
  }

  async deleteQuiz(id: string, userId: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    if (quiz.createdBy.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền xóa bài thi này');
    }

    // Delete all questions in the quiz
    await this.questionModel.deleteMany({ quizId: id });

    await this.quizModel.deleteOne({ _id: id });
    return { message: 'Xóa bài thi thành công' };
  }

  async addQuestions(quizId: string, questionIds: string[]) {
    const quiz = await this.quizModel.findById(quizId);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    // Verify all questions exist and belong to this quiz
    const questions = await this.questionModel.find({
      _id: { $in: questionIds },
      quizId,
    });

    if (questions.length !== questionIds.length) {
      throw new BadRequestException('Một số câu hỏi không tồn tại');
    }

    quiz.questions = questionIds;
    quiz.totalQuestions = questionIds.length;
    await quiz.save();

    return quiz.populate('questions');
  }

  async removeQuestion(quizId: string, questionId: string) {
    const quiz = await this.quizModel.findById(quizId);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    quiz.questions = quiz.questions.filter((id) => id.toString() !== questionId);
    quiz.totalQuestions = quiz.questions.length;
    await quiz.save();

    return quiz;
  }

  async publishQuiz(id: string, userId: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    if (quiz.createdBy.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền công bố bài thi này');
    }

    if (quiz.totalQuestions === 0) {
      throw new BadRequestException('Bài thi phải có ít nhất 1 câu hỏi');
    }

    const updated = await this.quizModel.findByIdAndUpdate(
      id,
      { isPublished: true },
      { new: true },
    );
    return updated;
  }

  async getQuizStats(id: string) {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    return {
      quizId: quiz._id,
      title: quiz.title,
      totalQuestions: quiz.totalQuestions,
      totalAttempts: quiz.totalAttempts,
      isPublished: quiz.isPublished,
      duration: quiz.duration,
      passingPercentage: quiz.passingPercentage,
    };
  }
}
