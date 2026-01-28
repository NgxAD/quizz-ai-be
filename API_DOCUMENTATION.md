# Quiz Application API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Các endpoint (trừ auth) yêu cầu JWT token trong header:
```
Authorization: Bearer {token}
```

---

## 1. Authentication API

### 1.1 Đăng Ký
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "Nguyễn Văn A",
  "phoneNumber": "0123456789"
}
```

**Response (201):**
```json
{
  "message": "Đăng ký thành công",
  "user": {
    "_id": "65abc123...",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "role": "student",
    "isActive": true,
    "phoneNumber": "0123456789"
  }
}
```

### 1.2 Đăng Nhập
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Đăng nhập thành công",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "65abc123...",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "role": "student"
  }
}
```

---

## 2. Users API

### 2.1 Danh Sách Người Dùng
```http
GET /users?role=student
Authorization: Bearer {token}
```

**Params:** 
- `role` (optional): admin | teacher | student

**Response (200):**
```json
[
  {
    "_id": "65abc123...",
    "email": "student@example.com",
    "fullName": "Học Sinh A",
    "role": "student",
    "isActive": true
  }
]
```

### 2.2 Thống Kê Người Dùng (Admin only)
```http
GET /users/stats
Authorization: Bearer {admin_token}
```

**Response (200):**
```json
{
  "totalUsers": 50,
  "adminCount": 2,
  "teacherCount": 5,
  "studentCount": 43,
  "activeUsers": 48
}
```

### 2.3 Chi Tiết Người Dùng
```http
GET /users/:id
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "_id": "65abc123...",
  "email": "student@example.com",
  "fullName": "Học Sinh A",
  "role": "student",
  "phoneNumber": "0123456789",
  "avatar": "https://...",
  "bio": "Sinh viên năm 2",
  "isActive": true,
  "lastLoginAt": "2025-01-22T10:30:00Z"
}
```

### 2.4 Cập Nhật Thông Tin Người Dùng
```http
PUT /users/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "fullName": "Nguyễn Văn B",
  "phoneNumber": "0987654321",
  "avatar": "https://...",
  "bio": "Sinh viên giỏi"
}
```

**Response (200):** Updated user object

### 2.5 Đổi Mật Khẩu
```http
PUT /users/:id/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "oldPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

**Response (200):**
```json
{
  "message": "Đổi mật khẩu thành công"
}
```

### 2.6 Kích Hoạt/Vô Hiệu Hóa Tài Khoản (Admin only)
```http
PUT /users/:id/toggle-status
Authorization: Bearer {admin_token}
```

**Response (200):** Updated user object

### 2.7 Thay Đổi Vai Trò (Admin only)
```http
PUT /users/:id/role
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "role": "teacher"
}
```

**Response (200):** Updated user object

### 2.8 Xóa Người Dùng (Admin only)
```http
DELETE /users/:id
Authorization: Bearer {admin_token}
```

**Response (200):**
```json
{
  "message": "Xóa người dùng thành công"
}
```

---

## 3. Quizzes API

### 3.1 Tạo Bài Thi (Teacher/Admin)
```http
POST /quizzes
Authorization: Bearer {teacher_token}
Content-Type: application/json

{
  "title": "Bài Thi Toán 10 - Chương 1",
  "description": "Kiểm tra kiến thức về hàm số",
  "duration": 45,
  "isRandom": true,
  "passingPercentage": 70,
  "startDate": "2025-02-01T08:00:00Z",
  "endDate": "2025-02-01T09:00:00Z"
}
```

**Response (201):**
```json
{
  "_id": "65xyz789...",
  "title": "Bài Thi Toán 10 - Chương 1",
  "description": "Kiểm tra kiến thức về hàm số",
  "createdBy": { "_id": "...", "fullName": "Thầy A" },
  "duration": 45,
  "totalQuestions": 0,
  "isPublished": false,
  "isRandom": true,
  "passingPercentage": 70,
  "questions": [],
  "totalAttempts": 0
}
```

### 3.2 Danh Sách Bài Thi
```http
GET /quizzes
Authorization: Bearer {token}
```

**Response (200):** Array of quiz objects

### 3.3 Chi Tiết Bài Thi
```http
GET /quizzes/:quizId
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "_id": "65xyz789...",
  "title": "Bài Thi Toán 10 - Chương 1",
  "description": "Kiểm tra kiến thức về hàm số",
  "duration": 45,
  "totalQuestions": 20,
  "isPublished": true,
  "questions": [
    {
      "_id": "...",
      "content": "Câu hỏi 1?",
      "type": "multiple_choice",
      "options": [...],
      "points": 1
    }
  ]
}
```

### 3.4 Cập Nhật Bài Thi (Teacher/Admin)
```http
PUT /quizzes/:quizId
Authorization: Bearer {teacher_token}
Content-Type: application/json

{
  "title": "Bài Thi Toán 10 - Chương 1 (Updated)",
  "duration": 50,
  "passingPercentage": 75
}
```

**Response (200):** Updated quiz object

### 3.5 Công Bố Bài Thi (Teacher/Admin)
```http
POST /quizzes/:quizId/publish
Authorization: Bearer {teacher_token}
```

**Response (200):**
```json
{
  "message": "Bài thi đã được công bố",
  "quiz": { ...quiz_data, "isPublished": true }
}
```

### 3.6 Thống Kê Bài Thi (Teacher/Admin)
```http
GET /quizzes/:quizId/stats
Authorization: Bearer {teacher_token}
```

**Response (200):**
```json
{
  "quizId": "65xyz789...",
  "title": "Bài Thi Toán 10 - Chương 1",
  "totalQuestions": 20,
  "totalAttempts": 15,
  "isPublished": true,
  "duration": 45,
  "passingPercentage": 70
}
```

### 3.7 Xóa Bài Thi (Teacher/Admin)
```http
DELETE /quizzes/:quizId
Authorization: Bearer {teacher_token}
```

**Response (200):**
```json
{
  "message": "Xóa bài thi thành công"
}
```

---

## 4. Questions API

### 4.1 Tạo Câu Hỏi (Teacher/Admin)
```http
POST /questions
Authorization: Bearer {teacher_token}
Content-Type: application/json

{
  "content": "2 + 2 = ?",
  "type": "multiple_choice",
  "quizId": "65xyz789...",
  "options": [
    { "text": "3", "isCorrect": false },
    { "text": "4", "isCorrect": true },
    { "text": "5", "isCorrect": false },
    { "text": "6", "isCorrect": false }
  ],
  "points": 1,
  "explanation": "2 + 2 = 4 vì...",
  "order": 1
}
```

**Response (201):** Created question object

### 4.2 Danh Sách Câu Hỏi Của Bài Thi
```http
GET /questions/quiz/:quizId
Authorization: Bearer {token}
```

**Response (200):** Array of questions

### 4.3 Chi Tiết Câu Hỏi
```http
GET /questions/:questionId
Authorization: Bearer {token}
```

**Response (200):** Question object with all details

### 4.4 Cập Nhật Câu Hỏi (Teacher/Admin)
```http
PUT /questions/:questionId
Authorization: Bearer {teacher_token}
Content-Type: application/json

{
  "content": "2 + 3 = ?",
  "options": [
    { "text": "4", "isCorrect": false },
    { "text": "5", "isCorrect": true }
  ]
}
```

**Response (200):** Updated question object

### 4.5 Sinh Câu Hỏi AI (Teacher/Admin)
```http
POST /ai/generate-questions
Authorization: Bearer {teacher_token}
Content-Type: application/json

{
  "quizId": "65xyz789...",
  "topic": "Phương trình bậc 2",
  "numberOfQuestions": 10,
  "difficulty": "medium",
  "language": "vi"
}
```

**Difficulty:** easy | medium | hard

**Response (201):**
```json
{
  "success": true,
  "message": "Đã sinh 10 câu hỏi thành công",
  "count": 10,
  "quizId": "65xyz789...",
  "status": "pending_review",
  "questions": [
    {
      "_id": "question_id",
      "content": "Nội dung câu hỏi...",
      "type": "multiple_choice",
      "level": "medium",
      "explanation": "Giải thích chi tiết...",
      "isActive": false
    }
  ]
}
```

**Notes:**
- Câu hỏi được sinh từ AI sẽ có `isActive: false`
- Giáo viên cần duyệt trước khi sử dụng
- Hỗ trợ Mock Data nếu không có OpenAI API Key

### 4.6 Xem Trước Câu Hỏi AI (Teacher/Admin)
```http
POST /ai/preview-questions
Authorization: Bearer {teacher_token}
Content-Type: application/json

{
  "topic": "Phương trình bậc 2",
  "numberOfQuestions": 5,
  "difficulty": "medium"
}
```

**Response (200):** Giống như generate-questions nhưng không lưu vào DB

### 4.7 Validate Nội Dung Sinh Đề (Teacher/Admin)
```http
POST /ai/validate-content
Authorization: Bearer {teacher_token}
Content-Type: application/json

{
  "topic": "Phương trình bậc 2",
  "numberOfQuestions": 10,
  "difficulty": "medium"
}
```

**Response (200):**
```json
{
  "valid": true,
  "message": "Nội dung hợp lệ"
}
```

---

### 4.8 Sắp Xếp Lại Thứ Tự Câu Hỏi (Teacher/Admin)
```http
PUT /questions/quiz/:quizId/reorder
Authorization: Bearer {teacher_token}
Content-Type: application/json

{
  "questionOrder": [
    { "id": "q1_id", "order": 1 },
    { "id": "q2_id", "order": 2 },
    { "id": "q3_id", "order": 3 }
  ]
}
```

**Response (200):** Reordered questions array

### 4.9 Xóa Câu Hỏi (Teacher/Admin)
```http
DELETE /questions/:questionId
Authorization: Bearer {teacher_token}
```

**Response (200):**
```json
{
  "message": "Xóa câu hỏi thành công"
}
```

---

## 5. Results API

### 5.1 Bắt Đầu Làm Bài Thi
```http
POST /results/start/:quizId
Authorization: Bearer {token}
```

**Response (201):**
```json
{
  "_id": "submission_id",
  "quizId": "65xyz789...",
  "userId": "user_id",
  "startedAt": "2025-01-22T10:00:00Z",
  "answers": [],
  "isSubmitted": false
}
```

### 5.2 Lưu Đáp Án Tạm Thời
```http
POST /results/:submissionId/save
Authorization: Bearer {token}
Content-Type: application/json

{
  "answers": [
    {
      "questionId": "q1_id",
      "answer": "B"
    },
    {
      "questionId": "q2_id",
      "answer": ["A", "C"]
    }
  ]
}
```

**Response (200):** Updated submission object

### 5.3 Nộp Bài Thi
```http
POST /results/:submissionId/submit
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "message": "Nộp bài thành công",
  "submission": {
    "_id": "submission_id",
    "quizId": "65xyz789...",
    "userId": "user_id",
    "totalPoints": 20,
    "score": 85,
    "isSubmitted": true,
    "duration": 1820,
    "submittedAt": "2025-01-22T10:30:20Z"
  },
  "result": {
    "_id": "result_id",
    "quizId": "65xyz789...",
    "userId": "user_id",
    "totalPoints": 20,
    "correctAnswers": 17,
    "wrongAnswers": 3,
    "score": 85,
    "isPassed": true,
    "completedAt": "2025-01-22T10:30:20Z"
  }
}
```

### 5.4 Kết Quả của Người Dùng Hiện Tại
```http
GET /results/user
Authorization: Bearer {token}
```

**Response (200):** Array of result objects

### 5.5 Kết Quả của Bài Thi (Teacher/Admin)
```http
GET /results/quiz/:quizId
Authorization: Bearer {teacher_token}
```

**Response (200):** Array of results for the quiz

### 5.6 Thống Kê Bài Thi (Teacher/Admin)
```http
GET /results/quiz/:quizId/statistics
Authorization: Bearer {teacher_token}
```

**Response (200):**
```json
{
  "quizId": "65xyz789...",
  "totalAttempts": 15,
  "averageScore": 78.5,
  "passRate": 86.7,
  "minScore": 55,
  "maxScore": 100
}
```

### 5.7 Bảng Xếp Hạng
```http
GET /results/quiz/:quizId/leaderboard?limit=10
Authorization: Bearer {token}
```

**Response (200):**
```json
[
  {
    "_id": "result_id",
    "userId": { "_id": "...", "fullName": "Nguyễn Văn A" },
    "quizId": "65xyz789...",
    "score": 100,
    "isPassed": true,
    "completedAt": "2025-01-22T10:30:00Z"
  }
]
```

### 5.8 Chi Tiết Kết Quả
```http
GET /results/:resultId
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "_id": "result_id",
  "quizId": { ...quiz_data },
  "userId": { ...user_data },
  "submissionId": { ...submission_data },
  "totalPoints": 20,
  "correctAnswers": 17,
  "wrongAnswers": 3,
  "score": 85,
  "isPassed": true,
  "completedAt": "2025-01-22T10:30:20Z"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Email đã được sử dụng",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Email hoặc mật khẩu không đúng",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Bạn không có quyền truy cập resource này",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Bài thi không tồn tại",
  "error": "Not Found"
}
```

### 422 Unprocessable Entity
```json
{
  "statusCode": 422,
  "message": [
    "email must be an email",
    "password should not be empty"
  ],
  "error": "Unprocessable Entity"
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

---

## Roles & Permissions

| Endpoint | Admin | Teacher | Student |
|----------|-------|---------|---------|
| POST /auth/register | ✓ | ✓ | ✓ |
| POST /auth/login | ✓ | ✓ | ✓ |
| GET /users | ✓ | ✓ | ✗ |
| GET /users/:id | ✓ | ✓ | ✓ |
| PUT /users/:id | ✓ | ✓ | ✓ |
| DELETE /users/:id | ✓ | ✗ | ✗ |
| POST /quizzes | ✓ | ✓ | ✗ |
| GET /quizzes | ✓ | ✓ | ✓ |
| PUT /quizzes/:id | ✓ | ✓* | ✗ |
| DELETE /quizzes/:id | ✓ | ✓* | ✗ |
| POST /questions | ✓ | ✓ | ✗ |
| PUT /questions/:id | ✓ | ✓* | ✗ |
| POST /questions/generate | ✓ | ✓ | ✗ |
| POST /results/start/:id | ✓ | ✓ | ✓ |
| POST /results/:id/submit | ✓ | ✓ | ✓ |
| GET /results/quiz/:id | ✓ | ✓* | ✗ |

\* Only if creator
