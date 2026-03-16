import { Component, OnInit, OnDestroy, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';
import { SignalrService } from '../../services/signalr.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface PodiumEntry {
  participantId: string;
  participantName: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  rank: number;
  averageSpeedMs: number;
}

interface PodiumLeaderboard {
  quizSessionId: number;
  quizTitle: string;
  firstPlace: PodiumEntry | null;
  secondPlace: PodiumEntry | null;
  thirdPlace: PodiumEntry | null;
  lastUpdated: string;
}

@Component({
  selector: 'app-leaderboard-podium',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard-podium.component.html',
  styleUrls: ['./leaderboard-podium.component.css'],
  animations: [
    trigger('podiumReveal', [
      transition(':enter', [
        animate('1s ease-out', keyframes([
          style({ opacity: 0, transform: 'translateY(100px) scale(0.5)', offset: 0 }),
          style({ opacity: 0.5, transform: 'translateY(50px) scale(0.75)', offset: 0.5 }),
          style({ opacity: 1, transform: 'translateY(0) scale(1)', offset: 1 })
        ]))
      ])
    ]),
    trigger('trophy', [
      state('visible', style({ opacity: 1, transform: 'scale(1) rotate(0deg)' })),
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0) rotate(-180deg)' }),
        animate('800ms 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)')
      ])
    ])
  ]
})
export class LeaderboardPodiumComponent implements OnInit, OnDestroy {
  @Input() sessionId = signal<number>(0);
  @Input() overlayMode: boolean = false;
  @Input() podiumData: PodiumLeaderboard | null = null;

  podium = signal<PodiumLeaderboard | null>(null);
  isLoading = signal<boolean>(false);
  showCelebration = signal<boolean>(false);
  
  private destroy$ = new Subject<void>();

  constructor(
    private signalrService: SignalrService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // If overlay mode with pre-loaded data, use it directly
    if (this.overlayMode && this.podiumData) {
      console.log('[LeaderboardPodium] Overlay mode - using provided data');
      this.podium.set(this.podiumData);
      this.showCelebration.set(true);
      return;
    }

    // Extract sessionId from route if not provided as input
    const routeSessionId = this.route.snapshot.paramMap.get('sessionId');
    if (routeSessionId && this.sessionId() === 0) {
      this.sessionId.set(parseInt(routeSessionId, 10));
    }
    
    this.loadPodium();
    this.subscribeToSignalR();
  }

  ngOnDestroy(): void {
    // ✅ Remove SignalR event handler to prevent memory leaks
    this.signalrService.hubConnection?.off('ShowPodium');
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPodium(): void {
    this.isLoading.set(true);
    const sessionId = this.sessionId();

    this.http.get<PodiumLeaderboard>(`${environment.apiUrl}/Host/Leaderboard/podium/${sessionId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('[LeaderboardPodium] Data loaded:', data);
          this.podium.set(data);
          this.isLoading.set(false);
          this.showCelebration.set(true);
        },
        error: (err) => {
          console.error('[LeaderboardPodium] Load error:', err);
          this.isLoading.set(false);
        }
      });
  }

  private subscribeToSignalR(): void {
    // ✅ Remove existing handler first to prevent duplicates
    this.signalrService.hubConnection?.off('ShowPodium');
    
    // ✅ Listen for podium reveal event
    this.signalrService.hubConnection?.on('ShowPodium', (data: PodiumLeaderboard) => {
      console.log('[LeaderboardPodium] Podium reveal received:', data);
      this.podium.set(data);
      this.showCelebration.set(true);
    });
  }

  formatTime(ms: number): string {
    return (ms / 1000).toFixed(2) + 's';
  }

  getAccuracy(entry: PodiumEntry | null): number {
    if (!entry || entry.totalQuestions === 0) return 0;
    return Math.round((entry.correctAnswers / entry.totalQuestions) * 100);
  }

  // Podium heights for visual effect
  getHeight(rank: number): string {
    switch (rank) {
      case 1: return '200px'; // Tallest
      case 2: return '160px';
      case 3: return '120px';
      default: return '100px';
    }
  }
}
