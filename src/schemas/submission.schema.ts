import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SubmissionDocument = Submission & Document;

@Schema({ timestamps: true })
export class Submission {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Quiz', required: true })
  quizId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({
    type: [
      {
        questionId: MongooseSchema.Types.ObjectId,
        answer: MongooseSchema.Types.Mixed,
        isCorrect: Boolean,
        points: Number,
      },
    ],
  })
  answers: Array<{
    questionId: string;
    answer: string | string[];
    isCorrect: boolean;
    points: number;
  }>;

  @Prop({ default: 0 })
  totalPoints: number;

  @Prop({ default: 0 })
  score: number; // percentage

  @Prop({ default: false })
  isSubmitted: boolean;

  @Prop({ default: 0 })
  duration: number; // time spent in seconds

  @Prop({ default: null })
  submittedAt: Date;

  @Prop({ default: null })
  startedAt: Date;

  @Prop({ default: 0 })
  timeElapsed?: number; // Thời gian làm bài thực tế (giây)
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);
