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
        isPublished: false,
      });
      const finalQuizId = newQuiz._id.toString();
      this.logger.log(`[AI] Created new quiz: ${finalQuizId}`);

      // 3. Gửi prompt cho AI và nhận kết quả
      const aiQuestions = await this.generateAiQuestions(
        customPrompt,
        language,
      );

      this.logger.log(`[AI] Received ${aiQuestions.length} questions from AI`);

      // 4. Validate dữ liệu từ AI
      const validatedQuestions = this.validateAiQuestions(aiQuestions);

      // 5. Lưu vào DB (chưa public)
      const savedQuestions: any[] = [];
      for (let i = 0; i < validatedQuestions.length; i++) {
        const questionData = {
          content: validatedQuestions[i].question,
          type: validatedQuestions[i].type,
          options: validatedQuestions[i].options,
          correctAnswer: validatedQuestions[i].correctAnswer,
          explanation: validatedQuestions[i].explanation,
          level: validatedQuestions[i].level || 'medium',
          quizId: finalQuizId,
          createdBy: userId,
          points: this.getPointsByDifficulty(validatedQuestions[i].level || 'medium'),
          order: i,
          isActive: false, // Chưa public - để giáo viên duyệt
        };

        const savedQuestion = await this.questionModel.create(questionData);
        savedQuestions.push(savedQuestion);
        this.logger.log(`[AI] Saved question: ${savedQuestion._id}`);
      }

      
      return {
        success: true,
        message: `Đã sinh ${savedQuestions.length} câu hỏi thành công`,
        count: savedQuestions.length,
        quizId: finalQuizId,
        quizTitle: `Đề thi (${new Date().toLocaleString('vi-VN')})`,
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
        status: 'pending_review',
      };
    } catch (error) {
      this.logger.error(`[AI] Failed to generate questions: ${error.message}`);
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
   * STEP 1: Generate test content in free text format
   */
  private async callGroqGenerateText(
    customPrompt: string,
    language: string,
    numberOfQuestions: number,
  ): Promise<string> {
    try {
      const response = await axios.post(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: `You are an expert English teacher. Create a multiple-choice test with **EXACTLY ${numberOfQuestions} questions** based on the following:

Topic/Requirement: ${customPrompt}

Format (free text, not JSON):
- Number each question clearly: Question 1:, Question 2:, ... Question ${numberOfQuestions}:
- Each question clearly shows the 4 options (A, B, C, D)
- Each question has 1 correct answer
- Include a brief explanation for each question
- Make each question completely different from the others
- CRITICAL: Create EXACTLY ${numberOfQuestions} questions - not less, not more

Do NOT output JSON. Just write the questions naturally with clear numbering.`,
            },
          ],
          temperature: 0.8,
          max_tokens: 2000,
        },
        {
          timeout: 60000,
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
      const response = await axios.post(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: `Convert the following test content into VALID JSON.

Rules:
- Output ONLY valid JSON array
- No markdown, no code blocks
- Each string must be single-line (escape newlines as \\n)
- Escape all special characters properly
- Level MUST be one of: "easy", "medium", "hard" (NOT elementary, advanced, etc)
- IMPORTANT: Option text MUST include "A. ", "B. ", "C. ", "D. " prefix
- correctAnswer MUST be one of: "A", "B", "C", "D" (single letter only)
- Array of objects with: question, options, correctAnswer, explanation
- CRITICAL: Return ALL questions from the input. Do not skip any.

Target format:
[
  {
    "question": "Question text here",
    "type": "multiple_choice",
    "level": "easy",
    "options": [
      { "text": "A. Option A", "isCorrect": true },
      { "text": "B. Option B", "isCorrect": false },
      { "text": "C. Option C", "isCorrect": false },
      { "text": "D. Option D", "isCorrect": false }
    ],
    "correctAnswer": "A",
    "explanation": "Explanation text here"
  }
]

CONTENT TO CONVERT:
<<<
${aiGeneratedText}
>>>

Output ONLY the JSON array, nothing else.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        },
        {
          timeout: 60000,
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
      this.logger.log(`[AI] Step 2 raw response length: ${content.length}`);

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn(`[AI] No JSON found in step 2 response: ${content.substring(0, 300)}`);
        throw new Error('Invalid JSON format in step 2 response');
      }

      // Clean and fix JSON before parsing
      let jsonStr = jsonMatch[0];
      
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
      
      this.logger.log(`[AI] Cleaned JSON length: ${jsonStr.length}`);

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError: any) {
        this.logger.error(`[AI] First parse attempt failed: ${parseError.message}`);
        
        // Try to parse objects individually
        try {
          const objectPattern = /\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/g;
          const objects = jsonStr.match(objectPattern) || [];
          
          if (objects.length > 0) {
            const cleanedObjects = objects.map((obj, idx) => {
              try {
                return JSON.parse(obj);
              } catch (e) {
                this.logger.warn(`[AI] Failed to parse object ${idx}`);
                return null;
              }
            }).filter(Boolean);
            
            parsed = cleanedObjects;
            this.logger.log(`[AI] Recovered ${cleanedObjects.length} / ${objects.length} objects`);
          } else {
            throw new Error('Could not extract any JSON objects');
          }
        } catch (secondParseError: any) {
          this.logger.error(`[AI] Individual object parse failed: ${secondParseError.message}`);
          throw secondParseError;
        }
      }

      let questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
      
      this.logger.log(`[AI] Step 2: Parsed ${questions.length} questions (requested: ~${requestedCount})`);
      if (questions.length < requestedCount) {
        this.logger.warn(`[AI] WARNING: Only got ${questions.length} questions but requested ~${requestedCount}`);
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

  private validateAiQuestions(questions: any[]): AIQuestion[] {
    return questions
      .filter((q) => {

        return (
          q.question &&
          q.type &&
          (q.options || q.correctAnswer)
        );
      })
      .map((q) => ({
        question: q.question,
        type: q.type || 'multiple_choice',
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'Không có giải thích',
        level: this.normalizeLevel(q.level || 'medium'),
      }));
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

}
