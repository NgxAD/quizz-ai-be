import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubjectDocument = Subject & Document;

@Schema({ timestamps: true })
export class Subject {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  icon: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  totalQuestions: number;

  @Prop({ default: 0 })
  totalExams: number;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);
