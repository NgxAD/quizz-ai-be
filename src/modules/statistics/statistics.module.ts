import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Result, ResultSchema } from '../../schemas/result.schema';
import { Submission, SubmissionSchema } from '../../schemas/submission.schema';
import { Quiz, QuizSchema } from '../../schemas/quiz.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Question, QuestionSchema } from '../../schemas/question.schema';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Result.name, schema: ResultSchema },
      { name: Submission.name, schema: SubmissionSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: User.name, schema: UserSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
