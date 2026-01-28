import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Quiz, QuizSchema } from '../../schemas/quiz.schema';
import { Question, QuestionSchema } from '../../schemas/question.schema';
import { Result, ResultSchema } from '../../schemas/result.schema';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { AiModule } from '../ai/ai.module';
import { FileParserService } from '../../common/services/file-parser.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Quiz.name, schema: QuizSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Result.name, schema: ResultSchema },
    ]),
    AiModule,
  ],
  controllers: [ExamsController],
  providers: [ExamsService, FileParserService],
  exports: [ExamsService],
})
export class ExamsModule {}
