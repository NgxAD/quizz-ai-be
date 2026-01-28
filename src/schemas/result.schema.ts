import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ResultDocument = Result & Document;

@Schema({ timestamps: true })
export class Result {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Quiz', required: true })
  quizId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Submission', required: true })
  submissionId: string;

  @Prop({ default: 0 })
  totalPoints: number;

  @Prop({ default: 0 })
  correctAnswers: number;

  @Prop({ default: 0 })
  wrongAnswers: number;

  @Prop({ default: 0 })
  skipped: number;

  @Prop({ default: 0 })
  score: number; // percentage

  @Prop({ default: false })
  isPassed: boolean;

  @Prop({ default: 0 })
  rank: number; // rank among all attempts

  @Prop({ default: null })
  completedAt: Date;
}

export const ResultSchema = SchemaFactory.createForClass(Result);
