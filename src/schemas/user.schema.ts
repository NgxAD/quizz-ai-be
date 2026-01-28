import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '../common/enums/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: false })
  password: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  phoneNumber: string;

  @Prop()
  avatar: string;

  @Prop()
  bio: string;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date;

  @Prop({ required: false })
  googleId: string;

  @Prop({ required: false })
  googleEmail: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
