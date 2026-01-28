import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from '../../schemas/question.schema';
import { Quiz, QuizSchema } from '../../schemas/quiz.schema';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
    AiModule,
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
