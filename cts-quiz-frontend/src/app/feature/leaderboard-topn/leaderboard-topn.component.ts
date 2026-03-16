import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { SignalrService } from '../../services/signalr.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface TopNEntry {
  participantId: string;
  participantName: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  rank: number;
  previousRank: number;
  hasRankChange: boolean;
  rankDelta: number;
  averageSpeedMs: number;
  streakCorrect: number;
}

interface TopNLeaderboard {
  quizSessionId: number;
  quizTitle: string;
  topN: number;
  topParticipants: TopNEntry[];
  lastUpdated: string;
}

@Component({
  selector: 'app-leaderboard-topn',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard-topn.component.html',
  styleUrls: ['./leaderboard-topn.component.css'],
  animations: [
    trigger('rankChange', [
      state('up', style({ transform: 'translateY(-10px)', backgroundColor: '#4caf50' })),
      state('down', style({ transform: 'translateY(10px)', backgroundColor: '#f44336' })),
      state('same', style({ transform: 'translateY(0)', backgroundColor: 'transparent' })),
      transition('* => up', animate('500ms ease-out')),
      transition('* => down', animate('500ms ease-out')),
      transition('* => same', animate('300ms ease-in'))
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class LeaderboardTopnComponent implements OnInit, OnChanges, OnDestroy {
  @Input() sessionId = signal<number>(0);
  @Input() topN = signal<number>(5);
  @Input() autoRefresh = signal<boolean>(true);
  @Input() currentParticipantId = signal<string | null>(null);
  @Input() overlayMode: boolean = false;
  @Input() topNData: TopNLeaderboard | null = null;

  leaderboard = signal<TopNLeaderboard | null>(null);
  isLoading = signal<boolean>(false);
  
  private destroy$ = new Subject<void>();

  // Computed signal for displayed entries
  displayedEntries = computed(() => {
    const lb = this.leaderboard();
    return lb?.topParticipants || [];
  });

  constructor(
    private signalrService: SignalrService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.overlayMode && changes['topNData'] && changes['topNData'].currentValue) {
      console.log('[LeaderboardTopN] Data updated in overlay mode:', changes['topNData'].currentValue);
      this.leaderboard.set(changes['topNData'].currentValue);
    }
  }

  ngOnInit(): void {
    // If overlay mode with pre-loaded data, use it directly
    if (this.overlayMode && this.topNData) {
      console.log('[LeaderboardTopN] Overlay mode - using provided data');
      this.leaderboard.set(this.topNData);
      return;
    }

    // Extract sessionId from route if not provided as input
    const routeSessionId = this.route.snapshot.paramMap.get('sessionId');
    if (routeSessionId && this.sessionId() === 0) {
      this.sessionId.set(parseInt(routeSessionId, 10));
    }
    
    this.loadTopNLeaderboard();

    if (this.autoRefresh()) {
      this.subscribeToUpdates();
    }
  }

  ngOnDestroy(): void {
    // ✅ Remove SignalR event handler to prevent memory leaks
    this.signalrService.hubConnection?.off('LeaderboardUpdateTopN');
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTopNLeaderboard(): void {
    this.isLoading.set(true);
    const sessionId = this.sessionId();
    const topN = this.topN();

    this.http.get<TopNLeaderboard>(`${environment.apiUrl}/Host/Leaderboard/top-n/${sessionId}/${topN}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('[LeaderboardTopN] Data loaded:', data);
          this.leaderboard.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[LeaderboardTopN] Load error:', err);
          this.isLoading.set(false);
        }
      });
  }

  private subscribeToUpdates(): void {
    // ✅ Remove existing handler first to prevent duplicates
    this.signalrService.hubConnection?.off('LeaderboardUpdateTopN');
    
    // ✅ Listen for SignalR top-N updates
    this.signalrService.hubConnection?.on('LeaderboardUpdateTopN', (data: TopNLeaderboard) => {
      console.log('[LeaderboardTopN] Real-time update received:', data);
      this.leaderboard.set(data);
    });
  }

  getRankChangeState(entry: TopNEntry): string {
    if (!entry.hasRankChange) return 'same';
    return entry.rankDelta > 0 ? 'up' : 'down';
  }

  getRankIcon(entry: TopNEntry): string {
    if (!entry.hasRankChange) return '';
    return entry.rankDelta > 0 ? '⬆️' : '⬇️';
  }

  getRankChangeTitle(entry: TopNEntry): string {
    if (!entry.hasRankChange) return '';
    const direction = entry.rankDelta > 0 ? 'up' : 'down';
    const change = Math.abs(entry.rankDelta);
    return `Moved ${direction} ${change} ${change === 1 ? 'position' : 'positions'}`;
  }

  getMedalEmoji(rank: number): string {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  }

  isCurrentUser(entry: TopNEntry): boolean {
    const currentId = this.currentParticipantId();
    return currentId ? entry.participantId === currentId : false;
  }

  formatTime(ms: number): string {
    return (ms / 1000).toFixed(2) + 's';
  }

  getAccuracyPercent(entry: TopNEntry): number {
    if (entry.totalQuestions === 0) return 0;
    return Math.round((entry.correctAnswers / entry.totalQuestions) * 100);
  }

  refresh(): void {
    this.loadTopNLeaderboard();
  }
}
