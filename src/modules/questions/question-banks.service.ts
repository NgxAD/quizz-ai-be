import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuestionBank, QuestionBankDocument } from '../../schemas/question-bank.schema';
import { CreateQuestionBankDto } from './dtos/create-question-bank.dto';

@Injectable()
export class QuestionBanksService {
  constructor(
    @InjectModel(QuestionBank.name) private bankModel: Model<QuestionBankDocument>,
  ) {}

  async createBank(createBankDto: CreateQuestionBankDto, userId: string) {
    const bank = await this.bankModel.create({
      ...createBankDto,
      createdBy: userId,
    });
    return bank.populate('createdBy', '-password');
  }

  async findAllByUser(userId: string) {
    return this.bankModel
      .find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .populate('createdBy', '-password');
  }

  async findById(id: string) {
    const bank = await this.bankModel
      .findById(id)
      .populate('createdBy', '-password')
      .populate('questions');

    if (!bank) {
      throw new NotFoundException('Ngân hàng câu hỏi không tồn tại');
    }
    return bank;
  }

  async updateBank(id: string, updateData: Partial<CreateQuestionBankDto>) {
    const bank = await this.bankModel.findById(id);
    if (!bank) {
      throw new NotFoundException('Ngân hàng câu hỏi không tồn tại');
    }

    Object.assign(bank, updateData);
    await bank.save();
    return bank.populate('createdBy', '-password');
  }

  async deleteBank(id: string) {
    const bank = await this.bankModel.findById(id);
    if (!bank) {
      throw new NotFoundException('Ngân hàng câu hỏi không tồn tại');
    }

    await this.bankModel.deleteOne({ _id: id });
    return { message: 'Xóa ngân hàng câu hỏi thành công' };
  }

  async addQuestion(bankId: string, questionId: string) {
    const bank = await this.bankModel.findById(bankId);
    if (!bank) {
      throw new NotFoundException('Ngân hàng câu hỏi không tồn tại');
    }

    if (!bank.questions.includes(questionId)) {
      bank.questions.push(questionId);
      bank.totalQuestions = bank.questions.length;
      await bank.save();
    }

    return bank;
  }

  async removeQuestion(bankId: string, questionId: string) {
    const bank = await this.bankModel.findById(bankId);
    if (!bank) {
      throw new NotFoundException('Ngân hàng câu hỏi không tồn tại');
    }

    bank.questions = bank.questions.filter((qId) => qId.toString() !== questionId);
    bank.totalQuestions = bank.questions.length;
    await bank.save();

    return bank;
  }
}
