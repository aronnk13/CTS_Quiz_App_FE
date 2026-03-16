import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { SignalrService } from '../../services/signalr.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface FastestResponder {
  participantId: string;
  participantName: string;
  averageTimeMs: number;
  formattedTime: string;
}

interface MostAccurate {
  participantId: string;
  participantName: string;
  correctAnswers: number;
  totalAnswers: number;
  accuracyPercentage: number;
}

interface MostConsistent {
  participantId: string;
  participantName: string;
  timeVariance: number;
  averageTimeMs: number;
}

interface CategoryLeaderboard {
  quizSessionId: number;
  fastestResponder: FastestResponder | null;
  mostAccurate: MostAccurate | null;
  mostConsistent: MostConsistent | null;
  lastUpdated: string;
}

@Component({
  selector: 'app-leaderboard-category',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard-category.component.html',
  styleUrls: ['./leaderboard-category.component.css']
})
export class LeaderboardCategoryComponent implements OnInit, OnChanges, OnDestroy {
  @Input() sessionId = signal<number>(0);
  @Input() overlayMode: boolean = false;
  @Input() categoryData: CategoryLeaderboard | null = null;

  categories = signal<CategoryLeaderboard | null>(null);
  isLoading = signal<boolean>(false);
  activeTab = signal<'fastest' | 'accurate' | 'consistent'>('fastest');
  
  private destroy$ = new Subject<void>();

  constructor(
    private signalrService: SignalrService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.overlayMode && changes['categoryData'] && changes['categoryData'].currentValue) {
      console.log('[LeaderboardCategory] Data updated in overlay mode:', changes['categoryData'].currentValue);
      this.categories.set(changes['categoryData'].currentValue);
    }
  }

  ngOnInit(): void {
    // If overlay mode with pre-loaded data, use it directly
    if (this.overlayMode && this.categoryData) {
      console.log('[LeaderboardCategory] Overlay mode - using provided data');
      this.categories.set(this.categoryData);
      return;
    }

    // Extract sessionId from route if not provided as input
    const routeSessionId = this.route.snapshot.paramMap.get('sessionId');
    if (routeSessionId && this.sessionId() === 0) {
      this.sessionId.set(parseInt(routeSessionId, 10));
    }
    
    this.loadCategoryLeaderboard();
    this.subscribeToUpdates();
  }

  ngOnDestroy(): void {
    // ✅ Remove SignalR event handler to prevent memory leaks
    this.signalrService.hubConnection?.off('LeaderboardUpdateCategory');
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCategoryLeaderboard(): void {
    this.isLoading.set(true);
    const sessionId = this.sessionId();

    this.http.get<CategoryLeaderboard>(`${environment.apiUrl}/Host/Leaderboard/category/${sessionId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('[LeaderboardCategory] Data loaded:', data);
          this.categories.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[LeaderboardCategory] Load error:', err);
          this.isLoading.set(false);
        }
      });
  }

  private subscribeToUpdates(): void {
    // ✅ Remove existing handler first to prevent duplicates
    this.signalrService.hubConnection?.off('LeaderboardUpdateCategory');
    
    // ✅ Register new handler
    this.signalrService.hubConnection?.on('LeaderboardUpdateCategory', (data: CategoryLeaderboard) => {
      console.log('[LeaderboardCategory] Real-time update received:', data);
      this.categories.set(data);
    });
  }

  setTab(tab: 'fastest' | 'accurate' | 'consistent'): void {
    this.activeTab.set(tab);
  }

  refresh(): void {
    this.loadCategoryLeaderboard();
  }
}
