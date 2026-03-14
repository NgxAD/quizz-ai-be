import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type QuizDocument = Quiz & Document;

@Schema({ timestamps: true })
export class Quiz {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Subject' })
  subjectId: string;

  @Prop({ default: 0 })
  totalQuestions: number;

  @Prop({ default: 60 })
  duration: number; // in minutes

  @Prop({ default: true })
  isPublished: boolean;

  @Prop({ default: false })
  isRandom: boolean; // shuffle questions

  @Prop({ default: 1 })
  passingPercentage: number; // 0-100

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Question' }] })
  questions: string[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  allowedUsers: string[]; // empty = all can access

  @Prop({ default: null })
  startDate: Date;

  @Prop({ default: null })
  endDate: Date;

  @Prop({ default: 0 })
  totalAttempts: number;

  @Prop({ type: String, default: null })
  fileContent?: string; // Nội dung file đề (để hiển thị cho học sinh)

  @Prop({ type: String, default: null })
  fileName?: string; // Tên file gốc

  @Prop({ enum: ['exercise', 'test'], default: 'exercise' })
  examType: 'exercise' | 'test'; // exercise: can retake & see answers, test: one time only
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);

// Add virtual field to expose examType as type for API compatibility
QuizSchema.virtual('type').get(function() {
  return this.examType;
});

// Ensure virtuals are included in toJSON
QuizSchema.set('toJSON', { virtuals: true });
