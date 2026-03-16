import { Component, inject, signal, computed, effect, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  Validators,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  AddQuestionService,
  QuizQuestion,
  QuestionType,
  Difficulty,
} from '../../services/add-question.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { QrcodeComponent } from '../qrcode/qrcode.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TutorialService, TutorialStep } from '../../services/tutorial.service';

type OptionForm = FormGroup<{
  text: FormControl<string>;
  correct: FormControl<boolean>;
}>;

type AddQuestionForm = FormGroup<{
  quizName: FormControl<string>;
  question: FormControl<string>;
  options: FormArray<OptionForm>;
  type: FormControl<QuestionType>;
  difficulty: FormControl<Difficulty>;
  category: FormControl<string>;
  tags: FormArray<FormControl<string>>;
  timerSeconds: FormControl<number | null>;
}>;

@Component({
  selector: 'app-add-question',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QrcodeComponent, MatSnackBarModule],
  templateUrl: './add-question.component.html',
  styleUrls: ['./add-question.component.css'],
})
export class AddQuestionComponent implements AfterViewInit {
  private fb = inject(FormBuilder);
  private store = inject(AddQuestionService);
  private snackBar = inject(MatSnackBar);
  private dashboardStatsService = inject(DashboardStatsService);
  private router = inject(Router);
  private tutorialService = inject(TutorialService);

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'Other') {
      this.showCategoryInput.set(true);
      this.form.controls.category.setValue('');
    } else {
      this.showCategoryInput.set(false);
      this.form.controls.category.setValue(value);
    }
  }

  // Header properties
  hostName = 'Quiz Master'; // You can make this dynamic later
  currentDateTime = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  readonly questionTypes = ['Multiple Choice', 'True/False', 'Short Answer'] as const;
  readonly difficulties = ['Easy', 'Medium', 'Hard'] as const;
  
  readonly categories = [
    'Java',
    'Database',
    'Angular',
    'Python',
    'JavaScript',
    'Human Resource',
    'Dotnet',
    'Data Structure',
    'C++',
    'HTML/CSS',
    'Machine Learning',
    'Artificial Intelligence',
    'Cloud Computing',
    'Networking',
    'Security',
    'Testing',
    'DevOps',
    'Agile',
    'Project Management',
    'UI/UX Design',
    'Mobile Development',
    'Data Science',
    'Big Data',
    'React',
    'Node.js',
    'Other'
  ] as const;

  showCategoryInput = signal(false);
  suggestionsOpen = signal(false);
  csvStatus = signal<string>('');

  /** Quiz creation result for QR display */
  isQuizCreated = signal<boolean>(false);
  createdQuizNumber = signal<string>('');
  createdQuizId = signal<string | number>('');

  /** Shared signals from the store (for summary/preview sidebar) */
  readonly quizMeta = computed(() => this.store.quizMeta());
  readonly questions = computed(() => this.store.questions());

  // Tutorial properties
  readonly tutorialActive = computed(() => this.tutorialService.isActive());
  readonly currentTutorialStep = computed(() => this.tutorialService.currentStep());
  readonly tutorialSteps = computed(() => this.tutorialService.steps());

  private tutorialStepDefinitions: TutorialStep[] = [
    {
      id: 'template',
      title: '📋 Use Templates',
      description: 'Click the Template button to choose from pre-built quiz templates and get started quickly!',
      targetElement: '.template-btn',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'quiz-name',
      title: '📝 Quiz Name',
      description: 'Enter a descriptive name for your quiz. This will help participants understand what the quiz is about.',
      targetElement: 'input[formControlName="quizName"]',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'add-question',
      title: '❓ Add Questions',
      description: 'Create questions here! Choose the type, add your question text, and set up answer options.',
      targetElement: '.add-question-card',
      position: 'left',
      skipable: true
    },
    {
      id: 'csv-import',
      title: '📁 CSV Import',
      description: 'Want to add multiple questions at once? Use CSV import to upload questions from a spreadsheet!',
      targetElement: '.csv-import-card',
      position: 'top',
      skipable: true
    }
  ];

  /** create a typed option form group */
  private newOption(placeholder: string): OptionForm {
    return this.fb.group({
      text: this.fb.nonNullable.control<string>(placeholder, { validators: [Validators.required] }),
      correct: this.fb.nonNullable.control<boolean>(false),
    });
  }

  /** root form (typed) */
  form: AddQuestionForm = this.fb.group({
    quizName: this.fb.nonNullable.control<string>('', {
      validators: [Validators.required, Validators.minLength(2)]
    }),
    question: this.fb.nonNullable.control<string>('', {
      validators: [Validators.required, Validators.minLength(10)],
    }),
    options: this.fb.array<OptionForm>([
      this.newOption('Option 1'),
      this.newOption('Option 2'),
    ]),
    type: this.fb.nonNullable.control<QuestionType>('Multiple Choice'),
    difficulty: this.fb.nonNullable.control<Difficulty>('Medium'),
    category: this.fb.nonNullable.control<string>(''),
    tags: this.fb.array<FormControl<string>>([]),
    timerSeconds: this.fb.control<number | null>(30, { validators: [Validators.min(5), Validators.max(300)] }),
  });

  /** typed getters for template */
  get options(): FormArray<OptionForm> {
    return this.form.controls.options;
  }
  get tags(): FormArray<FormControl<string>> {
    return this.form.controls.tags;
  }

  /** Auto-fill for True/False; ensure at least two options for MCQ */
  constructor() {
    // Subscribe to type changes
    this.form.controls.type.valueChanges.subscribe((type) => {
      if (type === 'True/False') {
        this.options.clear();
        this.options.push(this.fb.group({
          text: this.fb.nonNullable.control<string>('True', { validators: [Validators.required] }),
          correct: this.fb.nonNullable.control<boolean>(true), // Default True as correct
        }));
        this.options.push(this.fb.group({
          text: this.fb.nonNullable.control<string>('False', { validators: [Validators.required] }),
          correct: this.fb.nonNullable.control<boolean>(false),
        }));
      } else if (type === 'Multiple Choice' && this.options.length < 2) {
        this.options.clear();
        const option1 = this.newOption('Option 1');
        option1.controls.correct.setValue(true); // Set first option as correct by default
        this.options.push(option1);
        this.options.push(this.newOption('Option 2'));
      } else if (type === 'Short Answer') {
        // Short Answer does not require options; keep UI hidden
        this.options.clear();
      }
    });

    // Keep quiz basics updated; store generates a PREVIEW quiz number
    effect(() => {
      const name = this.form.controls.quizName.value?.trim();
      const cat = this.form.controls.category.value?.trim();
      //  const duration = 30; // If you plan a quiz-level duration, bind a field; keeping 30 for now
      if (name && cat) {
        this.store.setQuizBasics(name, cat);
      }
    });
  }

  ngAfterViewInit(): void {
    // Start tutorial after view is fully initialized
    setTimeout(() => {
      this.startTutorial();
    }, 1000);
  }

  /** UI actions */
  toggleSuggestion(): void {
    this.suggestionsOpen.update((v) => !v);
  }

  openTemplate(): void {
    this.router.navigate(['/template']);
  }

  // Tutorial methods
  startTutorial(): void {
    if (this.tutorialService.shouldAutoStart('add-question')) {
      console.log('Auto-starting tutorial for add-question component');
      this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'add-question');
    } else {
      console.log('Tutorial already seen for add-question component');
    }
  }

  resetTutorial(): void {
    this.tutorialService.resetTutorial('add-question');
    this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'add-question');
  }

  nextTutorialStep(): void {
    this.tutorialService.nextStep();
  }

  previousTutorialStep(): void {
    this.tutorialService.previousStep();
  }

  skipTutorial(): void {
    localStorage.setItem('quiz-tutorial-seen', 'true');
    this.tutorialService.skipTutorial();
  }

  getCurrentStep(): TutorialStep | null {
    return this.tutorialService.getCurrentStepData();
  }

  getSpotlightPosition(): { top: string; left: string; width: string; height: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      console.log('No current step');
      return null;
    }

    const element = document.querySelector(currentStep.targetElement);
    if (!element) {
      console.log('Element not found:', currentStep.targetElement);
      return null;
    }

    const rect = element.getBoundingClientRect();
    console.log('Element found, rect:', rect);
    return {
      top: `${rect.top - 5}px`,
      left: `${rect.left - 5}px`,
      width: `${rect.width + 10}px`,
      height: `${rect.height + 10}px`
    };
  }

  getPopupPosition(): { top: string; left: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      console.log('No current step for popup');
      return null;
    }

    const element = document.querySelector(currentStep.targetElement);
    if (!element) {
      console.log('Element not found for popup:', currentStep.targetElement);
      return null;
    }

    const rect = element.getBoundingClientRect();
    const popupWidth = 350;
    const popupHeight = 200;

    let top = rect.top;
    let left = rect.left;

    switch (currentStep.position) {
      case 'bottom':
        top = rect.bottom + 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'top':
        top = rect.top - popupHeight - 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.left - popupWidth - 10;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.right + 10;
        break;
    }

    // Ensure popup stays within viewport
    if (left < 10) left = 10;
    if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
    if (top < 10) top = 10;
    if (top + popupHeight > window.innerHeight - 10) top = window.innerHeight - popupHeight - 10;

    console.log('Popup position calculated:', { top: `${top}px`, left: `${left}px` });
    return {
      top: `${top}px`,
      left: `${left}px`
    };
  }

  addOption(): void {
    if (this.form.controls.type.value === 'Short Answer') return;
    this.options.push(this.newOption(`Option ${this.options.length + 1}`));
  }
  removeOption(index: number): void {
    if (this.form.controls.type.value === 'Short Answer') return;
    if (this.options.length > 2) this.options.removeAt(index);
  }

  addTag(input: HTMLInputElement): void {
    const value = input.value.trim();
    if (value) {
      this.tags.push(this.fb.nonNullable.control<string>(value));
      input.value = '';
    }
  }
  removeTag(index: number): void {
    this.tags.removeAt(index);
  }

  /** CSV Functionality */
  downloadSampleCSV(): void {
    this.store.downloadSampleCSV();
    this.csvStatus.set('Sample CSV downloaded successfully!');
    setTimeout(() => this.csvStatus.set(''), 3000);
  }

  onCSVFileSelected(event: any): void {
    // Check if quiz name and category are filled
    const quizName = this.form.controls.quizName.value?.trim();
    const category = this.form.controls.category.value?.trim();

    if (!quizName || !category) {
      this.snackBar.open('⚠️ Please enter Quiz Name and Category before uploading CSV!', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      event.target.value = ''; // Clear the file input
      this.csvStatus.set('');
      return;
    }

    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      this.csvStatus.set('Importing...');
      this.store.importFromCSV(file)
        .then(() => {
          this.csvStatus.set(`Successfully imported ${this.questions().length} questions!`);
          setTimeout(() => this.csvStatus.set(''), 5000);
          // Clear the file input
          event.target.value = '';
        })
        .catch(error => {
          console.error('CSV import error:', error);
          this.csvStatus.set(`Import failed: ${error.message}`);
          setTimeout(() => this.csvStatus.set(''), 5000);
          event.target.value = '';
        });
    } else {
      this.csvStatus.set('Please select a valid CSV file.');
      setTimeout(() => this.csvStatus.set(''), 3000);
    }
  }

  exportToCSV(): void {
    try {
      this.store.exportToCSV();
      this.csvStatus.set('Questions exported to CSV successfully!');
      setTimeout(() => this.csvStatus.set(''), 3000);
    } catch (error: any) {
      this.csvStatus.set(`Export failed: ${error.message}`);
      setTimeout(() => this.csvStatus.set(''), 3000);
    }
  }

  /** validation helpers */
  hasAtLeastTwoOptions(): boolean {
    const type = this.form.controls.type.value;
    if (type === 'Short Answer') return true;
    return this.options.length >= 2;
  }

  /** Prevent 'e', 'E', '+', '-' in number input */
  preventInvalidInput(event: KeyboardEvent): void {
    const invalidKeys = ['e', 'E', '+', '-'];
    if (invalidKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  /** Clear placeholder text on focus */
  clearPlaceholderText(event: FocusEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    const currentValue = this.options.at(index).controls.text.value;

    // Clear if it's a default placeholder like "Option 1", "Option 2", etc.
    if (currentValue && currentValue.match(/^Option \d+$/)) {
      this.options.at(index).controls.text.setValue('');
    }
  }

  hasAtLeastOneCorrect(): boolean {
    const type = this.form.controls.type.value;
    if (type === 'Short Answer') return true;

    const correctValues = this.options.controls.map((opt, idx) => {
      const correctValue = opt.controls.correct.value;
      const textValue = opt.controls.text.value;
      return { index: idx, text: textValue, correct: correctValue, actualValue: correctValue };
    });

    const hasCorrect = this.options.controls.some((opt) => {
      const value = opt.controls.correct.value;
      return value === true;
    });

    console.log('[DEBUG] hasAtLeastOneCorrect check:', {
      type,
      optionsCount: this.options.controls.length,
      correctOptions: correctValues,
      hasCorrect,
      formArrayValue: this.options.value,
      rawFormValue: this.form.value
    });

    return hasCorrect;
  }
  disableAdd(): boolean {
    return (
      this.form.invalid ||
      !this.hasAtLeastTwoOptions() ||
      !this.hasAtLeastOneCorrect()
    );
  }

  /** submit: push one question to the store (preview updates instantly) */
  onSubmit(): void {
    const type = this.form.controls.type.value;

    console.log('[DEBUG] onSubmit started, question type:', type);

    if (!this.hasAtLeastTwoOptions()) {
      this.snackBar.open('⚠️ Please provide at least two options for Multiple Choice / True/False.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      this.form.markAllAsTouched();
      return;
    }

    // Re-check correct options right before validation
    const hasCorrectNow = this.hasAtLeastOneCorrect();
    console.log('[DEBUG] Final hasAtLeastOneCorrect check:', hasCorrectNow);

    if (!hasCorrectNow) {
      this.snackBar.open('⚠️ Please mark at least one option as correct.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: QuizQuestion = {
      text: this.form.controls.question.value,
      type,
      difficulty: this.form.controls.difficulty.value,
      category: this.form.controls.category.value,
      tags: this.tags.controls.map((t) => t.value),
      timerSeconds: this.form.controls.timerSeconds.value ?? null,
      options:
        type === 'Short Answer'
          ? []
          : this.options.controls.map((opt) => ({
            text: opt.controls.text.value,
            isCorrect: opt.controls.correct.value,
          })),
    };

    // Push to the shared store so Preview sees it immediately
    this.store.addQuestion(payload);

    // Update dashboard stats
    this.dashboardStatsService.incrementQuestionCount();

    // Reset only the question fields; keep quiz basics
    this.resetForm();
  }

  // Convenience boolean for enabling "Create Quiz" button
  readonly canPublish = computed(() => {
    const name = this.form.controls.quizName.value?.trim();
    const cat = this.form.controls.category.value?.trim();
    const hasQuestions = this.questions().length > 0;
    return !!name && !!cat && hasQuestions;
  });

  /**
   * Create from the Preview tab:
   *  - calls store.createQuiz() to POST quiz + 10 questions + options to MVC controller
   *  - server generates final quiz number
   */

  /**
   * Delete a question from the preview
   */
  deleteQuestion(index: number): void {
    const snackBarRef = this.snackBar.open(`Delete question #${index + 1}?`, 'Delete', {
      duration: 0,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });

    snackBarRef.onAction().subscribe(() => {
      this.store.removeQuestion(index);
    });
  }

  async publishFromPreview() {
    if (!this.canPublish()) return; // guard

    // Enforce 1-25 questions (matches server rule)
    const total = this.questions().length;
    if (total < 1 || total > 25) {
      this.snackBar.open(`⚠️ You need between 1 and 25 questions to create the quiz (you currently have ${total}).`, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    // Ensure quiz basics are set before creating
    const name = this.form.controls.quizName.value?.trim();
    const cat = this.form.controls.category.value?.trim();
    if (!name || !cat) {
      this.snackBar.open('⚠️ Please fill in both Quiz Name and Category fields.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }
    // Explicitly set quiz basics to ensure they're in the store
    this.store.setQuizBasics(name, cat);

    // Show confirmation snackbar
    const snackBarRef = this.snackBar.open(
      `Create Quiz: "${name}" | Category: ${cat} | Questions: ${total}`,
      'Confirm',
      {
        duration: 0,
        panelClass: ['confirm-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      }
    );

    const confirmed = await new Promise<boolean>((resolve) => {
      snackBarRef.onAction().subscribe(() => resolve(true));
      snackBarRef.afterDismissed().subscribe(() => resolve(false));
    });

    if (!confirmed) {
      return; // User cancelled
    }

    try {
      const res = await this.store.createQuiz();

      console.log('Full backend response:', res);

      // Backend returns data nested: { success, message, data: { quizNumber, quizId, ... } }
      const data = (res as any).data || res;
      const quizNumber = data.quizNumber;
      const quizId = data.quizId;

      if (quizNumber) {
        this.createdQuizNumber.set(quizNumber.toString());
        this.createdQuizId.set(quizId);
        this.isQuizCreated.set(true);

        this.snackBar.open(
          `✅ Quiz Created Successfully! | Quiz Number: ${quizNumber} | Quiz ID: ${quizId}`,
          'Close',
          {
            duration: 8000,
            panelClass: ['success-snackbar'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );

        // Scroll to show QR code
        setTimeout(() => {
          const qrElement = document.querySelector('app-qrcode');
          if (qrElement) {
            qrElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      } else {
        this.snackBar.open(
          '⚠️ Quiz created but no Quiz Number returned from server.',
          'Close',
          {
            duration: 5000,
            panelClass: ['error-snackbar'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );
      }

      console.log(`SUCCESS: Quiz Created!\nQuiz Number: ${quizNumber}\nQuiz ID: ${quizId}`);
    } catch (err: any) {
      console.error(err);
      this.snackBar.open(
        `❌ Failed to create quiz: ${err?.message ?? 'Unknown error'}`,
        'Close',
        {
          duration: 6000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        }
      );
    }
  }


  private resetForm(): void {
    this.form.patchValue({
      question: '',
      type: 'Multiple Choice',
      difficulty: 'Medium',
      timerSeconds: null,
    });
    // Reset options to 2 blank rows
    this.options.clear();
    this.options.push(this.newOption(''));
    this.options.push(this.newOption(''));
    // Clear tags
    this.tags.clear();
  }

  /**
   * Reset the entire form including quiz name and category
   * Used after successfully creating a quiz to prevent duplicates
   */
  private resetCompleteForm(): void {
    this.form.reset({
      quizName: '',
      question: '',
      type: 'Multiple Choice',
      difficulty: 'Medium',
      category: '',
      timerSeconds: null,
    });
    // Reset options to 2 blank rows
    this.options.clear();
    this.options.push(this.newOption('Option 1'));
    this.options.push(this.newOption('Option 2'));
    // Clear tags
    this.tags.clear();
  }


  /** Reset QR display for creating a new quiz */
  startNewQuiz() {
    this.isQuizCreated.set(false);
    this.createdQuizNumber.set('');
    this.createdQuizId.set('');
    this.store.clearAll();
    this.resetCompleteForm();
  }
}
