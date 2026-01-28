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

    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await userModel.create({
      email: 'admin@example.com',
      password: adminPassword,
      fullName: 'Admin User',
      role: UserRole.ADMIN,
      phoneNumber: '0123456789',
    });

    console.log('Creating teacher users...');
    const teacherPassword = await bcrypt.hash('teacher123', 10);
    const teacher = await userModel.create({
      email: 'teacher@example.com',
      password: teacherPassword,
      fullName: 'Thầy Nguyễn Văn A',
      role: UserRole.TEACHER,
      phoneNumber: '0987654321',
    });

    console.log('Creating student users...');
    const studentPassword = await bcrypt.hash('student123', 10);
    const student1 = await userModel.create({
      email: 'student1@example.com',
      password: studentPassword,
      fullName: 'Nguyễn Văn B',
      role: UserRole.STUDENT,
      phoneNumber: '0987654322',
    });

    const student2 = await userModel.create({
      email: 'student2@example.com',
      password: studentPassword,
      fullName: 'Trần Thị C',
      role: UserRole.STUDENT,
      phoneNumber: '0987654323',
    });

    console.log('Creating quiz...');
    const quiz = await quizModel.create({
      title: 'Bài Thi Toán 10 - Chương 1: Hàm Số',
      description: 'Bài kiểm tra kiến thức về hàm số bậc nhất và bậc hai',
      createdBy: teacher._id,
      duration: 45,
      passingPercentage: 70,
      isPublished: true,
      totalQuestions: 0,
    });

    console.log('Creating questions...');
    const questions = [
      {
        content: 'Hàm số y = 2x + 3 là hàm số gì?',
        type: QuestionType.MULTIPLE_CHOICE,
        quizId: quiz._id,
        createdBy: teacher._id,
        options: [
          { text: 'Hàm số bậc nhất', isCorrect: true },
          { text: 'Hàm số bậc hai', isCorrect: false },
          { text: 'Hàm số lũy thừa', isCorrect: false },
          { text: 'Hàm số mũ', isCorrect: false },
        ],
        points: 1,
        explanation: 'Hàm số có dạng y = ax + b (a ≠ 0) là hàm số bậc nhất.',
        order: 1,
      },
      {
        content: 'Hàm số y = x² + 2x + 1 có đỉnh tại điểm nào?',
        type: QuestionType.MULTIPLE_CHOICE,
        quizId: quiz._id,
        createdBy: teacher._id,
        options: [
          { text: '(-1, 0)', isCorrect: true },
          { text: '(1, 4)', isCorrect: false },
          { text: '(0, 1)', isCorrect: false },
          { text: '(-2, -3)', isCorrect: false },
        ],
        points: 2,
        explanation: 'Với hàm số y = x² + 2x + 1 = (x+1)², đỉnh tại (-1, 0).',
        order: 2,
      },
      {
        content: 'Hàm số y = -x² + 4x - 4 có giá trị cực đại là 0.',
        type: QuestionType.TRUE_FALSE,
        quizId: quiz._id,
        createdBy: teacher._id,
        options: [
          { text: 'Đúng', isCorrect: true },
          { text: 'Sai', isCorrect: false },
        ],
        points: 1,
        explanation: 'Hàm số y = -(x-2)² + 0, giá trị cực đại là 0 tại x = 2.',
        order: 3,
      },
      {
        content: 'Tìm tập xác định của hàm số y = 1/(x-1)',
        type: QuestionType.MULTIPLE_CHOICE,
        quizId: quiz._id,
        createdBy: teacher._id,
        options: [
          { text: 'R \\ {1}', isCorrect: true },
          { text: 'R', isCorrect: false },
          { text: '[1, +∞)', isCorrect: false },
          { text: '(-∞, 1)', isCorrect: false },
        ],
        points: 1,
        explanation: 'Tập xác định là tất cả các số thực trừ x = 1 (mẫu ≠ 0).',
        order: 4,
      },
      {
        content: 'Hàm số y = √(x-2) xác định khi x ≥ 2.',
        type: QuestionType.TRUE_FALSE,
        quizId: quiz._id,
        createdBy: teacher._id,
        options: [
          { text: 'Đúng', isCorrect: true },
          { text: 'Sai', isCorrect: false },
        ],
        points: 1,
        explanation: 'Biểu thức dưới căn phải không âm: x - 2 ≥ 0 ⟹ x ≥ 2.',
        order: 5,
      },
    ];

    const createdQuestions = await questionModel.insertMany(questions);
    quiz.questions = createdQuestions.map((q) => q._id);
    quiz.totalQuestions = createdQuestions.length;
    await quiz.save();

    console.log('\n✅ Seed data created successfully!');
    console.log('\nTest Accounts:');
    console.log('Admin: admin@example.com / admin123');
    console.log('Teacher: teacher@example.com / teacher123');
    console.log('Student: student1@example.com / student123');
    console.log('Student: student2@example.com / student123');
    console.log('\nQuiz Created: "' + quiz.title + '" with ' + quiz.totalQuestions + ' questions');
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
