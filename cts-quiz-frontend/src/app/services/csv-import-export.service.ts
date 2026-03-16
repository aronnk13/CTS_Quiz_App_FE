// src/app/services/csv-import-export.service.ts
import { Injectable } from '@angular/core';
import { QuizQuestion, QuestionType, Difficulty, QuizOption } from '../models/quiz.models';

export interface CsvRow {
  questionText: string;
  type: string;
  difficulty: string;
  category: string;
  timerSeconds: string;
  tags: string;
  option1: string;
  option1Correct: string;
  option2: string;
  option2Correct: string;
  option3: string;
  option3Correct: string;
  option4: string;
  option4Correct: string;
}

@Injectable({
  providedIn: 'root'
})
export class CsvImportExportService {

  /**
   * Generate and download a sample CSV file
   */
  downloadSampleCSV(): void {
    const sampleData: CsvRow[] = [
      {
        questionText: 'What is the capital of France?',
        type: 'Multiple Choice',
        difficulty: 'Easy',
        category: 'Geography',
        timerSeconds: '30',
        tags: 'europe,capitals',
        option1: 'Paris',
        option1Correct: 'true',
        option2: 'London',
        option2Correct: 'false',
        option3: 'Berlin',
        option3Correct: 'false',
        option4: 'Madrid',
        option4Correct: 'false'
      },
      {
        questionText: 'TypeScript is a superset of JavaScript.',
        type: 'True/False',
        difficulty: 'Medium',
        category: 'Programming',
        timerSeconds: '15',
        tags: 'typescript,javascript',
        option1: 'True',
        option1Correct: 'true',
        option2: 'False',
        option2Correct: 'false',
        option3: '',
        option3Correct: '',
        option4: '',
        option4Correct: ''
      },
      {
        questionText: 'Explain the concept of inheritance in OOP.',
        type: 'Short Answer',
        difficulty: 'Hard',
        category: 'Programming',
        timerSeconds: '180',
        tags: 'oop,inheritance',
        option1: '',
        option1Correct: '',
        option2: '',
        option2Correct: '',
        option3: '',
        option3Correct: '',
        option4: '',
        option4Correct: ''
      }
    ];

    const csvContent = this.convertToCSV(sampleData);
    this.downloadCSV(csvContent, 'quiz-questions-sample.csv');
  }

  /**
   * Import questions from CSV file
   */
  importFromCSV(file: File): Promise<QuizQuestion[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvText = e.target?.result as string;
          const questions = this.parseCSV(csvText);
          resolve(questions);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Export questions to CSV
   */
  exportToCSV(questions: QuizQuestion[], quizName?: string): void {
    if (questions.length === 0) {
      throw new Error('No questions to export');
    }

    const csvData = questions.map(q => this.questionToCsvRow(q));
    const csvContent = this.convertToCSV(csvData);
    const filename = `${quizName || 'quiz'}-questions.csv`;
    this.downloadCSV(csvContent, filename);
  }

  /**
   * Parse CSV text into QuizQuestion array
   */
  private parseCSV(csvText: string): QuizQuestion[] {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const questions: QuizQuestion[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}. Skipping.`);
          continue;
        }

        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });

        const question = this.csvRowToQuestion(row);
        questions.push(question);
      } catch (error) {
        console.error(`Error parsing row ${i + 1}:`, error);
        throw new Error(`Error in row ${i + 1}: ${(error as Error).message}`);
      }
    }

    return questions;
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Convert CSV row to QuizQuestion
   */
  private csvRowToQuestion(row: CsvRow): QuizQuestion {
    const questionText = row.questionText?.trim();
    if (!questionText) {
      throw new Error('Question text is required');
    }

    const type = this.validateQuestionType(row.type?.trim());
    const difficulty = this.validateDifficulty(row.difficulty?.trim());
    const category = row.category?.trim();
    
    if (!category) {
      throw new Error('Category is required');
    }

    const timerSeconds = row.timerSeconds ? parseInt(row.timerSeconds) : null;
    const tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const options: QuizOption[] = this.parseOptionsFromRow(row);

    // Validate options based on question type
    this.validateOptionsForType(type, options);

    return {
      text: questionText,
      type,
      difficulty,
      category,
      timerSeconds,
      tags,
      options
    };
  }

  /**
   * Convert QuizQuestion to CSV row format
   */
  private questionToCsvRow(question: QuizQuestion): CsvRow {
    const row: CsvRow = {
      questionText: question.text,
      type: question.type,
      difficulty: question.difficulty,
      category: question.category,
      timerSeconds: question.timerSeconds?.toString() || '',
      tags: question.tags.join(','),
      option1: '',
      option1Correct: '',
      option2: '',
      option2Correct: '',
      option3: '',
      option3Correct: '',
      option4: '',
      option4Correct: ''
    };

    // Fill in options (up to 4)
    question.options.forEach((option, index) => {
      if (index < 4) {
        const optionKey = `option${index + 1}` as keyof CsvRow;
        const correctKey = `option${index + 1}Correct` as keyof CsvRow;
        row[optionKey] = option.text;
        row[correctKey] = option.isCorrect ? 'true' : 'false';
      }
    });

    return row;
  }

  /**
   * Parse options from CSV row
   */
  private parseOptionsFromRow(row: CsvRow): QuizOption[] {
    const options: QuizOption[] = [];
    
    for (let i = 1; i <= 4; i++) {
      const optionText = row[`option${i}` as keyof CsvRow]?.trim();
      const isCorrect = row[`option${i}Correct` as keyof CsvRow]?.toLowerCase() === 'true';
      
      if (optionText) {
        options.push({ text: optionText, isCorrect });
      }
    }

    return options;
  }

  /**
   * Validate question type
   */
  private validateQuestionType(type: string): QuestionType {
    if (!type || !['Multiple Choice', 'True/False', 'Short Answer'].includes(type)) {
      throw new Error(`Invalid question type: ${type}. Must be 'Multiple Choice', 'True/False', or 'Short Answer'`);
    }
    return type as QuestionType;
  }

  /**
   * Validate difficulty level
   */
  private validateDifficulty(difficulty: string): Difficulty {
    if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      throw new Error(`Invalid difficulty: ${difficulty}. Must be 'Easy', 'Medium', or 'Hard'`);
    }
    return difficulty as Difficulty;
  }

  /**
   * Validate options based on question type
   */
  private validateOptionsForType(type: QuestionType, options: QuizOption[]): void {
    switch (type) {
      case 'Short Answer':
        if (options.length > 0) {
          throw new Error('Short Answer questions should not have options');
        }
        break;
      case 'True/False':
        if (options.length !== 2) {
          throw new Error('True/False questions must have exactly 2 options');
        }
        break;
      case 'Multiple Choice':
        if (options.length < 2) {
          throw new Error('Multiple Choice questions must have at least 2 options');
        }
        break;
    }

    // Check for at least one correct answer (except Short Answer)
    if (type !== 'Short Answer' && !options.some(opt => opt.isCorrect)) {
      throw new Error(`${type} questions must have at least one correct answer`);
    }
  }

  /**
   * Convert array of objects to CSV string
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        const stringValue = String(value || '');
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Download CSV content as file
   */
  private downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      throw new Error('File download not supported in this browser');
    }
  }

  /**
   * Validate CSV file before processing
   */
  validateCsvFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!file) {
      errors.push('No file selected');
    } else {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        errors.push('File must be a CSV file');
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        errors.push('File size must be less than 5MB');
      }

      if (file.size === 0) {
        errors.push('File is empty');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}