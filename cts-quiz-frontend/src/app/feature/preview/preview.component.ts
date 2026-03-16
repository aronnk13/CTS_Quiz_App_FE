import { Component, inject, computed, signal, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AddQuestionService, QuizQuestion, QuizListItem } from '../../services/add-question.service';
import { AuthService } from '../../services/auth.service';
import { PublishNotificationService } from '../../services/publish-notification.service';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { QrcodeComponent } from '../qrcode/qrcode.component';

@Component({
  selector: 'app-preview',
  imports: [CommonModule, FormsModule, LoaderComponent, QrcodeComponent],
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.css'
})
export class PreviewComponent implements OnInit, OnDestroy {
  private store = inject(AddQuestionService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private publishNotificationService = inject(PublishNotificationService);
  
  private destroy$ = new Subject<void>();
  @Output() switchToQuestionsTab = new EventEmitter<void>();
  
  quizMeta = computed(() => this.store.quizMeta());
  questions = computed(() => this.store.questions());
  
  editingQuestionIndex = signal<number | null>(null);
  editingQuestion = signal<QuizQuestion | null>(null);
  
  // Expose String for template
  protected readonly String = String;
  
  // Search functionality
  searchQuery = signal<string>('');
  
  // New properties for managing existing quizzes
  hostQuizzes = signal<QuizListItem[]>([]);
  
  // Filtered quizzes based on search
  filteredQuizzes = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.hostQuizzes();
    }
    
    return this.hostQuizzes().filter(quiz => 
      quiz.quizName.toLowerCase().includes(query) ||
      quiz.quizNumber.toLowerCase().includes(query) ||
      (quiz.category && quiz.category.toLowerCase().includes(query))
    );
  });
  
  showQuizList = signal(true);
  loadingQuizzes = signal(false);
  currentHostName = this.authService.currentUser()?.employeeId || ''; // Get from logged-in user
  showQRForQuizId = signal<number | null>(null);
  currentEditingQuizId = signal<number | null>(null); // Track currently editing quiz

  ngOnInit(): void {
    this.loadHostQuizzes();
    
    // Subscribe to publish notifications
    this.publishNotificationService.publishedQuiz$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (event) => {
        console.log('📢 New quiz published:', event);
        // Reload quizzes to get the newly published quiz
        await this.loadHostQuizzes();
        // Optionally auto-load the newly published quiz
        const newQuiz = this.hostQuizzes().find(q => q.quizId === event.quizId);
        if (newQuiz) {
          console.log('✅ Auto-loading newly published quiz:', newQuiz);
          await this.loadQuizForEditing(event.quizId);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadHostQuizzes(): Promise<void> {
    this.loadingQuizzes.set(true);
    try {
      const quizzes = await this.store.getHostQuizzes(this.currentHostName);
      this.hostQuizzes.set(quizzes);
    } catch (error) {
      console.error('Failed to load host quizzes:', error);
      alert('Failed to load your quizzes.');
    } finally {
      this.loadingQuizzes.set(false);
    }
  }

  async loadQuizForEditing(quizId: number): Promise<void> {
    try {
      const quizDetails = await this.store.getQuizForEdit(quizId);
      this.store.loadQuizForEditing(quizDetails);
      this.currentEditingQuizId.set(quizId); // Track which quiz we're editing
      this.showQuizList.set(false);
      this.cancelEdit(); // Close any ongoing edits
    } catch (error) {
      console.error('Failed to load quiz for editing:', error);
      alert('Failed to load quiz for editing.');
    }
  }

  startNewQuiz(): void {
    this.store.clearAll();
    this.cancelEdit();
    // Navigate to quiz creation page instead of just emitting event
    this.router.navigate(['host/create-question'], { queryParams: { tab: 'questions' } });
  }

  backToQuizList(): void {
    this.showQuizList.set(true);
    this.cancelEdit();
    this.loadHostQuizzes(); // Refresh the list
  }

  startEditQuestion(index: number): void {
    const question = this.questions()[index];
    this.editingQuestionIndex.set(index);
    // Create a deep copy for editing
    this.editingQuestion.set({
      ...question,
      options: question.options.map(opt => ({ ...opt }))
    });
  }

  onQuestionTypeChange(): void {
    const question = this.editingQuestion();
    if (question && question.type === 'True/False') {
      // Enforce exactly 2 options for True/False
      question.options = [
        { text: 'True', isCorrect: false },
        { text: 'False', isCorrect: false }
      ];
      this.editingQuestion.set({ ...question });
    }
  }

  isTrueFalseQuestion(): boolean {
    const question = this.editingQuestion();
    return question?.type === 'True/False';
  }

  cancelEdit(): void {
    this.editingQuestionIndex.set(null);
    this.editingQuestion.set(null);
  }

  async saveQuestion(): Promise<void> {
    const index = this.editingQuestionIndex();
    const editedQuestion = this.editingQuestion();
    
    if (index !== null && editedQuestion) {
      // Check if this is an existing question with a questionId
      if (editedQuestion.questionId) {
        try {
          // Map frontend question to backend format with options
          const updatePayload = {
            questionText: editedQuestion.text,
            questionType: this.mapQuestionType(editedQuestion.type),
            category: editedQuestion.category,
            difficultyLevel: editedQuestion.difficulty,
            updatedBy: this.currentHostName,
            status: 'Active',
            tags: editedQuestion.tags.join(',') || '',
            options: editedQuestion.options?.map(opt => ({
              optionId: opt.optionId || null,  // Include optionId for existing options, null for new ones
              optionText: opt.text,
              isCorrect: opt.isCorrect
            })) || []
          };

          console.log('=== SAVING QUESTION ===');
          console.log('Question ID:', editedQuestion.questionId);
          console.log('Update Payload:', updatePayload);
          
          const response = await this.store.updateQuestionOnServer(editedQuestion.questionId, updatePayload);
          console.log('Backend Response:', response);
          
          // Close edit mode first
          this.cancelEdit();
          
          // Reload the quiz from server to get fresh data
          const currentQuizId = this.currentEditingQuizId();
          if (currentQuizId) {
            console.log('Reloading quiz ID:', currentQuizId);
            
            // Add small delay to ensure database is updated
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Reload quiz
            await this.loadQuizForEditing(currentQuizId);
            console.log('Quiz reloaded successfully');
            
            alert('Question and options updated successfully!');
          } else {
            console.error('No current quiz ID found');
            alert('Question updated but could not refresh display. Please reload manually.');
          }
        } catch (error: any) {
          console.error('Failed to update question:', error);
          alert(`Failed to update question: ${error?.message || 'Unknown error'}`);
        }
      } else {
        // For new questions (not yet saved to backend), just update local state
        this.store.updateQuestion(index, editedQuestion);
        this.cancelEdit();
      }
    }
  }

  async deleteQuestion(index: number): Promise<void> {
    const question = this.questions()[index];
    
    if (confirm(`Are you sure you want to delete question #${index + 1}?`)) {
      // Check if this is an existing question (has questionId) or a new unsaved question
      if (question.questionId) {
        try {
          // Delete from backend first
          await this.store.deleteQuestionFromServer(question.questionId);
          // Only update UI after successful backend deletion
          this.store.removeQuestion(index);
          this.cancelEdit();
          alert('Question deleted successfully!');
        } catch (error: any) {
          console.error('Failed to delete question:', error);
          alert(`Failed to delete question from server: ${error?.message || 'Unknown error'}`);
        }
      } else {
        // For new unsaved questions, just remove from UI
        this.store.removeQuestion(index);
        this.cancelEdit();
      }
    }
  }

  async deleteQuiz(): Promise<void> {
    const quizId = this.currentEditingQuizId();
    const meta = this.quizMeta();
    
    if (!quizId || !meta) {
      alert('No quiz selected for deletion.');
      return;
    }

    const confirmMessage = `Are you sure you want to DELETE this entire quiz?\n\nQuiz: "${meta.quizName}"\nQuiz Number: ${meta.quizNumber}\n\n⚠️ This action cannot be undone!`;
    
    if (confirm(confirmMessage)) {
      try {
        await this.store.deleteQuiz(quizId);
        alert('Quiz deleted successfully!');
        this.backToQuizList();
      } catch (error: any) {
        console.error('Failed to delete quiz:', error);
        alert(`Failed to delete quiz: ${error?.message || 'Unknown error'}`);
      }
    }
  }

  async deleteQuizFromLibrary(quizId: number, quizName: string): Promise<void> {
    const confirmMessage = `Are you sure you want to DELETE this quiz?\n\nQuiz: "${quizName}"\n\n⚠️ This will delete the quiz and all its questions permanently!\nThis action cannot be undone!`;
    
    if (confirm(confirmMessage)) {
      try {
        await this.store.deleteQuiz(quizId);
        alert('Quiz deleted successfully!');
        // Refresh the quiz list
        await this.loadHostQuizzes();
      } catch (error: any) {
        console.error('Failed to delete quiz:', error);
        alert(`Failed to delete quiz: ${error?.message || 'Unknown error'}`);
      }
    }
  }

  addOption(): void {
    const question = this.editingQuestion();
    if (question) {
      question.options.push({ text: '', isCorrect: false });
      this.editingQuestion.set({ ...question });
    }
  }

  removeOption(optionIndex: number): void {
    const question = this.editingQuestion();
    if (question && question.options.length > 1) {
      question.options.splice(optionIndex, 1);
      this.editingQuestion.set({ ...question });
    }
  }

  setCorrectOption(optionIndex: number): void {
    const question = this.editingQuestion();
    if (question) {
      question.options.forEach((opt, idx) => {
        opt.isCorrect = idx === optionIndex;
      });
      this.editingQuestion.set({ ...question });
    }
  }

  async createQuiz(): Promise<void> {
    const meta = this.quizMeta();
    const questions = this.questions();
    
    if (!meta || questions.length === 0) {
      alert('Please add quiz details and at least one question.');
      return;
    }

    const confirmMessage = `Create Quiz: "${meta.quizName}"\n\nCategory: ${meta.category}\nQuestions: ${questions.length}\n\nAre you sure you want to create this quiz?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const res = await this.store.createQuiz();
      alert(`SUCCESS: Quiz Created!\n\nQuiz Number: ${res.quizNumber}\nQuiz ID: ${res.quizId}\nQuestions: ${res.questionCount}`);
      
      // Clear everything after successful creation
      this.store.clearAll();
      this.cancelEdit();
    } catch (err: any) {
      console.error(err);
      alert(`ERROR: Failed to create quiz\n\n${err?.message ?? 'Unknown error'}`);
    }
  }

  toggleQR(quizId: number): void {
    if (this.showQRForQuizId() === quizId) {
      this.showQRForQuizId.set(null);
    } else {
      this.showQRForQuizId.set(quizId);
    }
  }

  getQuizNumber(quizId: number): string {
    const quiz = this.hostQuizzes().find(q => q.quizId === quizId);
    return quiz?.quizNumber || '';
  }

  /**
   * Map question type from frontend to backend format
   */
  private mapQuestionType(type: string): string {
    switch (type) {
      case 'Multiple Choice': return 'MCQ';
      case 'True/False': return 'TrueFalse';
      case 'Short Answer': return 'ShortAnswer';
      default: return 'MCQ';
    }
  }
}
