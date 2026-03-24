import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from '../../schemas/question.schema';
import { QuestionBank, QuestionBankSchema } from '../../schemas/question-bank.schema';
import { Quiz, QuizSchema } from '../../schemas/quiz.schema';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { QuestionBanksService } from './question-banks.service';
import { QuestionBanksController } from './question-banks.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: QuestionBank.name, schema: QuestionBankSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
    AiModule,
  ],
  controllers: [QuestionsController, QuestionBanksController],
  providers: [QuestionsService, QuestionBanksService],
  exports: [QuestionsService, QuestionBanksService],
})
export class QuestionsModule {}
