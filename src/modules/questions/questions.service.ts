import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question, QuestionDocument } from '../../schemas/question.schema';
import { Quiz, QuizDocument } from '../../schemas/quiz.schema';
import { CreateQuestionDto } from './dtos/create-question.dto';
import { UpdateQuestionDto } from './dtos/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
  ) {}

  async createQuestion(createQuestionDto: CreateQuestionDto, userId: string) {
    const quiz = await this.quizModel.findById(createQuestionDto.quizId);
    if (!quiz) {
      throw new NotFoundException('Bài thi không tồn tại');
    }

    const question = await this.questionModel.create({
      ...createQuestionDto,
      createdBy: userId,
    });

    // Add question to quiz
    if (!quiz.questions.includes(question._id.toString())) {
      quiz.questions.push(question._id.toString());
      quiz.totalQuestions = quiz.questions.length;
      await quiz.save();
    }

    return question.populate('createdBy', '-password');
  }

  async findAll(subjectId?: string, level?: string) {
    const query: any = {};
    if (subjectId) query.subjectId = subjectId;
    if (level) query.level = level;

    return this.questionModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', '-password')
      .populate('subjectId');
  }

  async findByQuizId(quizId: string) {
    return this.questionModel
      .find({ quizId })
      .sort({ order: 1 })
      .populate('createdBy', '-password');
  }

  async findById(id: string) {
    const question = await this.questionModel
      .findById(id)
      .populate('createdBy', '-password');

    if (!question) {
      throw new NotFoundException('Câu hỏi không tồn tại');
    }
    return question;
  }

  async updateQuestion(id: string, updateQuestionDto: UpdateQuestionDto) {
    const question = await this.questionModel.findById(id);
    if (!question) {
      throw new NotFoundException('Câu hỏi không tồn tại');
    }

    const updated = await this.questionModel.findByIdAndUpdate(
      id,
      updateQuestionDto,
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('Câu hỏi không tồn tại');
    }
    return await updated.populate('createdBy', '-password');
  }

  async deleteQuestion(id: string) {
    const question = await this.questionModel.findById(id);
    if (!question) {
      throw new NotFoundException('Câu hỏi không tồn tại');
    }

    // Remove from quiz
    const quiz = await this.quizModel.findById(question.quizId);
    if (quiz) {
      quiz.questions = quiz.questions.filter((qId) => qId.toString() !== id);
      quiz.totalQuestions = quiz.questions.length;
      await quiz.save();
    }

    await this.questionModel.deleteOne({ _id: id });
    return { message: 'Xóa câu hỏi thành công' };
  }

  async bulkDeleteByQuizId(quizId: string) {
    await this.questionModel.deleteMany({ quizId });
  }

  async reorderQuestions(quizId: string, questionOrder: { id: string; order: number }[]) {
    const updates = questionOrder.map(({ id, order }) =>
      this.questionModel.updateOne({ _id: id }, { order }),
    );
    await Promise.all(updates);
    return this.findByQuizId(quizId);
  }
}
