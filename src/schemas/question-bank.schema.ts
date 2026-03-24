import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type QuestionBankDocument = QuestionBank & Document;

@Schema({ timestamps: true })
export class QuestionBank {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: string;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Question', default: [] })
  questions: string[];

  @Prop({ default: 0 })
  totalQuestions: number;
}

export const QuestionBankSchema = SchemaFactory.createForClass(QuestionBank);
