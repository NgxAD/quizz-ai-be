# Quiz Application - Backend

Ứng dụng backend cho hệ thống thi trắc nghiệm với AI sinh đề tự động. Xây dựng với NestJS, MongoDB, và JWT.

## Tính Năng

### 🔐 Xác Thực & Phân Quyền
- Đăng ký và đăng nhập với JWT
- 3 loại người dùng: Admin, Giáo viên (Teacher), Học sinh (Student)
- Role-based access control (RBAC)

### 📝 Quản Lý Bài Thi
- CRUD bài thi (Quiz)
- Tạo và quản lý câu hỏi
- Sắp xếp lại thứ tự câu hỏi
- Công bố bài thi
- Thống kê bài thi

### 🤖 AI Sinh Đề Tự Động
- Sinh câu hỏi trắc nghiệm tự động
- Hỗ trợ nhiều loại câu hỏi (multiple choice, true/false, short answer)
- Điều chỉnh độ khó (easy, medium, hard)
- Tích hợp OpenAI/LangChain (có thể cấu hình)

### 📊 Quản Lý Bài Nộp & Kết Quả
- Bắt đầu làm bài thi
- Lưu đáp án tạm thời
- Nộp bài và tính điểm tự động
- Xem kết quả chi tiết
- Thống kê bài thi (điểm trung bình, tỷ lệ đạt, v.v.)
- Bảng xếp hạng (leaderboard)

### 👥 Quản Lý Người Dùng
- CRUD người dùng
- Lọc theo vai trò
- Thay đổi mật khẩu
- Kích hoạt/vô hiệu hóa tài khoản
- Thống kê người dùng

## Cài Đặt

### Yêu Cầu
- Node.js 18+
- MongoDB 5+
- npm hoặc yarn

### Bước 1: Cài Đặt Dependencies

\`\`\`bash
npm install
\`\`\`

### Bước 2: Cấu Hình Environment

Tạo file \`.env\` từ \`.env.example\`:

\`\`\`bash
MONGODB_URI=mongodb://localhost:27017/quizz
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRE=24h
PORT=3000
AI_API_KEY=your-openai-api-key (optional for demo)
AI_MODEL=gpt-4-turbo
FRONTEND_URL=http://localhost:3001
\`\`\`

### Bước 3: Khởi Động Ứng Dụng

**Development:**
\`\`\`bash
npm run start:dev
\`\`\`

**Production:**
\`\`\`bash
npm run build
npm run start:prod
\`\`\`

## API Endpoints

### Authentication (không cần JWT)
- \`POST /api/auth/register\` - Đăng ký tài khoản mới
- \`POST /api/auth/login\` - Đăng nhập

### Users (cần JWT + quyền phù hợp)
- \`GET /api/users\` - Danh sách người dùng (Admin, Teacher)
- \`GET /api/users/stats\` - Thống kê người dùng (Admin)
- \`GET /api/users/:id\` - Chi tiết người dùng
- \`PUT /api/users/:id\` - Cập nhật thông tin
- \`PUT /api/users/:id/change-password\` - Đổi mật khẩu
- \`PUT /api/users/:id/toggle-status\` - Kích hoạt/vô hiệu hóa (Admin)
- \`PUT /api/users/:id/role\` - Thay đổi vai trò (Admin)
- \`DELETE /api/users/:id\` - Xóa người dùng (Admin)

### Quizzes (cần JWT)
- \`POST /api/quizzes\` - Tạo bài thi (Teacher, Admin)
- \`GET /api/quizzes\` - Danh sách bài thi
- \`GET /api/quizzes/:id\` - Chi tiết bài thi
- \`PUT /api/quizzes/:id\` - Cập nhật bài thi (Teacher, Admin)
- \`DELETE /api/quizzes/:id\` - Xóa bài thi (Teacher, Admin)
- \`POST /api/quizzes/:id/publish\` - Công bố bài thi (Teacher, Admin)
- \`GET /api/quizzes/:id/stats\` - Thống kê bài thi (Teacher, Admin)

### Questions (cần JWT)
- \`POST /api/questions\` - Tạo câu hỏi (Teacher, Admin)
- \`GET /api/questions/quiz/:quizId\` - Câu hỏi của bài thi
- \`GET /api/questions/:id\` - Chi tiết câu hỏi
- \`PUT /api/questions/:id\` - Cập nhật câu hỏi (Teacher, Admin)
- \`DELETE /api/questions/:id\` - Xóa câu hỏi (Teacher, Admin)
- \`POST /api/questions/generate\` - Sinh đề AI (Teacher, Admin)
- \`PUT /api/questions/quiz/:quizId/reorder\` - Sắp xếp lại thứ tự

### Results (cần JWT)
- \`POST /api/results/start/:quizId\` - Bắt đầu làm bài thi
- \`POST /api/results/:submissionId/save\` - Lưu đáp án tạm thời
- \`POST /api/results/:submissionId/submit\` - Nộp bài thi
- \`GET /api/results/user\` - Kết quả của người dùng hiện tại
- \`GET /api/results/quiz/:quizId\` - Kết quả của một bài thi (Teacher, Admin)
- \`GET /api/results/quiz/:quizId/statistics\` - Thống kê bài thi (Teacher, Admin)
- \`GET /api/results/quiz/:quizId/leaderboard\` - Bảng xếp hạng
- \`GET /api/results/:resultId\` - Chi tiết kết quả

## Cấu Trúc Dự Án

\`\`\`
src/
├── common/
│   ├── decorators/        # Custom decorators (Roles, GetUser)
│   ├── enums/            # Enums (UserRole, QuestionType)
│   └── guards/           # Guards (JwtAuthGuard, RolesGuard)
├── modules/
│   ├── auth/             # Authentication module
│   ├── users/            # Users management
│   ├── quiz/             # Quiz management
│   ├── questions/        # Questions management
│   ├── ai/               # AI question generation
│   └── results/          # Results & submissions
├── schemas/              # MongoDB schemas
├── app.module.ts         # Root module
└── main.ts              # Application entry point
\`\`\`

## Models/Schemas

### User
- email (unique)
- password (hashed)
- fullName
- role (admin, teacher, student)
- isActive
- phoneNumber
- avatar
- bio
- lastLoginAt

### Quiz
- title
- description
- createdBy (Teacher/Admin)
- totalQuestions
- duration (phút)
- isPublished
- isRandom (shuffle questions)
- passingPercentage
- questions (array of question IDs)
- allowedUsers (empty = all)
- startDate, endDate
- totalAttempts

### Question
- content
- type (multiple_choice, true_false, short_answer)
- quizId
- createdBy
- options (with isCorrect flag)
- correctAnswer
- points
- explanation
- order
- isActive

### Submission
- quizId
- userId
- answers (array of answers)
- totalPoints
- score (percentage)
- isSubmitted
- duration (giây)
- submittedAt, startedAt

### Result
- quizId
- userId
- submissionId
- totalPoints
- correctAnswers
- wrongAnswers
- skipped
- score (percentage)
- isPassed
- completedAt

## Testing

### Unit Tests
\`\`\`bash
npm run test
\`\`\`

### E2E Tests
\`\`\`bash
npm run test:e2e
\`\`\`

### Test Coverage
\`\`\`bash
npm run test:cov
\`\`\`

## Linting & Formatting

\`\`\`bash
# Lint code
npm run lint

# Format code
npm run format
\`\`\`

## AI Question Generation

### Cấu Hình OpenAI (Optional)

1. Lấy API key từ https://platform.openai.com/api-keys
2. Thêm vào \`.env\`:
\`\`\`
AI_API_KEY=sk-...
AI_MODEL=gpt-4-turbo
\`\`\`

### Cách Sử Dụng
\`\`\`bash
POST /api/questions/generate
Content-Type: application/json
Authorization: Bearer {token}

{
  "quizId": "65abc123def456...",
  "topic": "Lịch sử Việt Nam",
  "numberOfQuestions": 10,
  "difficulty": "medium",
  "language": "vi"
}
\`\`\`

## Ví Dụ Workflow

### 1. Giáo viên Tạo Bài Thi
\`\`\`bash
# Đăng nhập
POST /api/auth/login
{
  "email": "teacher@example.com",
  "password": "password"
}

# Tạo bài thi
POST /api/quizzes
{
  "title": "Bài thi Toán 10",
  "description": "Kiểm tra chương 1",
  "duration": 45,
  "passingPercentage": 70
}

# Sinh câu hỏi AI
POST /api/questions/generate
{
  "quizId": "{quiz_id}",
  "topic": "Phương trình bậc 2",
  "numberOfQuestions": 20,
  "difficulty": "medium",
  "language": "vi"
}

# Công bố bài thi
POST /api/quizzes/{quiz_id}/publish
\`\`\`

### 2. Học sinh Làm Bài Thi
\`\`\`bash
# Đăng nhập
POST /api/auth/login
{
  "email": "student@example.com",
  "password": "password"
}

# Bắt đầu bài thi
POST /api/results/start/{quiz_id}

# Lưu đáp án tạm thời
POST /api/results/{submission_id}/save
{
  "answers": [
    {
      "questionId": "...",
      "answer": "A"
    }
  ]
}

# Nộp bài
POST /api/results/{submission_id}/submit

# Xem kết quả
GET /api/results/{result_id}
\`\`\`

## Troubleshooting

### MongoDB Connection Error
- Kiểm tra MongoDB đang chạy: \`mongosh\`
- Kiểm tra MONGODB_URI trong .env

### JWT Errors
- Đảm bảo JWT_SECRET được đặt trong .env
- Kiểm tra token format: \`Authorization: Bearer {token}\`

### AI Generation Fails
- Demo mode không cần API key
- Để sử dụng OpenAI thật, cấu hình AI_API_KEY trong .env

## Bảo Mật

- Mật khẩu được hash bằng bcryptjs (10 salt rounds)
- JWT tokens có thời hạn 24 giờ (có thể cấu hình)
- RBAC bảo vệ các endpoint nhạy cảm
- Input validation với class-validator
- CORS được cấu hình

## License

UNLICENSED
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
