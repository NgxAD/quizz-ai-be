import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { QuestionType } from '../common/enums/question-type.enum';

export type QuestionDocument = Question & Document;

@Schema({ timestamps: true })
export class Question {
  @Prop({ required: true })
  content: string;

  @Prop({ enum: QuestionType, default: QuestionType.MULTIPLE_CHOICE })
  type: QuestionType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Quiz', required: true })
  quizId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Subject' })
  subjectId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: string;

  @Prop({
    type: [
      {
        text: String,
        isCorrect: Boolean,
      },
    ],
  })
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;

  @Prop()
  correctAnswer: string; // for short answer

  @Prop({ enum: ['easy', 'medium', 'hard'], default: 'medium' })
  level: string; // Mức độ: easy, medium, hard

  @Prop({ default: 1 })
  points: number;

  @Prop()
  explanation: string; // explanation after answering

  @Prop({ default: 0 })
  order: number; // order in quiz

  @Prop({ default: true })
  isActive: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
