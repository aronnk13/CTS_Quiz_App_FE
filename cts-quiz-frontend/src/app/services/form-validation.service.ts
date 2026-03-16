// src/app/services/form-validation.service.ts
import { Injectable } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { QuizQuestion, QuestionType, Difficulty } from '../models/quiz.models';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface QuestionValidationResult extends ValidationResult {
  hasMinimumOptions: boolean;
  hasCorrectAnswer: boolean;
  hasValidText: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FormValidationService {

  /**
   * Validate quiz basics (name, category)
   */
  validateQuizBasics(quizName: string, category: string): ValidationResult {
    const errors: string[] = [];

    if (!quizName?.trim()) {
      errors.push('Quiz name is required');
    } else if (quizName.trim().length < 3) {
      errors.push('Quiz name must be at least 3 characters long');
    }

    if (!category?.trim()) {
      errors.push('Category is required');
    } else if (category.trim().length < 2) {
      errors.push('Category must be at least 2 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate question form data
   */
  validateQuestion(
    questionText: string, 
    type: QuestionType, 
    options: { text: string; isCorrect: boolean }[]
  ): QuestionValidationResult {
    const errors: string[] = [];
    
    // Validate question text
    const hasValidText = this.validateQuestionText(questionText);
    if (!hasValidText.isValid) {
      errors.push(...hasValidText.errors);
    }

    // Validate options based on question type
    const hasMinimumOptions = this.hasMinimumRequiredOptions(type, options);
    if (!hasMinimumOptions) {
      errors.push(this.getMinimumOptionsError(type));
    }

    // Validate correct answers
    const hasCorrectAnswer = this.hasAtLeastOneCorrectAnswer(type, options);
    if (!hasCorrectAnswer && type !== 'Short Answer') {
      errors.push('At least one option must be marked as correct');
    }

    return {
      isValid: errors.length === 0,
      errors,
      hasMinimumOptions,
      hasCorrectAnswer,
      hasValidText: hasValidText.isValid
    };
  }

  /**
   * Validate question text
   */
  private validateQuestionText(text: string): ValidationResult {
    const errors: string[] = [];

    if (!text?.trim()) {
      errors.push('Question text is required');
    } else if (text.trim().length < 10) {
      errors.push('Question text must be at least 10 characters long');
    } else if (text.trim().length > 500) {
      errors.push('Question text must be less than 500 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if question has minimum required options based on type
   */
  hasMinimumRequiredOptions(type: QuestionType, options: { text: string; isCorrect: boolean }[]): boolean {
    const validOptions = options.filter(opt => opt.text?.trim());

    switch (type) {
      case 'Multiple Choice':
        return validOptions.length >= 2;
      case 'True/False':
        return validOptions.length === 2;
      case 'Short Answer':
        return true; // No options required
      default:
        return false;
    }
  }

  /**
   * Check if at least one option is marked as correct
   */
  hasAtLeastOneCorrectAnswer(type: QuestionType, options: { text: string; isCorrect: boolean }[]): boolean {
    if (type === 'Short Answer') {
      return true; // Short answer doesn't need correct option marking
    }

    return options.some(opt => opt.isCorrect && opt.text?.trim());
  }

  /**
   * Get minimum options error message based on question type
   */
  private getMinimumOptionsError(type: QuestionType): string {
    switch (type) {
      case 'Multiple Choice':
        return 'Multiple Choice questions must have at least 2 options';
      case 'True/False':
        return 'True/False questions must have exactly 2 options';
      case 'Short Answer':
        return ''; // No options required
      default:
        return 'Invalid question type';
    }
  }

  /**
   * Validate option text
   */
  validateOptionText(text: string): ValidationResult {
    const errors: string[] = [];

    if (!text?.trim()) {
      errors.push('Option text is required');
    } else if (text.trim().length > 200) {
      errors.push('Option text must be less than 200 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate timer seconds
   */
  validateTimer(seconds: number | null): ValidationResult {
    const errors: string[] = [];

    if (seconds !== null && seconds < 0) {
      errors.push('Timer cannot be negative');
    }

    if (seconds !== null && seconds > 3600) {
      errors.push('Timer cannot exceed 1 hour (3600 seconds)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate tags array
   */
  validateTags(tags: string[]): ValidationResult {
    const errors: string[] = [];

    if (tags.length > 10) {
      errors.push('Maximum 10 tags allowed');
    }

    const invalidTags = tags.filter(tag => !tag.trim() || tag.trim().length > 50);
    if (invalidTags.length > 0) {
      errors.push('Each tag must be 1-50 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate complete quiz before creation
   */
  validateQuizForCreation(quiz: any, questions: QuizQuestion[]): ValidationResult {
    const errors: string[] = [];

    // Validate quiz basics
    const basicValidation = this.validateQuizBasics(quiz?.quizName, quiz?.category);
    if (!basicValidation.isValid) {
      errors.push(...basicValidation.errors);
    }

    // Validate question count
    if (questions.length < 1) {
      errors.push('At least 1 question is required');
    } else if (questions.length > 25) {
      errors.push('Maximum 25 questions allowed');
    }

    // Validate each question
    questions.forEach((question, index) => {
      const questionValidation = this.validateQuestion(
        question.text, 
        question.type, 
        question.options
      );
      
      if (!questionValidation.isValid) {
        errors.push(`Question ${index + 1}: ${questionValidation.errors.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get real-time form status for UI feedback
   */
  getFormStatus(form: FormGroup): {
    isValid: boolean;
    canSubmit: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (form.invalid) {
      Object.keys(form.controls).forEach(key => {
        const control = form.get(key);
        if (control?.invalid && control?.touched) {
          errors.push(`${key} is invalid`);
        }
      });
    }

    return {
      isValid: form.valid,
      canSubmit: form.valid && !form.pending,
      errors,
      warnings
    };
  }
}