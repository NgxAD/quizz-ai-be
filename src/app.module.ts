import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { ExamsModule } from './modules/exams/exams.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { ResultsModule } from './modules/results/results.module';
import { AiModule } from './modules/ai/ai.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { ClassesModule } from './modules/classes/classes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/quizz'),
    AuthModule,
    UsersModule,
    SubjectsModule,
    QuizModule,
    ExamsModule,
    QuestionsModule,
    SubmissionsModule,
    ResultsModule,
    AiModule,
    StatisticsModule,
    ClassesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
