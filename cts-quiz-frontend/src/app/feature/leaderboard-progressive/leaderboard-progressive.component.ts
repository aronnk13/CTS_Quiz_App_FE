import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { SignalrService } from '../../services/signalr.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface ProgressiveEntry {
  participantId: string;
  participantName: string;
  baseScore: number;
  streakBonus: number;
  totalScore: number;
  currentStreak: number;
  rank: number;
  hasStreakBadge: boolean;
  accuracy?: number;
  averageResponseTimeMs?: number;
}

interface ProgressiveLeaderboard {
  quizSessionId: number;
  entries: ProgressiveEntry[];
  lastUpdated: string;
}

@Component({
  selector: 'app-leaderboard-progressive',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard-progressive.component.html',
  styleUrls: ['./leaderboard-progressive.component.css'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-30px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class LeaderboardProgressiveComponent implements OnInit, OnChanges, OnDestroy {
  @Input() sessionId = signal<number>(0);
  @Input() currentParticipantId = signal<string | null>(null);
  @Input() overlayMode: boolean = false;
  @Input() progressiveData: ProgressiveLeaderboard | null = null;

  leaderboard = signal<ProgressiveLeaderboard | null>(null);
  isLoading = signal<boolean>(false);
  
  private destroy$ = new Subject<void>();

  constructor(
    private signalrService: SignalrService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.overlayMode && changes['progressiveData'] && changes['progressiveData'].currentValue) {
      console.log('[LeaderboardProgressive] Data updated in overlay mode:', changes['progressiveData'].currentValue);
      this.leaderboard.set(changes['progressiveData'].currentValue);
    }
  }

  ngOnInit(): void {
    // If overlay mode with pre-loaded data, use it directly
    if (this.overlayMode && this.progressiveData) {
      console.log('[LeaderboardProgressive] Overlay mode - using provided data');
      this.leaderboard.set(this.progressiveData);
      return;
    }

    // Extract sessionId from route if not provided as input
    const routeSessionId = this.route.snapshot.paramMap.get('sessionId');
    if (routeSessionId && this.sessionId() === 0) {
      this.sessionId.set(parseInt(routeSessionId, 10));
    }
    
    this.loadProgressiveLeaderboard();
    this.subscribeToUpdates();
  }

  ngOnDestroy(): void {
    // ✅ Remove SignalR event handler to prevent memory leaks
    this.signalrService.hubConnection?.off('LeaderboardUpdateProgressive');
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProgressiveLeaderboard(): void {
    this.isLoading.set(true);
    const sessionId = this.sessionId();

    this.http.get<ProgressiveLeaderboard>(`${environment.apiUrl}/Host/Leaderboard/progressive/${sessionId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('[LeaderboardProgressive] Data loaded:', data);
          this.leaderboard.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[LeaderboardProgressive] Load error:', err);
          this.isLoading.set(false);
        }
      });
  }

  private subscribeToUpdates(): void {
    // ✅ Remove existing handler first to prevent duplicates
    this.signalrService.hubConnection?.off('LeaderboardUpdateProgressive');
    
    // ✅ Register new handler
    this.signalrService.hubConnection?.on('LeaderboardUpdateProgressive', (data: ProgressiveLeaderboard) => {
      console.log('[LeaderboardProgressive] Real-time update received:', data);
      this.leaderboard.set(data);
    });
  }

  isCurrentUser(entry: ProgressiveEntry): boolean {
    const currentId = this.currentParticipantId();
    return currentId ? entry.participantId === currentId : false;
  }

  getStreakColor(streak: number): string {
    if (streak >= 5) return '#ff4444'; // Hot streak!
    if (streak >= 3) return '#ff8800'; // On fire
    return '#666';
  }

  refresh(): void {
    this.loadProgressiveLeaderboard();
  }
}
