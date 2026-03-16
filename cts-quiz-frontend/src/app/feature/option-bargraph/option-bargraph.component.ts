import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { SignalrService } from '../../services/signalr.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface OptionBar {
  optionId: number;
  optionText: string;
  count: number;
  isCorrect: boolean;
  percentage: number;
}

interface OptionCount {
  questionId: number;
  questionText: string;
  options: OptionBar[];
  totalResponses: number;
  lastUpdated: string;
}

@Component({
  selector: 'app-option-bargraph',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './option-bargraph.component.html',
  styleUrls: ['./option-bargraph.component.css'],
  animations: [
    trigger('barGrow', [
      transition(':enter', [
        style({ width: '0%' }),
        animate('800ms cubic-bezier(0.25, 0.8, 0.25, 1)', style({ width: '{{ width }}%' }))
      ], { params: { width: 0 } })
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class OptionBargraphComponent implements OnInit, OnChanges, OnDestroy {
  @Input() sessionId = signal<number>(0);
  @Input() questionId = signal<number>(0);
  @Input() autoRefresh = signal<boolean>(true);
  @Input() optionCountsData: any = null; // Accept pre-loaded data for overlay mode
  @Input() overlayMode: boolean = false; // Flag to indicate overlay usage

  optionData = signal<OptionCount | null>(null);
  isLoading = signal<boolean>(false);
  revealed = signal<boolean>(false);
  
  private destroy$ = new Subject<void>();

  // Computed values
  maxCount = computed(() => {
    const data = this.optionData();
    if (!data) return 0;
    return Math.max(...data.options.map(o => o.count), 1);
  });

  constructor(
    private signalrService: SignalrService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // React to optionCountsData changes in overlay mode
    if (this.overlayMode && changes['optionCountsData'] && changes['optionCountsData'].currentValue) {
      console.log('[OptionBarGraph] Data updated in overlay mode:', changes['optionCountsData'].currentValue);
      this.optionData.set(changes['optionCountsData'].currentValue);
      
      // Reset and trigger reveal animation
      this.revealed.set(false);
      setTimeout(() => this.revealed.set(true), 100);
    }
  }

  ngOnInit(): void {
    // If overlay mode and data is provided, use it directly
    if (this.overlayMode && this.optionCountsData) {
      console.log('[OptionBarGraph] Overlay mode - using provided data:', this.optionCountsData);
      this.optionData.set(this.optionCountsData);
      
      // Trigger reveal animation
      setTimeout(() => this.revealed.set(true), 100);
      return;
    }

    // Otherwise, extract params from route (navigation mode)
    const questionIdParam = this.route.snapshot.paramMap.get('questionId');
    if (questionIdParam) {
      this.questionId.set(parseInt(questionIdParam, 10));
      console.log('[OptionBarGraph] Extracted questionId from route:', this.questionId());
    }

    // Extract sessionId from query params
    const sessionIdParam = this.route.snapshot.queryParamMap.get('sessionId');
    if (sessionIdParam) {
      this.sessionId.set(parseInt(sessionIdParam, 10));
      console.log('[OptionBarGraph] Extracted sessionId from query:', this.sessionId());
    }

    // Check if we should auto-return to quiz
    const returnToQuiz = this.route.snapshot.queryParamMap.get('returnToQuiz');
    if (returnToQuiz === 'true') {
      console.log('[OptionBarGraph] Auto-return mode enabled');
    }

    this.loadOptionCounts();

    if (this.autoRefresh()) {
      this.subscribeToUpdates();
    }
  }

  ngOnDestroy(): void {
    // ✅ Remove SignalR event handler to prevent memory leaks
    this.signalrService.hubConnection?.off('OptionCountsUpdate');
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadOptionCounts(): void {
    this.isLoading.set(true);
    const sessionId = this.sessionId();
    const questionId = this.questionId();

    this.http.get<OptionCount>(`${environment.apiUrl}/Host/Leaderboard/option-counts/${sessionId}/${questionId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('[OptionBarGraph] Data loaded:', data);
          this.optionData.set(data);
          this.isLoading.set(false);
          
          // Delayed reveal for animation effect
          setTimeout(() => this.revealed.set(true), 500);
        },
        error: (err) => {
          console.error('[OptionBarGraph] Load error:', err);
          this.isLoading.set(false);
        }
      });
  }

  private subscribeToUpdates(): void {
    // ✅ Remove existing handler first to prevent duplicates
    this.signalrService.hubConnection?.off('OptionCountsUpdate');
    
    // ✅ Listen for real-time option count updates
    this.signalrService.hubConnection?.on('OptionCountsUpdate', (data: OptionCount) => {
      console.log('[OptionBarGraph] Real-time update received:', data);
      if (data.questionId === this.questionId()) {
        this.optionData.set(data);
      }
    });
  }

  getBarWidth(option: OptionBar): number {
    const max = this.maxCount();
    if (max === 0) return 0;
    return (option.count / max) * 100;
  }

  getBarColor(option: OptionBar): string {
    if (option.isCorrect) {
      return 'linear-gradient(135deg, #4caf50, #8bc34a)'; // Green for correct
    }
    // Colorful palette for incorrect options
    const colors = [
      'linear-gradient(135deg, #e74c3c, #f39c12)', // Red-Orange
      'linear-gradient(135deg, #3498db, #2980b9)', // Blue
      'linear-gradient(135deg, #9b59b6, #8e44ad)', // Purple
      'linear-gradient(135deg, #f39c12, #e67e22)'  // Orange
    ];
    return colors[option.optionId % colors.length];
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index); // A, B, C, D...
  }

  refresh(): void {
    this.revealed.set(false);
    this.loadOptionCounts();
  }
}
