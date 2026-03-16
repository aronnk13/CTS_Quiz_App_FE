import { Component, OnInit, OnDestroy, Output, EventEmitter, AfterViewInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { SurveyService } from '../../services/survey.service';
import { SignalrService } from '../../services/signalr.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { CreateSurveyApiRequest, CreateSurveyQuestionApiRequest, CreateSessionRequest, PublishSurveyRequest } from '../../models/isurvey';
import { AddQuestionService, QuizQuestion, QuestionType } from '../../services/add-question.service';
import { TutorialService, TutorialStep } from '../../services/tutorial.service';

@Component({
  selector: 'app-create-survey',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, QRCodeComponent],
  templateUrl: './create-survey.component.html',
  styleUrls: ['./create-survey.component.css']
})
export class CreateSurveyComponent implements OnInit, OnDestroy, AfterViewInit {
  surveyForm!: FormGroup;
  sessionId: number | null = null;
  loading = false;
  isPreviewMode = false;
  employeeId = 1; // Map this to your actual Auth user ID
  
  // QR Code properties
  showQrCode = false;
  surveyUrl = '';
  qrCodeValue = '';
  createdSurveyId: number | null = null;
  
  // Header properties
  hostName = 'Survey Host'; // You can make this dynamic later
  currentDateTime = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  @Output() switchToQuestionsTab = new EventEmitter<void>();

  // Tutorial properties
  private tutorialService = inject(TutorialService);
  readonly tutorialActive = computed(() => this.tutorialService.isActive());
  readonly currentTutorialStep = computed(() => this.tutorialService.currentStep());
  readonly tutorialSteps = computed(() => this.tutorialService.steps());

  private tutorialStepDefinitions: TutorialStep[] = [
    {
      id: 'survey-title',
      title: '📝 Survey Title',
      description: 'Enter a descriptive title for your survey. This will help participants understand the survey topic.',
      targetElement: 'input[formControlName="title"]',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'add-questions',
      title: '❓ Add Questions',
      description: 'Create your survey questions here. Choose different question types like single choice, rating, or text.',
      targetElement: '.builder-card.border-top-blue',
      position: 'left',
      skipable: true
    },
    {
      id: 'question-types',
      title: '🔽 Question Types',
      description: 'Select the type of question: Single Choice, Rating (1-5 stars), or Short Text responses.',
      targetElement: 'select[formControlName="type"]',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'publish-survey',
      title: '🚀 Publish Survey',
      description: 'Once you\'re done creating questions, publish your survey to make it available to participants!',
      targetElement: '.btn-success',
      position: 'top',
      skipable: true
    }
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService,
    private signalrService: SignalrService,
    private addQuestionService: AddQuestionService,
    private dashboardStatsService: DashboardStatsService
  ) {}

  ngOnInit(): void {
    const routeId = this.route.snapshot.params['sessionId'];
    this.sessionId = routeId ? +routeId : null;
    this.initForm();
  }

  initForm(): void {
    this.surveyForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      isAnonymous: [false],
      questions: this.fb.array([])
    });
    this.addQuestion();
  }

  get questions(): FormArray {
    return this.surveyForm.get('questions') as FormArray;
  }

  getOptions(index: number): FormArray {
    return this.questions.at(index).get('options') as FormArray;
  }

  addQuestion(): void {
    const questionGroup = this.fb.group({
      text: ['', Validators.required],
      type: ['single_choice', Validators.required],
      isRequired: [true],
      scaleMin: [1],
      scaleMax: [5],
      options: this.fb.array([
        this.fb.control('', Validators.required),
        this.fb.control('', Validators.required)
      ])
    });
    this.questions.push(questionGroup);
  }

  getQuestionTypeLabel(typeValue: string): string {
    const types: { [key: string]: string } = {
      'single_choice': 'Single Choice',
      'multiple_choice': 'Multiple Choice',
      'ranking': 'Ranking',
      'rating': 'Rating (1-5)',
      'text': 'Short Text'
    };
    return types[typeValue] || typeValue;
  }

  onQuestionTypeChange(questionIndex: number): void {
    const question = this.questions.at(questionIndex);
    const questionType = question.get('type')?.value;
    const optionsArray = question.get('options') as FormArray;

    // If question type requires options (single_choice, multiple_choice, ranking)
    if (questionType === 'single_choice' || questionType === 'multiple_choice' || questionType === 'ranking') {
      // Ensure options array has at least 2 options
      if (optionsArray.length === 0) {
        optionsArray.push(this.fb.control('', Validators.required));
        optionsArray.push(this.fb.control('', Validators.required));
      }
    } else {
      // For rating and text questions, clear the options array
      optionsArray.clear();
    }
  }

  onPublish(): void {
    // Debug: Log form validity and errors
    console.log('Survey form valid?', this.surveyForm.valid);
    console.log('Survey form errors:', this.surveyForm.errors);
    console.log('Survey form value:', this.surveyForm.value);
    for (let i = 0; i < this.questions.length; i++) {
      const q = this.questions.at(i);
      console.log(`Question ${i + 1} valid?`, q.valid, 'errors:', q.errors, 'value:', q.value);
      if (q.get('options')) {
        const opts = q.get('options') as FormArray;
        for (let oi = 0; oi < opts.length; oi++) {
          console.log(`  Option ${oi + 1} valid?`, opts.at(oi).valid, 'errors:', opts.at(oi).errors, 'value:', opts.at(oi).value);
        }
      }
    }

    // Get form values directly
    const formValue = this.surveyForm.getRawValue();
    const title = formValue.title?.trim();
    const questions = formValue.questions || [];

    // Basic validation
    if (!title || title.length < 3) {
      alert('Survey title must be at least 3 characters');
      return;
    }

    if (!questions || questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.text || !q.text.trim()) {
        alert(`Question ${i + 1}: Text is required`);
        return;
      }

      // Only validate options for question types that need them
      if (q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'ranking') {
        const validOptions = q.options ? q.options.filter((opt: string) => opt && opt.trim().length > 0) : [];
        if (validOptions.length < 2) {
          alert(`Question ${i + 1}: ${q.type === 'ranking' ? 'Ranking' : 'Choice'} questions must have at least 2 options`);
          return;
        }
      }

      // Validate rating scale
      if (q.type === 'rating') {
        const min = q.scaleMin !== undefined ? q.scaleMin : 1;
        const max = q.scaleMax !== undefined ? q.scaleMax : 5;
        if (min >= max) {
          alert(`Question ${i + 1}: Rating scale minimum must be less than maximum`);
          return;
        }
      }
    }

    this.loading = true;
    console.log('All validations passed. Creating survey as draft...');

    // Build Survey Questions
    const surveyQuestions: CreateSurveyQuestionApiRequest[] = questions.map((q: any, i: number) => {
      const questionPayload: CreateSurveyQuestionApiRequest = {
        questionText: q.text.trim(),
        questionType: q.type,
        isRequired: q.isRequired !== undefined ? q.isRequired : true,
        questionOrder: i + 1
      };

      // Add scale for rating
      if (q.type === 'rating') {
        questionPayload.scaleMin = q.scaleMin !== undefined ? q.scaleMin : 1;
        questionPayload.scaleMax = q.scaleMax !== undefined ? q.scaleMax : 5;
      }

      // Add options for choices and ranking
      if ((q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'ranking') && q.options) {
        const validOptions = q.options
          .filter((opt: string) => opt && opt.trim().length > 0)
          .map((opt: string, oi: number) => ({
            optionText: opt.trim(),
            displayOrder: oi + 1
          }));

        if (validOptions.length > 0) {
          questionPayload.options = validOptions;
        }
      }

      return questionPayload;
    });

    // Create Survey without session (draft mode)
    const surveyPayload: CreateSurveyApiRequest = {
      sessionId: null, // No session yet - will be created when published from Manage Content
      title: title,
      description: formValue.description?.trim() || '',
      isAnonymous: formValue.isAnonymous === true,
      status: 'draft',
      questions: surveyQuestions
    };

    console.log('Creating survey as draft with payload:', JSON.stringify(surveyPayload, null, 2));

    this.surveyService.createSurvey(surveyPayload as any).subscribe({
      next: (surveyRes: any) => {
        console.log('Survey created successfully - Full response:', surveyRes);

        // Extract surveyId
        let surveyId = surveyRes?.surveyId || surveyRes?.id;
        
        if (!surveyId && surveyRes?.data) {
          surveyId = surveyRes.data.surveyId || surveyRes.data.id;
        }

        if (surveyId) {
          surveyId = parseInt(surveyId, 10);
        }

        console.log('Extracted surveyId:', surveyId, 'Type:', typeof surveyId);

        if (!surveyId || isNaN(surveyId)) {
          console.warn('Survey created but ID extraction failed:', surveyRes);
        }

        // Update dashboard stats
        this.dashboardStatsService.incrementSurveyCount();

        this.loading = false;
        
        // Show success message
        alert('🎉 Survey Created Successfully!\n\nYour survey has been saved as a draft. Go to Manage Content to publish it with a session.');
        
        // Reset form
        this.surveyForm.reset();
        this.initForm();
      },
      error: (err) => {
        console.error('Survey Creation Error:', err);
        this.loading = false;
        const errorMsg = err?.error?.message || err?.error?.error || err?.message || 'Unknown error';
        alert(`Failed to create survey: ${errorMsg}`);
      }
    });
  }

  removeQuestion(index: number): void {
    if (this.questions.length > 1) this.questions.removeAt(index);
  }

  addOption(qIndex: number): void {
    this.getOptions(qIndex).push(this.fb.control('', Validators.required));
  }

  removeOption(qIndex: number, oIndex: number): void {
    if (this.getOptions(qIndex).length > 2) this.getOptions(qIndex).removeAt(oIndex);
  }

  /**
   * Integrate with quiz creation system - Convert survey to quiz format
   */
  async createQuizFromSurvey(): Promise<void> {
    if (this.surveyForm.valid && this.surveyForm.value.title && this.surveyForm.value.questions.length > 0) {
      try {
        this.loading = true;
        
        // Set quiz basics in the quiz service
        this.addQuestionService.setQuizBasics(
          this.surveyForm.value.title,
          this.surveyForm.value.category || 'General'
        );
        
        // Add each question to the quiz service
        for (const question of this.surveyForm.value.questions) {
          const quizQuestion: QuizQuestion = {
            text: question.text,
            type: (question.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False') as QuestionType,
            difficulty: 'Medium',
            category: this.surveyForm.value.category || 'General',
            tags: [],
            timerSeconds: null,
            options: question.options?.map((opt: string, index: number) => ({
              text: opt,
              isCorrect: index === 0 // First option as correct for demo
            })) || [
              { text: 'True', isCorrect: true },
              { text: 'False', isCorrect: false }
            ]
          };
          
          // Use addQuestion method directly (it's void)
          try {
            this.addQuestionService.addQuestion(quizQuestion);
          } catch (error) {
            console.warn('Failed to add question:', error);
          }
        }
        
        console.log('✅ Survey converted to quiz successfully');
        alert('Survey has been converted to quiz format! Switch to Questions tab to see the results.');
        this.switchToQuestionsTab.emit();
        
      } catch (error) {
        console.error('❌ Error creating quiz from survey:', error);
        alert('Failed to create quiz from survey. Please try again.');
      } finally {
        this.loading = false;
      }
    } else {
      alert('Please fill in the survey title and add at least one question.');
    }
  }

  generateQrCode(sessionId: number): void {
    if (sessionId) {
      // Generate participation URL for survey
      const baseUrl = window.location.origin;
      this.surveyUrl = `${baseUrl}/participate/survey/${sessionId}`;
      this.qrCodeValue = this.surveyUrl;
      this.showQrCode = true;
    }
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText(this.surveyUrl).then(() => {
      alert('Survey URL copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy URL to clipboard. Please copy it manually.');
    });
  }

  goBackToHost(): void {
    this.router.navigate(['/host/dashboard']);
  }

  ngAfterViewInit(): void {
    // Start tutorial after view is fully initialized
    setTimeout(() => {
      this.startTutorial();
    }, 1000);
  }

  // Tutorial methods
  startTutorial(): void {
    if (this.tutorialService.shouldAutoStart('survey')) {
      console.log('Auto-starting tutorial for survey component');
      this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'survey');
    } else {
      console.log('Tutorial already seen for survey component');
    }
  }

  resetTutorial(): void {
    this.tutorialService.resetTutorial('survey');
    this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'survey');
  }

  nextTutorialStep(): void {
    this.tutorialService.nextStep();
  }

  previousTutorialStep(): void {
    this.tutorialService.previousStep();
  }

  skipTutorial(): void {
    this.tutorialService.skipTutorial();
  }

  getCurrentStep(): TutorialStep | null {
    return this.tutorialService.getCurrentStepData();
  }

  getSpotlightPosition(): { top: string; left: string; width: string; height: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      top: `${rect.top - 5}px`,
      left: `${rect.left - 5}px`,
      width: `${rect.width + 10}px`,
      height: `${rect.height + 10}px`
    };
  }

  getPopupPosition(): { top: string; left: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

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

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  }

  // Generate a unique session code
  private generateSessionCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  ngOnDestroy(): void {
    // Fix for Error 3: Using correct method name 'disconnect'
    this.signalrService.disconnect();
  }
}