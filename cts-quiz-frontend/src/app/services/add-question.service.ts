// src/app/services/add-question.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { 
  QuizQuestion, 
  QuizMeta, 
  QuestionType, 
  Difficulty,
  QuizDetailsResponse,
  CreateQuizResponse,
  DirectQuizInput,
  QuizListItem
} from '../models/quiz.models';

//Re-export types for backward compatibility with existing components
export type {
  QuizQuestion,
  QuizMeta,
  QuestionType,
  Difficulty,
  QuizDetailsResponse,
  CreateQuizResponse,
  DirectQuizInput,
  QuizListItem
} from '../models/quiz.models';
import { QuizCreationService } from './quiz-creation.service';
import { FormValidationService, ValidationResult } from './form-validation.service';
import { CsvImportExportService } from './csv-import-export.service';

/**
 * Main service for managing quiz state and coordinating other services
 * Focuses on state management and orchestration
 */
@Injectable({ providedIn: 'root' })
export class AddQuestionService {
  // Inject specialized services
  private quizCreationService = inject(QuizCreationService);
  private validationService = inject(FormValidationService);
  private csvService = inject(CsvImportExportService);

  /** In-memory signals (Angular v19) */
  private readonly _quizMeta = signal<QuizMeta | null>(null);
  private readonly _questions = signal<QuizQuestion[]>([]);

  /** Read-only accessors for components */
  quizMeta(): QuizMeta | null {
    return this._quizMeta();
  }
  
  questions(): QuizQuestion[] {
    return this._questions();
  }

  /**
   * Set quiz basics (name, category) and generate a preview quiz number.
   */
  setQuizBasics(name: string, cat: string): void {
    // Validate inputs using validation service
    const validation = this.validationService.validateQuizBasics(name, cat);
    if (!validation.isValid) {
      console.warn('Quiz basics validation failed:', validation.errors);
    }

    if (!name?.trim() || !cat?.trim()) {
      this._quizMeta.set(null);
      return;
    }
    
    const quizNumber = this.generatePreviewQuizNumber(cat);
    this._quizMeta.set({
      quizNumber,
      quizName: name.trim(),
      category: cat.trim(),
    });
  }
    

  /**
   * Add a single question with validation
   */
  addQuestion(payload: QuizQuestion): void {
    // Validate question using validation service
    const validation = this.validationService.validateQuestion(
      payload.text, 
      payload.type, 
      payload.options
    );

    if (!validation.isValid) {
      throw new Error(`Question validation failed: ${validation.errors.join(', ')}`);
    }

    // Normalize and store
    const normalized: QuizQuestion = this.normalizeQuestion(payload);
    this._questions.update(list => [...list, normalized]);
  }

  /**
   * Create Quiz - delegates to QuizCreationService
   */
  async createQuiz(): Promise<CreateQuizResponse> {
    const quiz = this._quizMeta();
    const questions = this._questions();

    // Validate complete quiz before creation
    const validation = this.validationService.validateQuizForCreation(quiz, questions);
    if (!validation.isValid) {
      throw new Error(`Quiz validation failed: ${validation.errors.join(', ')}`);
    }

    return this.quizCreationService.createQuiz(quiz!, questions);
  }

  /**
   * Create Quiz from Direct JSON Input
   */
  async createQuizFromJSON(quizData: DirectQuizInput): Promise<CreateQuizResponse> {
    // Map JSON input to internal format
    const quiz: QuizMeta = {
      quizNumber: '',
      quizName: quizData.quizName,
      category: quizData.category
    };

    const questions: QuizQuestion[] = quizData.questions.map(q => ({
      text: q.questionText,
      type: this.mapQuestionType(q.questionType),
      difficulty: 'Medium' as Difficulty,
      category: quizData.category,
      tags: [],
      timerSeconds: null,
      options: q.options.map(o => ({
        text: o.optionText,
        isCorrect: o.isCorrect
      }))
    }));

    // Validate complete quiz
    const validation = this.validationService.validateQuizForCreation(quiz, questions);
    if (!validation.isValid) {
      throw new Error(`Quiz validation failed: ${validation.errors.join(', ')}`);
    }

    return this.quizCreationService.createQuiz(quiz, questions);
  }

  /** Helper methods */
  removeQuestion(index: number): void {
    this._questions.update(list => list.filter((_, i) => i !== index));
  }

  updateQuestion(index: number, updatedQuestion: QuizQuestion): void {
    // Validate updated question
    const validation = this.validationService.validateQuestion(
      updatedQuestion.text,
      updatedQuestion.type,
      updatedQuestion.options
    );

    if (!validation.isValid) {
      throw new Error(`Question validation failed: ${validation.errors.join(', ')}`);
    }

    this._questions.update(list => {
      const newList = [...list];
      if (index >= 0 && index < newList.length) {
        newList[index] = this.normalizeQuestion(updatedQuestion);
      }
      return newList;
    });
  }

  clearAll(): void {
    this._quizMeta.set(null);
    this._questions.set([]);
  }

  // ===== API Operations (delegated to QuizCreationService) =====
  async getHostQuizzes(hostName: string) {
    return this.quizCreationService.getHostQuizzes(hostName);
  }

  async getQuizForEdit(quizId: number) {
    return this.quizCreationService.getQuizForEdit(quizId);
  }

  async updateQuiz(quizId: number, payload: any) {
    return this.quizCreationService.updateQuiz(quizId, payload);
  }

  async updateQuestionOnServer(questionId: number, questionData: any) {
    return this.quizCreationService.updateQuestion(questionId, questionData);
  }

  async deleteQuestionFromServer(questionId: number) {
    return this.quizCreationService.deleteQuestion(questionId);
  }

  async deleteQuiz(quizId: number) {
    return this.quizCreationService.deleteQuiz(quizId);
  }

  async publishQuiz(quizId: number) {
    return this.quizCreationService.publishQuiz(quizId);
  }



  // ===== CSV Operations (delegated to CsvImportExportService) =====
  downloadSampleCSV(): void {
    this.csvService.downloadSampleCSV();
  }

  async importFromCSV(file: File): Promise<void> {
    const validation = this.csvService.validateCsvFile(file);
    if (!validation.isValid) {
      throw new Error(`CSV validation failed: ${validation.errors.join(', ')}`);
    }

    const questions = await this.csvService.importFromCSV(file);
    
    this._questions.set([]);
    questions.forEach(question => {
      const normalized = this.normalizeQuestion(question);
      this._questions.update(list => [...list, normalized]);
    });
  }

  exportToCSV(): void {
    const questions = this._questions();
    const quizMeta = this._quizMeta();
    this.csvService.exportToCSV(questions, quizMeta?.quizName);
  }

  // ===== Load Quiz for Editing =====
  loadQuizForEditing(quizDetails: QuizDetailsResponse): void {
    this._quizMeta.set({
      quizNumber: quizDetails.quizNumber,
      quizName: quizDetails.title,
      category: quizDetails.category
    });

    // Check if questions exist before mapping
    if (!quizDetails.questions || !Array.isArray(quizDetails.questions)) {
      console.warn('No questions found in quiz details, setting empty array');
      this._questions.set([]);
      return;
    }

    const questions: QuizQuestion[] = quizDetails.questions.map(q => ({
      questionId: parseInt(q.questionId),  // Keep the question ID for updates
      text: q.questionText,
      type: this.mapBackendTypeToFrontend(q.type) as QuestionType,
      difficulty: q.difficulty as Difficulty,
      category: q.category,
      timerSeconds: q.timeLimit || null,
      tags: [],
      options: q.options?.map(opt => ({
        optionId: parseInt(opt.optionId),  // Keep the option ID for updates
        text: opt.optionText,
        isCorrect: opt.isCorrect
      })) || []
    }));

    this._questions.set(questions);
  }

  // Map backend question type to frontend format
  private mapBackendTypeToFrontend(backendType: string): string {
    switch (backendType) {
      case 'MCQ': return 'Multiple Choice';
      case 'TrueFalse': return 'True/False';
      case 'ShortAnswer': return 'Short Answer';
      default: return 'Multiple Choice';
    }
  }

  // ===== Preview Helper =====
  async publishPreviewPayload() {
    const quiz = this._quizMeta();
    const questions = this._questions();
    if (!quiz || questions.length === 0) return null;
    return { quiz, questions };
  }

  // ===== Validation Helpers =====
  validateQuestion(text: string, type: QuestionType, options: any[]): ValidationResult {
    return this.validationService.validateQuestion(text, type, options);
  }

  validateQuizForCreation(): ValidationResult {
    const quiz = this._quizMeta();
    const questions = this._questions();
    return this.validationService.validateQuizForCreation(quiz, questions);
  }

  // ===== Private Helper Methods =====
  private generatePreviewQuizNumber(categoryRaw: string): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear() % 100).padStart(2, '0');

    const category = (categoryRaw ?? 'GENERAL')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    
    const seq = Math.floor(Math.random() * 9999) + 1;
    const alpha = 'A';
    const numeric = String(seq).padStart(4, '0');
    
    return `Quiz_${category}_${dd}${mm}${yy}_${alpha}${numeric}`;
  }

  private normalizeQuestion(payload: QuizQuestion): QuizQuestion {
    return {
      ...payload,
      text: payload.text.trim(),
      category: payload.category.trim(),
      tags: Array.from(new Set(payload.tags.map(t => t.trim()).filter(Boolean))),
      options: (payload.options ?? []).map(o => ({
        text: o.text.trim(),
        isCorrect: !!o.isCorrect,
      })),
    };
  }

  private mapQuestionType(type: string): QuestionType {
    switch (type?.toUpperCase()) {
      case 'MCQ': 
      case 'MULTIPLE CHOICE': 
        return 'Multiple Choice';
      case 'TF':
      case 'TRUE/FALSE':
        return 'True/False';
      case 'SA':
      case 'SHORT ANSWER':
        return 'Short Answer';
      default: 
        return 'Multiple Choice';
    }
  }
}
