import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';
import { SignalrService } from '../../services/signalr.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';

interface PersonalRank {
  participantId: string;
  participantName: string;
  rank: number;
  totalParticipants: number;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  currentStreak: number;
  bestStreak: number;
  streakBonus: number;
  averageSpeedMs: number;
  lastUpdated: string;
}

@Component({
  selector: 'app-my-rank',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-rank.component.html',
  styleUrls: ['./my-rank.component.css'],
  animations: [
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(50px)' }),
        animate('600ms cubic-bezier(0.25, 0.8, 0.25, 1)', 
          style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('rankPulse', [
      transition('* => *', [
        animate('500ms', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(1.2)', offset: 0.5 }),
          style({ transform: 'scale(1)', offset: 1 })
        ]))
      ])
    ]),
    trigger('scoreCount', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.5)' }),
        animate('400ms 200ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class MyRankComponent implements OnInit, OnChanges, OnDestroy {
  @Input() sessionId = signal<number>(0);
  @Input() participantId = signal<string | number>('');
  @Input() autoRefresh = signal<boolean>(true);
  @Input() personalRankData: any = null; // Accept pre-loaded data for overlay mode
  @Input() overlayMode: boolean = false; // Flag to indicate overlay usage

  personalRank = signal<PersonalRank | null>(null);
  isLoading = signal<boolean>(false);
  showStreakAnimation = signal<boolean>(false);
  
  private destroy$ = new Subject<void>();

  // Computed properties
  accuracy = computed(() => {
    const rank = this.personalRank();
    if (!rank || rank.totalQuestions === 0) return 0;
    return Math.round((rank.correctAnswers / rank.totalQuestions) * 100);
  });

  rankPercentile = computed(() => {
    const rank = this.personalRank();
    if (!rank || rank.totalParticipants === 0) return 0;
    return Math.round(((rank.totalParticipants - rank.rank + 1) / rank.totalParticipants) * 100);
  });

  hasStreak = computed(() => {
    const rank = this.personalRank();
    return rank ? rank.currentStreak >= 3 : false;
  });

  rankBadgeColor = computed(() => {
    const rank = this.personalRank();
    if (!rank) return '#666';
    
    if (rank.rank === 1) return '#FFD700'; // Gold
    if (rank.rank === 2) return '#C0C0C0'; // Silver
    if (rank.rank === 3) return '#CD7F32'; // Bronze
    if (rank.rank <= 10) return '#4CAF50'; // Top 10 green
    return '#2196F3'; // Default blue
  });

  rankLabel = computed(() => {
    const rank = this.personalRank();
    if (!rank) return '';
    
    if (rank.rank === 1) return '🏆 Champion!';
    if (rank.rank === 2) return '🥈 Runner-up!';
    if (rank.rank === 3) return '🥉 Third Place!';
    if (rank.rank <= 10) return '⭐ Top 10!';
    return `Rank #${rank.rank}`;
  });

  constructor(
    private signalrService: SignalrService,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // React to personalRankData changes in overlay mode
    if (this.overlayMode && changes['personalRankData'] && changes['personalRankData'].currentValue) {
      console.log('[MyRank] Data updated in overlay mode:', changes['personalRankData'].currentValue);
      this.personalRank.set(changes['personalRankData'].currentValue);
      
      // Trigger streak animation if applicable
      if (changes['personalRankData'].currentValue.currentStreak >= 3) {
        this.showStreakAnimation.set(true);
        setTimeout(() => this.showStreakAnimation.set(false), 3000);
      }
    }
  }

  ngOnInit(): void {
    // If overlay mode and data is provided, use it directly
    if (this.overlayMode && this.personalRankData) {
      console.log('[MyRank] Overlay mode - using provided data:', this.personalRankData);
      this.personalRank.set(this.personalRankData);
      
      // Trigger streak animation if applicable
      if (this.personalRankData.currentStreak >= 3) {
        this.showStreakAnimation.set(true);
        setTimeout(() => this.showStreakAnimation.set(false), 3000);
      }
      return;
    }

    // Otherwise, extract params from route (navigation mode)
    const routeParamParticipantId = this.route.snapshot.paramMap.get('participantId');
    const queryParticipantId = this.route.snapshot.queryParamMap.get('participantId');
    
    if (routeParamParticipantId && !this.participantId()) {
      this.participantId.set(routeParamParticipantId);
      console.log('[MyRank] Extracted participantId from route param:', this.participantId());
    } else if (queryParticipantId && !this.participantId()) {
      this.participantId.set(queryParticipantId);
      console.log('[MyRank] Extracted participantId from query param:', this.participantId());
    }
    
    // Extract sessionId from query params
    const routeSessionId = this.route.snapshot.queryParamMap.get('sessionId');
    if (routeSessionId && this.sessionId() === 0) {
      this.sessionId.set(parseInt(routeSessionId, 10));
      console.log('[MyRank] Extracted sessionId from query param:', this.sessionId());
    }

    this.loadPersonalRank();
    
    if (this.autoRefresh()) {
      this.subscribeToUpdates();
    }
  }

  ngOnDestroy(): void {
    // ✅ Remove SignalR event handlers to prevent memory leaks
    this.signalrService.hubConnection?.off('PersonalRankUpdate');
    this.signalrService.hubConnection?.off('LeaderboardUpdatePersonalRank');
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPersonalRank(): void {
    this.isLoading.set(true);
    const sessionId = this.sessionId();
    const participantId = this.participantId();

    if (!sessionId || !participantId) {
      console.warn('[MyRank] Missing sessionId or participantId');
      this.isLoading.set(false);
      return;
    }

    this.http.get<PersonalRank>(
      `${environment.apiUrl}/Host/Leaderboard/participant-rank/${sessionId}/${participantId}`
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('[MyRank] Personal rank loaded:', data);
          const previousStreak = this.personalRank()?.currentStreak || 0;
          this.personalRank.set(data);
          this.isLoading.set(false);
          
          // Show streak animation if streak increased
          if (data.currentStreak > previousStreak && data.currentStreak >= 3) {
            this.showStreakAnimation.set(true);
            setTimeout(() => this.showStreakAnimation.set(false), 3000);
          }
        },
        error: (err) => {
          console.error('[MyRank] Load error:', err);
          this.isLoading.set(false);
        }
      });
  }

  private subscribeToUpdates(): void {
    // ✅ Remove existing handlers first to prevent duplicates
    this.signalrService.hubConnection?.off('PersonalRankUpdate');
    this.signalrService.hubConnection?.off('LeaderboardUpdatePersonalRank');
    
    // ✅ Listen for personal rank updates (new event name)
    this.signalrService.hubConnection?.on('PersonalRankUpdate', (data: PersonalRank) => {
      // Only update if this is for the current participant
      if (data.participantId === this.participantId()) {
        console.log('[MyRank] Real-time update received (PersonalRankUpdate):', data);
        const previousStreak = this.personalRank()?.currentStreak || 0;
        this.personalRank.set(data);
        
        // Show streak animation if streak increased
        if (data.currentStreak > previousStreak && data.currentStreak >= 3) {
          this.showStreakAnimation.set(true);
          setTimeout(() => this.showStreakAnimation.set(false), 3000);
        }
      }
    });

    // ✅ Also listen for legacy event name for backward compatibility
    this.signalrService.hubConnection?.on('LeaderboardUpdatePersonalRank', (data: PersonalRank) => {
      // Only update if this is for the current participant
      if (data.participantId === this.participantId()) {
        console.log('[MyRank] Real-time update received (legacy event):', data);
        const previousStreak = this.personalRank()?.currentStreak || 0;
        this.personalRank.set(data);
        
        // Show streak animation if streak increased
        if (data.currentStreak > previousStreak && data.currentStreak >= 3) {
          this.showStreakAnimation.set(true);
          setTimeout(() => this.showStreakAnimation.set(false), 3000);
        }
      }
    });
  }

  refresh(): void {
    this.loadPersonalRank();
  }

  formatTime(ms: number): string {
    return (ms / 1000).toFixed(2) + 's';
  }

  getStreakEmoji(streak: number): string {
    if (streak >= 5) return '🔥🔥🔥';
    if (streak >= 3) return '🔥🔥';
    if (streak >= 2) return '🔥';
    return '';
  }
}
