import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Question, QuestionDocument } from '../../schemas/question.schema';
import { Quiz, QuizDocument } from '../../schemas/quiz.schema';
import { GenerateQuestionsDto } from '../questions/dtos/generate-questions.dto';
import { QuestionType } from '../../common/enums/question-type.enum';

interface AIQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  correctAnswer?: string;
  explanation?: string;
  level?: 'easy' | 'medium' | 'hard';
}


@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly groqApiKey: string;

  constructor(
    private configService: ConfigService,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
  ) {
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    this.logger.log(`[AI] Using Groq API`);
  }

  /**
   * Sinh câu hỏi bằng AI
   * Dùng prompt tùy chỉnh từ user
   * Tự động tạo quiz
   */
  async generateQuestions(
    generateQuestionsDto: GenerateQuestionsDto,
    userId: string,
  ): Promise<any> {
    const { customPrompt, language = 'vi' } = generateQuestionsDto;

    this.logger.log(`[AI] Generating questions from custom prompt: ${customPrompt.substring(0, 50)}...`);

    try {
      // 1. Validate prompt
      if (!customPrompt || customPrompt.trim().length === 0) {
        throw new BadRequestException('Vui lòng nhập prompt để tạo đề thi');
      }

      // 2. Tạo quiz mới tự động với tên mặc định
      const timestamp = new Date().toLocaleString('vi-VN');
      const newQuiz = await this.quizModel.create({
        title: `Đề thi (${timestamp})`,
        description: `Đề thi được tạo bằng AI`,
        createdBy: userId,
        questions: [],
        isPublished: false, // Chưa publish vì chưa lưu câu hỏi
      });
      const finalQuizId = newQuiz._id.toString();
      this.logger.log(`[AI] Created new quiz (draft): ${finalQuizId}`);

      // 3. Gửi prompt cho AI và nhận kết quả
      const aiQuestions = await this.generateAiQuestions(
        customPrompt,
        language,
      );

      this.logger.log(`[AI] Received ${aiQuestions.length} questions from AI`);

      // 4. Validate dữ liệu từ AI
      const validatedQuestions = this.validateAiQuestions(aiQuestions);

      // 5. Validate topic relevance - ensure questions match requested topic
      const topicRelevanceScore = this.validateTopicRelevance(validatedQuestions, customPrompt);
      this.logger.log(`[AI] Topic relevance score: ${topicRelevanceScore}%`);
      
      if (topicRelevanceScore < 50) {
        this.logger.warn(`[AI] Topic relevance LOW (${topicRelevanceScore}%). Some questions may not match the requested topic.`);
      }

      // 6. Return questions WITHOUT saving to DB yet
      // User will review and click "Save" button before actually saving
      return {
        success: true,
        message: `Đã sinh ${validatedQuestions.length} câu hỏi thành công. Vui lòng xem trước và nhấn "Lưu" để lưu vào hệ thống.`,
        count: validatedQuestions.length,
        quizId: finalQuizId,
        quizTitle: `Đề thi (${new Date().toLocaleString('vi-VN')})`,
        questions: validatedQuestions.map((q, idx) => ({
          content: q.question,
          type: q.type,
          level: q.level,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
        status: 'draft', // Chưa lưu vào DB
      };
    } catch (error) {
      this.logger.error(`[AI] Failed to generate questions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save generated questions to database
   * Called when user clicks "Save" button in frontend
   */
  async saveGeneratedQuestions(
    quizId: string,
    questions: any[],
    userId: string,
  ): Promise<any> {
    this.logger.log(`[AI] Saving ${questions.length} questions to quiz ${quizId}`);

    try {
      const savedQuestions: any[] = [];
      const questionIds: any[] = [];
      
      for (let i = 0; i < questions.length; i++) {
        // Handle both 'content' (from frontend) and 'question' (internal) field names
        const questionContent = questions[i].content || questions[i].question;
        
        const questionData = {
          content: questionContent,
          type: questions[i].type,
          options: questions[i].options,
          correctAnswer: questions[i].correctAnswer,
          explanation: questions[i].explanation,
          level: questions[i].level || 'medium',
          quizId: quizId,
          createdBy: userId,
          points: this.getPointsByDifficulty(questions[i].level || 'medium'),
          order: i,
          isActive: false,
        };

        const savedQuestion = await this.questionModel.create(questionData);
        savedQuestions.push(savedQuestion);
        questionIds.push(savedQuestion._id);
        this.logger.log(`[AI] Saved question ${i + 1}/${questions.length}: ${savedQuestion._id}`);
      }

      // Update quiz: add question IDs and publish
      await this.quizModel.findByIdAndUpdate(
        quizId,
        {
          questions: questionIds,
          isPublished: true, // Publish quiz khi đã có câu hỏi
        },
        { new: true }
      );
      this.logger.log(`[AI] Published quiz ${quizId} with ${questionIds.length} questions`);

      return {
        success: true,
        message: `Đã lưu ${savedQuestions.length} câu hỏi thành công`,
        count: savedQuestions.length,
        quizId: quizId,
        questions: savedQuestions.map((q) => ({
          _id: q._id,
          content: q.content,
          type: q.type,
          level: q.level,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          isActive: q.isActive,
        })),
        status: 'saved',
      };
    } catch (error) {
      this.logger.error(`[AI] Failed to save questions: ${error.message}`);
      throw error;
    }
  }

  validateContent(topic: string, numberOfQuestions: number, difficulty: string): boolean {
    if (!topic || topic.trim().length === 0) {
      throw new BadRequestException('Vui lòng cung cấp chủ đề');
    }

    if (!numberOfQuestions || numberOfQuestions < 1 || numberOfQuestions > 50) {
      throw new BadRequestException('Số câu hỏi phải từ 1 đến 50');
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new BadRequestException('Độ khó phải là: easy, medium hoặc hard');
    }

    return true;
  }

  private async generateAiQuestions(
    customPrompt: string,
    language: string,
  ): Promise<AIQuestion[]> {
    if (!this.groqApiKey) {
      this.logger.error('[AI] GROQ_API_KEY not configured');
      throw new Error('AI service unavailable - API key not configured');
    }

    try {
      return await this.callGroq(customPrompt, language);
    } catch (error: any) {
      this.logger.error(`[AI] Groq API failed: ${error.message}`);
      throw new Error('AI service unavailable - ' + error.message);
    }
  }

  private generateMockQuestions(
    topic: string,
    numberOfQuestions: number,
    difficulty: 'easy' | 'medium' | 'hard',
    language: string,
  ): AIQuestion[] {
    const questions: AIQuestion[] = [];

    for (let i = 1; i <= numberOfQuestions; i++) {
      questions.push({
        question: `Trong chủ đề "${topic}", điều nào sau đây là đúng? (Câu ${i})`,
        type: 'multiple_choice',
        level: difficulty,
        options: [
          { text: `A. ${topic} có liên quan đến khái niệm cơ bản`, isCorrect: true },
          { text: `B. ${topic} hoàn toàn không liên quan đến lĩnh vực khác`, isCorrect: false },
          {
            text: `C. ${topic} là một phần của lĩnh vực khác hoàn toàn`,
            isCorrect: false,
          },
          {
            text: `D. ${topic} chỉ áp dụng cho tình huống đặc biệt duy nhất`,
            isCorrect: false,
          },
        ],
        explanation: `Câu này kiểm tra hiểu biết cơ bản về ${topic}. Đáp án A là chính xác vì nó phản ánh định nghĩa và ứng dụng cốt lõi của ${topic}.`,
      });
    }

    return questions.slice(0, numberOfQuestions);
  }

  private async callGroq(
    customPrompt: string,
    language: string,
  ): Promise<AIQuestion[]> {
    try {
      // Extract number of questions from prompt (e.g., "20 câu", "tạo 15 câu", "20 questions")
      const numberOfQuestions = this.extractNumberOfQuestions(customPrompt);
      this.logger.log(`[AI] Extracted number of questions: ${numberOfQuestions}`);

      // STEP 1: AI tạo nội dung (text tự do, không JSON)
      this.logger.log(`[AI] STEP 1: Generating test content (${numberOfQuestions} questions)...`);
      const aiGeneratedText = await this.callGroqGenerateText(
        customPrompt,
        language,
        numberOfQuestions,
      );
      this.logger.log(`[AI] STEP 1 done. Generated text length: ${aiGeneratedText.length}`);

      // STEP 2: AI chuyển text thành JSON chuẩn
      this.logger.log(`[AI] STEP 2: Converting text to JSON...`);
      const questions = await this.callGroqConvertToJson(aiGeneratedText);
      this.logger.log(`[AI] STEP 2 done. Questions count: ${questions.length}`);

      return questions;
    } catch (error: any) {
      this.logger.error(`[AI] callGroq failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract number of questions from user prompt
   */
  private extractNumberOfQuestions(prompt: string): number {
    const patterns = [
      /(\d+)\s*(?:câu|questions?|q|qestions)/i, // "20 câu", "20 questions"
      /tạo\s*(\d+)/i, // "tạo 20"
      /create\s*(\d+)/i, // "create 20"
      /(\d+)\s*questions?/i, // "20 questions"
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        // Clamp between 1 and 50
        return Math.min(Math.max(num, 1), 50);
      }
    }

    // Default to 5 if no number found
    return 5;
  }

  /**
   * Parse topic requirement from user prompt
   * Extracts subject, grade level, and specific topics
   */
  private parseTopicRequirement(prompt: string): {
    subject?: string;
    grade?: string;
    topic?: string;
  } {
    const lowerPrompt = prompt.toLowerCase();
    let result: any = {};

    // Extract subject (Toán, Lý, Hóa, Anh, Sử, Địa, Sinh, etc.)
    const subjects = ['toán', 'lý', 'hóa', 'anh', 'sử', 'địa', 'sinh', 'công nghệ', 'tin học', 'thể dục', 'âm nhạc', 'mỹ thuật'];
    for (const subject of subjects) {
      if (lowerPrompt.includes(subject)) {
        result.subject = subject;
        break;
      }
    }

    // Extract grade level (lớp X, class X, grade X)
    const gradeMatch = prompt.match(/(?:lớp|class|grade)\s*(\d+)/i);
    if (gradeMatch) {
      result.grade = gradeMatch[1];
    }

    // Extract specific topic/chapter
    const chapterMatch = prompt.match(/(?:chương|chapter|bài|lesson)\s*(\d+)/i);
    if (chapterMatch) {
      result.topic = `chương ${chapterMatch[1]}`;
    }

    return result;
  }
  /**
   * STEP 1: Generate test content in free text format
   */
  private async callGroqGenerateText(
    customPrompt: string,
    language: string,
    numberOfQuestions: number,
  ): Promise<string> {
    try {
      // Parse the topic to extract key requirements
      const topicInfo = this.parseTopicRequirement(customPrompt);
      const topicEmphasis = `**LƯU Ý QUAN TRỌNG**: TẤT CẢ ${numberOfQuestions} câu hỏi phải liên quan TRỰC TIẾP đến: ${customPrompt}. KHÔNG ĐƯỢC tạo câu hỏi ngẫu nhiên hoặc không liên quan!`;

      const response = await axios.post(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: `Bạn là một giáo viên chuyên nghiệp. Nhiệm vụ của bạn là tạo một bài kiểm tra có **CHÍNH XÁC ${numberOfQuestions} CÂU HỎI HOÀN CHỈNH**.

${topicEmphasis}

Yêu cầu/Chủ đề: ${customPrompt}

YÊU CẦU TUYỆT ĐỐI (KHÔNG ĐƯỢC BỎ QUA):
1. Tạo CHÍNH XÁC ${numberOfQuestions} câu hỏi - KHÔNG phải 10, KHÔNG phải 15, CHÍNH XÁC ${numberOfQuestions}
2. **QUAN TRỌNG**: TẤT CẢ câu hỏi phải liên quan trực tiếp đến chủ đề "${customPrompt}" - KHÔNG được tạo câu hỏi về chủ đề khác
3. Mỗi câu HÃY CÓ số thứ tự: "Câu 1:", "Câu 2:", ... "Câu ${numberOfQuestions}:"
4. Mỗi câu HÃY CÓ đúng 4 phương án được đánh số: A), B), C), D)
5. THỂ HIỆN RÕ đáp án nào đúng: dùng "(ĐÚNG)" hoặc "✓" ở bên cạnh đáp án
6. Mỗi câu HÃY CÓ một lời giải thích chi tiết BẰNG TIẾNG VIỆT
7. Các câu hỏi phải khác nhau, đa dạng, nhưng TẤT CẢ đều về chủ đề: ${customPrompt}
8. CUỐI CÙNG: Viết "TỔNG CỘNG: ${numberOfQuestions} câu hỏi đã được tạo ✓"

Ví dụ định dạng:
Câu 1: [Câu hỏi về chủ đề "${customPrompt}"]?
A) [Lựa chọn 1]
B) [Lựa chọn 2] (ĐÚNG)
C) [Lựa chọn 3]
D) [Lựa chọn 4]
Lời giải: [Giải thích chi tiết liên quan đến "${customPrompt}"]

---

Bây giờ hãy tạo CHÍNH XÁC ${numberOfQuestions} câu hỏi, TẤT CẢ liên quan đến: "${customPrompt}":`,
            },
          ],
          temperature: 0.7,
          max_tokens: Math.max(4000, numberOfQuestions * 250),
        },
        {
          timeout: 90000,
          headers: {
            'Authorization': `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('Empty response from Groq API (step 1)');
      }

      const content = response.data.choices[0].message.content;
      this.logger.log(`[AI] Step 1: Generated content, length: ${content.length} chars`);
      
      // Count how many questions appear in the generated text
      const questionMatches = content.match(/Câu\s+\d+:|Question\s+\d+:/gi) || [];
      this.logger.log(`[AI] Step 1: Found ${questionMatches.length} question headers in response`);
      
      return content;
    } catch (error: any) {
      this.logger.error(`[AI] Step 1 (generate text) failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 2: Convert generated text to JSON format
   */
  private async callGroqConvertToJson(aiGeneratedText: string): Promise<AIQuestion[]> {
    const requestedCount = this.extractNumberOfQuestions(aiGeneratedText);
    
    try {
      this.logger.log(`[AI] Step 2: Converting ${requestedCount} questions to JSON format...`);
      
      // First, extract raw questions from text to validate we have them
      const rawQuestionCount = (aiGeneratedText.match(/Câu\s+\d+:|Question\s+\d+:/gi) || []).length;
      this.logger.log(`[AI] Step 2: Raw question count from text: ${rawQuestionCount}`);

      const response = await axios.post(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: `Bạn là một chuyên gia JSON. Chuyển đổi nội dung bài kiểm tra sau thành định dạng JSON hợp lệ.

TUYỆT ĐỐI: Bạn phải bao gồm TẤT CẢ câu hỏi từ input. Không được bỏ qua, gộp, hoặc loại bỏ bất kỳ câu nào.

Quy tắc định dạng:
- CHỈ xuất mảng JSON hợp lệ - không có markdown, không giải thích, không có text thừa
- Type phải là: "multiple_choice"
- Level phải là: "easy", "medium", hoặc "hard" (chữ thường)
- correctAnswer phải là một ký tự: "A", "B", "C", "D"
- Text tùy chọn phải bao gồm tiền tố chữ cái: "A. text", "B. text", v.v.
- Mỗi giá trị chuỗi phải là một dòng (dùng \\n cho ngắt dòng)
- isCorrect phải khớp với ký tự correctAnswer
- **QUAN TRỌNG: Giải thích (explanation) PHẢI bằng TIẾNG VIỆT**

Cấu trúc JSON bắt buộc cho MỖI câu:
{
  "question": "nội dung câu hỏi Vietnamese",
  "type": "multiple_choice",
  "level": "medium",
  "options": [
    { "text": "A. nội dung phương án A", "isCorrect": true },
    { "text": "B. nội dung phương án B", "isCorrect": false },
    { "text": "C. nội dung phương án C", "isCorrect": false },
    { "text": "D. nội dung phương án D", "isCorrect": false }
  ],
  "correctAnswer": "A",
  "explanation": "lời giải thích BẰNG TIẾNG VIỆT ở đây"
}

INPUT TEXT (bạn phải chuyển đổi TẤT CẢ ${rawQuestionCount} câu):
===================
${aiGeneratedText}
===================

OUTPUT: CHỈ trả về mảng JSON với ${rawQuestionCount} câu hỏi. Không có text thừa.`,
            },
          ],
          temperature: 0.2, // Low temperature for strict JSON format
          max_tokens: Math.max(6000, rawQuestionCount * 350),
        },
        {
          timeout: 90000,
          headers: {
            'Authorization': `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('Empty response from Groq API (step 2)');
      }

      const content = response.data.choices[0].message.content;
      this.logger.log(`[AI] Step 2: Raw response length: ${content.length} chars`);

      let jsonStr = content.trim();
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // CRITICAL FIX: Escape literal newlines INSIDE string values
      jsonStr = jsonStr.replace(/"([^"]*?(?:\r?\n[^"]*?)*)"/g, (match) => {
        return match.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      });
      
      // Fix common JSON escaping issues
      jsonStr = jsonStr.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u0019]/g, ' ');
      jsonStr = jsonStr.replace(/"isCo[^"]*":/g, '"isCorrect":');
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      
      this.logger.log(`[AI] Step 2: Cleaned JSON length: ${jsonStr.length} chars`);

      let parsed;
      try {
        // First attempt: Try direct JSON parse
        parsed = JSON.parse(jsonStr);
        this.logger.log(`[AI] Step 2: Direct JSON parse succeeded`);
      } catch (parseError: any) {
        this.logger.error(`[AI] Step 2: Direct parse failed: ${parseError.message}`);
        
        // Second attempt: Extract JSON array using character scanning
        try {
          const jsonArray = this.extractJsonArray(jsonStr);
          if (jsonArray) {
            parsed = JSON.parse(jsonArray);
            this.logger.log(`[AI] Step 2: Extracted JSON array parse succeeded`);
          } else {
            this.logger.error(`[AI] Step 2: Could not extract JSON array`);
            throw new Error('Could not extract JSON array from response');
          }
        } catch (extractError: any) {
          this.logger.error(`[AI] Step 2: Extraction failed: ${extractError.message}`);
          // Last resort: try to extract individual question objects
          this.logger.log(`[AI] Step 2: Attempting object-by-object extraction...`);
          const objects = this.extractQuestionObjects(jsonStr);
          if (objects.length > 0) {
            parsed = objects;
            this.logger.log(`[AI] Step 2: Recovered ${objects.length} objects`);
          } else {
            throw extractError;
          }
        }
      }

      let questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
      
      this.logger.log(`[AI] Step 2: Parsed ${questions.length} questions (requested: ${requestedCount}, raw: ${rawQuestionCount})`);
      if (questions.length < requestedCount) {
        this.logger.warn(`[AI] Step 2: WARNING - Only got ${questions.length}/${requestedCount} questions`);
      }

      return questions;
    } catch (error: any) {
      this.logger.error(`[AI] Step 2 (convert to JSON) failed: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`[AI] Error response: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Extract JSON array from text using character-by-character scanning
   * More reliable than regex-based approaches
   */
  private extractJsonArray(text: string): string | null {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let startIdx = -1;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Handle escape sequences in strings
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      // Handle string boundaries
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      // Only process structural characters outside strings
      if (!inString) {
        if (char === '[') {
          if (depth === 0) {
            startIdx = i;
          }
          depth++;
        } else if (char === ']') {
          depth--;
          if (depth === 0 && startIdx !== -1) {
            // Found complete JSON array
            return text.substring(startIdx, i + 1);
          }
        }
      }
    }

    // Return null if no complete array found
    return null;
  }

  /**
   * Extract individual question objects from JSON string
   * Used as fallback when full array parsing fails
   */
  private extractQuestionObjects(text: string): any[] {
    const objects: any[] = [];
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let currentStart = -1;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Handle escape sequences
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      // Handle strings
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      // Only process structural characters outside strings
      if (!inString) {
        if (char === '{') {
          if (depth === 0) {
            currentStart = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && currentStart !== -1) {
            // Found a complete object
            const objStr = text.substring(currentStart, i + 1);
            try {
              const parsed = JSON.parse(objStr);
              objects.push(parsed);
            } catch (e) {
              this.logger.warn(`[AI] Failed to parse individual object at position ${currentStart}`);
            }
            currentStart = -1;
          }
        }
      }
    }

    return objects;
  }

  private validateAiQuestions(questions: any[]): AIQuestion[] {
    const validQuestions = questions
      .filter((q, idx) => {
        // Must have a question text
        if (!q.question || typeof q.question !== 'string' || q.question.trim().length === 0) {
          this.logger.warn(`[AI] Question ${idx + 1}: Missing or empty question text, skipping`);
          return false;
        }

        // Must have either options (with at least one marked correct) OR correctAnswer
        const hasOptions = Array.isArray(q.options) && q.options.length > 0;
        const hasCorrectAnswer = q.correctAnswer && typeof q.correctAnswer === 'string';

        if (!hasOptions && !hasCorrectAnswer) {
          this.logger.warn(`[AI] Question ${idx + 1}: Missing both options and correctAnswer, skipping`);
          return false;
        }

        return true;
      })
      .map((q, idx) => ({
        question: q.question.trim(),
        type: q.type || 'multiple_choice',
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || 'Không có giải thích',
        level: this.normalizeLevel(q.level || 'medium'),
      }));

    this.logger.log(`[AI] Validation: ${validQuestions.length} / ${questions.length} questions passed`);
    return validQuestions;
  }

  /**
   * Normalize level values to valid enum: easy, medium, hard
   */
  private normalizeLevel(level: string): 'easy' | 'medium' | 'hard' {
    const normalized = level?.toLowerCase().trim() || 'medium';
    
    // Map various level names to standard enum
    const levelMap: Record<string, 'easy' | 'medium' | 'hard'> = {
      'easy': 'easy',
      'simple': 'easy',
      'elementary': 'easy',
      'beginner': 'easy',
      'basic': 'easy',
      'medium': 'medium',
      'intermediate': 'medium',
      'middle': 'medium',
      'moderate': 'medium',
      'hard': 'hard',
      'difficult': 'hard',
      'advanced': 'hard',
      'complex': 'hard',
      'expert': 'hard',
    };

    return levelMap[normalized] || 'medium';
  }

  /**
   * Validate if generated questions match the requested topic
   * Returns a relevance score (0-100)
   */
  private validateTopicRelevance(questions: AIQuestion[], originalPrompt: string): number {
    if (questions.length === 0) return 0;

    const topicKeywords = this.extractTopicKeywords(originalPrompt);
    if (topicKeywords.length === 0) {
      // If we can't extract keywords, assume relevance is OK
      return 100;
    }

    let relevantCount = 0;
    const lowerPrompt = originalPrompt.toLowerCase();

    for (const question of questions) {
      const questionText = `${question.question} ${question.explanation || ''}`.toLowerCase();
      
      // Check if question contains any topic keyword
      const isRelevant = topicKeywords.some(keyword => {
        return questionText.includes(keyword.toLowerCase());
      });

      if (isRelevant) {
        relevantCount++;
      } else {
        this.logger.warn(`[AI] Question may not be relevant to topic "${originalPrompt}": ${question.question.substring(0, 50)}`);
      }
    }

    const relevanceScore = Math.round((relevantCount / questions.length) * 100);
    return relevanceScore;
  }

  /**
   * Extract key topic words from original prompt for relevance checking
   */
  private extractTopicKeywords(prompt: string): string[] {
    const keywords: string[] = [];

    // Common Vietnamese subject keywords
    const subjectKeywords = {
      'toán': ['toán', 'số', 'phương trình', 'hàm số', 'đạo hàm', 'tích phân', 'bất phương'],
      'lý': ['lý', 'lực', 'năng lượng', 'động', 'điện', 'ánh sáng'],
      'hóa': ['hóa', 'hoá', 'chất', 'phản ứng', 'phân tử', 'nguyên tố'],
      'anh': ['anh', 'english', 'verb', 'grammar', 'vocabulary'],
      'sử': ['sử', 'lịch', 'chiến tranh', 'nước'],
      'địa': ['địa', 'địaly', 'bản đồ', 'tự nhiên', 'nhân văn'],
      'sinh': ['sinh', 'sinh học', 'gen', 'tiến hóa', 'tế bào'],
    };

    const lowerPrompt = prompt.toLowerCase();

    // Find matching subject and add its keywords
    for (const [subject, keys] of Object.entries(subjectKeywords)) {
      if (lowerPrompt.includes(subject)) {
        keywords.push(...keys);
        break;
      }
    }

    // Extract custom keywords from prompt (words after specific markers)
    // Examples: "toán lớp 10 về phương trình" -> add "phương trình"
    const customKeywords = prompt.match(/(?:về|liên quan|chuyên đề|chương)\s+([^,\.]+)/gi);
    if (customKeywords) {
      customKeywords.forEach(phrase => {
        const keyword = phrase.replace(/(?:về|liên quan|chuyên đề|chương)\s+/i, '').trim();
        if (keyword.length > 2) {
          keywords.push(keyword);
        }
      });
    }

    // Add the entire prompt as a search term
    const words = prompt.split(/\s+/).filter(w => w.length > 3);
    keywords.push(...words);

    // Remove duplicates
    return Array.from(new Set(keywords));
  }

  private getPointsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): number {
    switch (difficulty) {
      case 'easy':
        return 1;
      case 'medium':
        return 2;
      case 'hard':
        return 3;
      default:
        return 1;
    }
  }

  /**
   * Initialize chat conversation
   * Creates draft quiz and returns conversation ID
   */
  async initializeChat(userId: string): Promise<any> {
    const timestamp = new Date().toLocaleString('vi-VN');
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create draft quiz
    const newQuiz = await this.quizModel.create({
      title: `Đề thi (${timestamp})`,
      description: `Đề thi được tạo bằng AI Chat`,
      createdBy: userId,
      questions: [],
      isPublished: false,
    });

    this.logger.log(`[AI Chat] Initialized conversation ${conversationId} with quiz ${newQuiz._id}`);

    return {
      conversationId,
      quizId: newQuiz._id.toString(),
      quizTitle: newQuiz.title,
    };
  }

  /**
   * Chat message handler
   * Analyzes user message and decides action:
   * - Create new questions if not exists
   * - Edit specific question (e.g., "Sửa câu 5")
   * - Edit all questions (e.g., "Làm khó hơn")
   * - Add more questions
   */
  async chatMessage(
    conversationId: string,
    userMessage: string,
    currentQuestions: any[],
    userId: string,
  ): Promise<any> {
    this.logger.log(`[AI Chat] Processing: "${userMessage.substring(0, 50)}..."`);

    try {
      // Determine action type
      const actionType = this.detectActionType(userMessage, currentQuestions);
      this.logger.log(`[AI Chat] Detected action: ${actionType}`);

      let response: any;

      switch (actionType) {
        case 'create':
          // Create new questions from prompt
          response = await this.chatCreateQuestions(userMessage, userId);
          break;

        case 'edit-specific':
          // Edit specific question(s)
          const questionNum = this.extractQuestionNumber(userMessage);
          response = await this.chatEditQuestion(
            userMessage,
            currentQuestions,
            questionNum,
            userId,
          );
          break;

        case 'edit-all':
          // Edit all questions
          response = await this.chatEditAllQuestions(userMessage, currentQuestions, userId);
          break;

        case 'add':
          // Add more questions
          response = await this.chatAddQuestions(userMessage, currentQuestions, userId);
          break;

        default:
          response = {
            message:
              'Tôi không hiểu yêu cầu của bạn. Hãy thử:\n• "Tạo 20 câu về Toán"\n• "Sửa câu 5 cho khó hơn"\n• "Làm khó hơn"',
            questions: currentQuestions,
          };
      }

      return response;
    } catch (error: any) {
      this.logger.error(`[AI Chat] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect action type from user message
   */
  private detectActionType(
    message: string,
    currentQuestions: any[],
  ): 'create' | 'edit-specific' | 'edit-all' | 'add' | 'unknown' {
    const lowerMsg = message.toLowerCase();

    // Check if asking to create new
    if (
      lowerMsg.includes('tạo') ||
      lowerMsg.includes('create') ||
      lowerMsg.includes('sinh')
    ) {
      return 'create';
    }

    // Check if editing specific question
    if (
      lowerMsg.includes('câu') ||
      (lowerMsg.includes('sửa') && lowerMsg.match(/\d+/))
    ) {
      return 'edit-specific';
    }

    // Check if adding more questions
    if (
      lowerMsg.includes('thêm') ||
      lowerMsg.includes('add more') ||
      (lowerMsg.includes('tạo') && lowerMsg.includes('nữa'))
    ) {
      return currentQuestions.length > 0 ? 'add' : 'create';
    }

    // Check if editing all
    if (
      (lowerMsg.includes('làm') || lowerMsg.includes('thay')) &&
      (lowerMsg.includes('khó') ||
        lowerMsg.includes('dễ') ||
        lowerMsg.includes('lại') ||
        lowerMsg.includes('toàn'))
    ) {
      return currentQuestions.length > 0 ? 'edit-all' : 'unknown';
    }

    return 'unknown';
  }

  /**
   * Extract question number from message (e.g., "câu 5" -> 5)
   */
  private extractQuestionNumber(message: string): number {
    const match = message.match(/câu\s*(\d+)/i);
    return match ? parseInt(match[1], 10) - 1 : 0; // Convert to 0-indexed
  }

  /**
   * Create questions from user prompt
   */
  private async chatCreateQuestions(prompt: string, userId: string): Promise<any> {
    const numberOfQuestions = this.extractNumberOfQuestions(prompt);

    const aiQuestions = await this.generateAiQuestions(prompt, 'vi');
    this.logger.log(`[AI Chat] Generated ${aiQuestions.length} questions`);

    const validatedQuestions = this.validateAiQuestions(aiQuestions);

    return {
      message: `✅ Tôi đã tạo ${validatedQuestions.length} câu hỏi cho bạn. Bạn có thể:\n• Xem xét chúng ở bên phải\n• Yêu cầu sửa ("Sửa câu 3 để dễ hơn")\n• Thêm câu hỏi ("Thêm 5 câu nữa")`,
      questions: validatedQuestions.map((q) => ({
        content: q.question,
        type: q.type,
        level: q.level,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        isActive: false,
      })),
    };
  }

  /**
   * Edit specific question
   */
  private async chatEditQuestion(
    modifyPrompt: string,
    currentQuestions: any[],
    questionIndex: number,
    userId: string,
  ): Promise<any> {
    if (questionIndex >= currentQuestions.length) {
      return {
        message: `❌ Không tìm thấy câu ${questionIndex + 1}. Hiện tại có ${currentQuestions.length} câu.`,
        questions: currentQuestions,
      };
    }

    const questionToEdit = currentQuestions[questionIndex];

    // Create prompt for AI to edit specific question
    const editPrompt = `Hãy sửa câu hỏi sau theo yêu cầu: "${modifyPrompt}"

Câu gốc:
${questionToEdit.content}

Các phương án gốc:
${questionToEdit.options?.map((opt: any) => `${opt.text} ${opt.isCorrect ? ' (ĐÚNG)' : ''}`).join('\n')}

Giải thích gốc:
${questionToEdit.explanation}

Vui lòng tạo câu hỏi mới thay thế, cải thiện theo yêu cầu. Giữ định dạng JSON:
{
  "question": "nội dung câu hỏi mới",
  "options": [
    { "text": "A. phương án A", "isCorrect": boolean },
    { "text": "B. phương án B", "isCorrect": boolean },
    { "text": "C. phương án C", "isCorrect": boolean },
    { "text": "D. phương án D", "isCorrect": boolean }
  ],
  "correctAnswer": "A/B/C/D",
  "explanation": "giải thích BẰNG TIẾNG VIỆT",
  "level": "easy/medium/hard"
}`;

    try {
      const editedQuestionText = await this.callGroqGenerateText(editPrompt, 'vi', 1);
      const editedQuestion = await this.callGroqConvertToJson(editedQuestionText);

      if (editedQuestion.length > 0) {
        const modified = editedQuestion[0];
        const updatedQuestions = [...currentQuestions];
        updatedQuestions[questionIndex] = {
          content: modified.question,
          type: modified.type,
          level: modified.level,
          options: modified.options,
          correctAnswer: modified.correctAnswer,
          explanation: modified.explanation,
          isActive: false,
        };

        return {
          message: `✅ Đã sửa câu ${questionIndex + 1} theo yêu cầu của bạn.`,
          questions: updatedQuestions,
        };
      }
    } catch (error) {
      this.logger.error(`[AI Chat] Error editing question: ${error}`);
    }

    return {
      message: `❌ Có lỗi khi sửa câu hỏi. Vui lòng thử lại.`,
      questions: currentQuestions,
    };
  }

  /**
   * Edit all questions
   */
  private async chatEditAllQuestions(
    modifyPrompt: string,
    currentQuestions: any[],
    userId: string,
  ): Promise<any> {
    const totalQuestions = currentQuestions.length;

    // Create prompt to edit all questions
    const editAllPrompt = `Hãy sửa lại tất cả ${totalQuestions} câu hỏi sau theo yêu cầu: "${modifyPrompt}"

Các câu hỏi hiện tại:
${currentQuestions
  .map(
    (q, idx) => `
Câu ${idx + 1}: ${q.content}
Các phương án:
${q.options?.map((opt: any) => `${opt.text}`).join('\n')}
Đáp án đúng: ${q.correctAnswer}
Giải thích: ${q.explanation}
Độ khó: ${q.level}
`,
  )
  .join('\n---\n')}

Vui lòng tạo lại tất cả ${totalQuestions} câu hỏi, cải thiện chúng theo yêu cầu. Output JSON array.`;

    try {
      const editedText = await this.callGroqGenerateText(editAllPrompt, 'vi', totalQuestions);
      const editedQuestions = await this.callGroqConvertToJson(editedText);

      if (editedQuestions.length > 0) {
        const updatedQuestions = editedQuestions.map((q) => ({
          content: q.question,
          type: q.type,
          level: q.level,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          isActive: false,
        }));

        return {
          message: `✅ Đã sửa lại tất cả ${updatedQuestions.length} câu theo yêu cầu "${modifyPrompt}".`,
          questions: updatedQuestions,
        };
      }
    } catch (error) {
      this.logger.error(`[AI Chat] Error editing all questions: ${error}`);
    }

    return {
      message: `❌ Có lỗi khi sửa lại các câu hỏi. Vui lòng thử lại.`,
      questions: currentQuestions,
    };
  }

  /**
   * Add more questions
   */
  private async chatAddQuestions(
    prompt: string,
    currentQuestions: any[],
    userId: string,
  ): Promise<any> {
    const additionalCount = this.extractNumberOfQuestions(prompt) || 5;

    const addPrompt = `Hãy tạo thêm ${additionalCount} câu hỏi mới tương tự như ${currentQuestions.length} câu đã có:

Các câu gốc:
${currentQuestions
  .map(
    (q, idx) => `
Câu ${idx + 1}: ${q.content}
Độ khó: ${q.level}
`,
  )
  .join('\n')}

Tạo ${additionalCount} câu hỏi mới có cùng chủ đề và độ khó tương tự.`;

    try {
      const newText = await this.callGroqGenerateText(addPrompt, 'vi', additionalCount);
      const newQuestions = await this.callGroqConvertToJson(newText);

      if (newQuestions.length > 0) {
        const addedQuestions = newQuestions.map((q) => ({
          content: q.question,
          type: q.type,
          level: q.level,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          isActive: false,
        }));

        const combined = [...currentQuestions, ...addedQuestions];

        return {
          message: `✅ Đã thêm ${addedQuestions.length} câu hỏi mới. Tổng cộng ${combined.length} câu.`,
          questions: combined,
        };
      }
    } catch (error) {
      this.logger.error(`[AI Chat] Error adding questions: ${error}`);
    }

    return {
      message: `❌ Có lỗi khi thêm câu hỏi. Vui lòng thử lại.`,
      questions: currentQuestions,
    };
  }
}
