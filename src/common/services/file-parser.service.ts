import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

let pdfParse: any;

@Injectable()
export class FileParserService {
  constructor() {
    try {
      pdfParse = require('pdf-parse');
    } catch (e) {
      console.warn('pdf-parse not available');
    }
  }

  async parsePDF(buffer: Buffer): Promise<string> {
    try {
      if (!pdfParse) {
        pdfParse = require('pdf-parse');
      }
      const parseFunc = pdfParse.default || pdfParse;
      const data = await parseFunc(buffer);
      return data.text;
    } catch (error) {
      throw new Error('Failed to parse PDF');
    }
  }

  async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error('Failed to parse DOCX');
    }
  }

  async parseXLSX(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        text += csv + '\n';
      }

      return text;
    } catch (error) {
      throw new Error('Failed to parse XLSX');
    }
  }

  async parseTXT(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      throw new Error('Failed to parse TXT');
    }
  }

  async parseFile(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.parsePDF(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.parseDOCX(buffer);
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return this.parseXLSX(buffer);
      case 'text/plain':
        return this.parseTXT(buffer);
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  extractQuestions(
    text: string,
  ): Array<{
    content: string;
    options: string[];
    correctAnswer: number;
    type?: string;
  }> {
    const questions: Array<{
      content: string;
      options: string[];
      correctAnswer: number;
      type?: string;
    }> = [];

    // Normalize text: remove extra whitespace, handle multiple line breaks
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Split by double newlines to handle multi-line sections
    const sections = normalizedText.split(/\n\n+/);
    let currentTitle = '';

    for (const section of sections) {
      const lines = section.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) continue;

      // Check if this is a title (long text without A/B/C/D)
      if (lines.length > 1 && !this.containsOptions(lines.join('\n'))) {
        currentTitle = lines.join(' ');
        continue;
      }

      // Try to extract question from this section
      const question = this.extractQuestionFromLines(lines, currentTitle);
      if (question) {
        questions.push(question);
      }
    }

    // If no questions found with section-based approach, try regex patterns
    if (questions.length === 0) {
      return this.extractQuestionsRegex(normalizedText);
    }

    return questions;
  }

  /**
   * Extract question from a block of lines
   * Handles formats like:
   * "Question 1: A. option B. option C. option D. option"
   * "Question 1:\nA) option\nB) option\nC) option\nD) option"
   */
  private extractQuestionFromLines(
    lines: string[],
    title: string = '',
  ): {
    content: string;
    options: string[];
    correctAnswer: number;
    type?: string;
  } | null {
    if (lines.length < 1) return null;

    const firstLine = lines[0];
    
    // Check if first line is a question identifier
    const questionMatch = firstLine.match(
      /^(?:Question|Câu|Bài|Q\.?|№)\s*\d+[.):\s-]*(.*)$/i,
    );
    
    if (!questionMatch) return null;

    let questionText = questionMatch[1].trim();
    let optionLines = lines.slice(1);

    // If question text is on first line with options, extract full first line
    if (questionText && this.containsOptions(questionText)) {
      // Options on same line as question
      optionLines = [firstLine.replace(/^[^:]+:\s*/, '')];
    } else if (!questionText) {
      // Question is on first line, options on following lines
      questionText = '';
      optionLines = lines.slice(1);
    }

    // Combine all option lines
    const optionsText = optionLines.join('\n');

    // Extract options (support A., A), A:, etc.)
    const options = this.extractOptions(optionsText);
    
    // Detect correct answer from common markers
    const correctAnswer = this.detectCorrectAnswer(optionLines);

    // Detect question type
    const type = this.detectQuestionType(questionText, optionsText);

    if (options.length >= 2) {
      return {
        content: questionText || title,
        options,
        correctAnswer,
        type,
      };
    }

    return null;
  }

  /**
   * Extract options from text
   * Supports formats: A. B. C. D. or A) B) C) D) or A: B: C: D:
   */
  private extractOptions(text: string): string[] {
    const options: string[] = [];
    const optionPattern = /[A-D][.):\s]+([^\n]*?)(?=[A-D][.):\s]+|$)/gi;
    let match;

    while ((match = optionPattern.exec(text)) !== null) {
      const option = match[1].trim();
      if (option) {
        options.push(option);
      }
    }

    return options;
  }

  /**
   * Detect correct answer from text patterns
   */
  private detectCorrectAnswer(lines: string[]): number {
    const text = lines.join('\n').toUpperCase();
    
    // Look for answer markers
    const answerMatch = text.match(
      /(?:ANSWER|ĐÁP ÁN|CORRECT)[:\s]+([A-D])/i,
    );
    
    if (answerMatch) {
      return answerMatch[1].charCodeAt(0) - 65; // Convert A-D to 0-3
    }

    // Check for underline or special markers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes('✓') ||
        line.includes('☑') ||
        line.includes('√') ||
        /^[A-D]\s*[\*✓☑]/i.test(line)
      ) {
        const char = line.match(/^([A-D])/i)?.[1];
        if (char) {
          return char.toUpperCase().charCodeAt(0) - 65;
        }
      }
    }

    return 0; // Default to A
  }

  /**
   * Detect question type
   */
  private detectQuestionType(
    questionText: string,
    optionsText: string,
  ): string {
    const combined = (questionText + ' ' + optionsText).toUpperCase();

    // Check for fill-in-the-blank
    if (combined.includes('_') || combined.includes('____')) {
      return 'FILL_IN_BLANK';
    }

    // Check for pronunciation (contains phonetic symbols)
    if (/\/[a-z]+\/|ˈ|ˌ|ŋ|ʃ|ʒ|θ|ð|tʃ|dʒ/.test(optionsText)) {
      return 'PRONUNCIATION';
    }

    // Check for underline (indicating word pronunciation)
    if (optionsText.includes('_') && questionText.includes('underline')) {
      return 'PRONUNCIATION';
    }

    // Default to multiple choice
    return 'MULTIPLE_CHOICE';
  }

  /**
   * Check if text contains answer options
   */
  private containsOptions(text: string): boolean {
    return /[A-D][.):\s]+/i.test(text);
  }

  /**
   * Fallback regex-based extraction
   */
  private extractQuestionsRegex(
    normalizedText: string,
  ): Array<{
    content: string;
    options: string[];
    correctAnswer: number;
  }> {
    const questions: Array<{
      content: string;
      options: string[];
      correctAnswer: number;
    }> = [];

    // Multiple regex patterns to handle different formats
    const patterns = [
      // Format: "1. Question?\nA) ...\nB) ...\nAnswer: A"
      /^(\d+)[.):\s]+(.+?)(?:\n|$)((?:(?:[A-D])[.):\s]+.+(?:\n|$))+)(?:(?:Đáp án|Answer|Correct|Correct answer)[:\s]+([A-D]))?/gim,
      // Format: "Câu 1:\nQuestion text\nA)\nB)\nC)\nD)\nĐáp án: A"
      /^(?:Câu|Question|Bài|Q\.?)\s*\d+[.):\s]*(.+?)(?:\n|$)((?:(?:[A-D])[.):\s]+.+(?:\n|$))+)(?:(?:Đáp án|Answer)[:\s]+([A-D]))?/gim,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(normalizedText)) !== null) {
        const questionText = (match[1] || match[2] || '').trim();
        const optionsText = (match[2] || match[3] || '');
        const correctAnswer = match[3] || match[4] || 'A';

        if (!questionText) continue;

        // Extract options more flexibly
        const optionLines = optionsText.split('\n').filter(line => line.trim());
        const options: string[] = [];
        
        for (const line of optionLines) {
          const trimmed = line.trim();
          // Match A), A., A:, A-, etc.
          const optMatch = trimmed.match(/^[A-D][.):\-\s]+(.+)$/i);
          if (optMatch) {
            options.push(optMatch[1].trim());
          }
        }

        // Accept questions with at least 2 options
        if (options.length >= 2) {
          const correctIndex = Math.max(
            0,
            Math.min(
              correctAnswer.toUpperCase().charCodeAt(0) - 65,
              options.length - 1,
            ),
          );
          questions.push({
            content: questionText,
            options,
            correctAnswer: correctIndex,
          });
        }
      }

      // If we found questions with this pattern, return them
      if (questions.length > 0) {
        return questions;
      }
    }

    return questions;
  }

  /**
   * Normalize and clean extracted text
   * Remove extra whitespace, standardize line breaks, preserve Vietnamese characters
   */
  normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Convert Windows line breaks
      .replace(/\t/g, ' ') // Convert tabs to spaces
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();
  }
}
