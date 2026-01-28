import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Submission, SubmissionSchema } from '../../schemas/submission.schema';
import { Result, ResultSchema } from '../../schemas/result.schema';
import { Question, QuestionSchema } from '../../schemas/question.schema';
import { Quiz, QuizSchema } from '../../schemas/quiz.schema';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Submission.name, schema: SubmissionSchema },
      { name: Result.name, schema: ResultSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
  ],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
