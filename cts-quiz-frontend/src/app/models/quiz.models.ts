// src/app/models/quiz.models.ts

/** ===== Domain Models ===== */

export type QuestionType = 'Multiple Choice' | 'True/False' | 'Short Answer';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuizOption {
  optionId?: number;  // For existing options from backend
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  questionId?: number;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  category: string;
  tags: string[];
  timerSeconds: number | null;
  options: QuizOption[];         // empty for Short Answer
}

export interface QuizMeta {
  quizNumber: string;            // Preview-only; server overwrites on create
  quizName: string;
  category: string;
}

export interface QuizListItem {
  quizId: number;
  quizNumber: string;
  quizName: string;
  category: string;
  questionCount: number;
  createdAt: string;
  status: string;
}

export interface QuizDetailsResponse {
  quizId: string;
  quizNumber: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  timeLimit: number;
  questions: {
    questionId: string;
    questionText: string;
    type: string;
    difficulty: string;
    category: string;
    timeLimit: number;
    options: {
      optionId: string;
      optionText: string;
      isCorrect: boolean;
    }[];
  }[];
}

export interface PublishPayload {
  quiz: QuizMeta;
  questions: QuizQuestion[];
}

export interface CreateQuizResponse {
  quizId: number;
  quizNumber: string;
  questionCount: number;
}

/** New interfaces for direct JSON quiz creation */
export interface QuizOptionInput {
  optionText: string;
  isCorrect: boolean;
}

export interface QuizQuestionInput {
  questionText: string;
  questionType: string; // "MCQ", "TF", "SA"
  options: QuizOptionInput[];
}

export interface DirectQuizInput {
  quizName: string;
  category: string;
  templateId?: number;
  createdBy: string;
  status?: string;
  questions: QuizQuestionInput[];
}