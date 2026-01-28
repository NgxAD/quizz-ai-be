import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ClassDocument = Class & Document;

@Schema({ timestamps: true })
export class Class {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true, unique: true })
  code: string; // Join code for students

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: string; // Teacher ID

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  members: string[]; // Student IDs

  @Prop({ default: 0 })
  studentCount: number;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Quiz' }] })
  assignedExams: string[]; // Exams assigned to this class
}

export const ClassSchema = SchemaFactory.createForClass(Class);
