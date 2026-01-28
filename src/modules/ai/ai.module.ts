import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Question, QuestionSchema } from '../../schemas/question.schema';
import { Quiz, QuizSchema } from '../../schemas/quiz.schema';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
