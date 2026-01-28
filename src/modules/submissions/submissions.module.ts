import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Submission, SubmissionSchema } from '../../schemas/submission.schema';
import { Result, ResultSchema } from '../../schemas/result.schema';
import { Quiz, QuizSchema } from '../../schemas/quiz.schema';
import { Question, QuestionSchema } from '../../schemas/question.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Submission.name, schema: SubmissionSchema },
      { name: Result.name, schema: ResultSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
