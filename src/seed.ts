import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import { Question, QuestionDocument } from './schemas/question.schema';
import { UserRole } from './common/enums/role.enum';
import { QuestionType } from './common/enums/question-type.enum';

async function seed() {
  const app = await NestFactory.create(AppModule);
  const userModel = app.get(getModelToken(User.name));
  const quizModel = app.get(getModelToken(Quiz.name));
  const questionModel = app.get(getModelToken(Question.name));

  try {
    console.log('Clearing existing data...');
    await userModel.deleteMany({});
    await quizModel.deleteMany({});
    await questionModel.deleteMany({});

    console.log('\n✅ Database cleared successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await app.close();
  }
}

function getModelToken(modelName: string): string {
  return `${modelName}Model`;
}

seed();
