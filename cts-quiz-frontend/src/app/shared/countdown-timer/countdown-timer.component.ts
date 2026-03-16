import { Component, Input, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalrService } from '../../services/signalr.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-countdown-timer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="countdown-container" [class.warning]="remainingSeconds <= 10" [class.critical]="remainingSeconds <= 5">
      <div class="countdown-circle">
        <svg viewBox="0 0 100 100">
          <circle class="countdown-bg" cx="50" cy="50" r="45"></circle>
          <circle 
            class="countdown-progress" 
            cx="50" 
            cy="50" 
            r="45"
            [style.stroke-dashoffset]="circumference - (progress / 100) * circumference"
            [style.stroke-dasharray]="circumference"
          ></circle>
        </svg>
        <div class="countdown-text">
          <span class="seconds">{{ remainingSeconds }}</span>
          <span class="label">seconds</span>
        </div>
      </div>
      <div class="countdown-message" *ngIf="showMessage">
        {{ message }}
      </div>
    </div>
  `,
  styles: [`
    .countdown-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    }

    .countdown-container.warning {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      animation: pulse 1s ease-in-out infinite;
    }

    .countdown-container.critical {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
      animation: shake 0.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .countdown-circle {
      position: relative;
      width: 150px;
      height: 150px;
    }

    svg {
      transform: rotate(-90deg);
      width: 100%;
      height: 100%;
    }

    .countdown-bg {
      fill: none;
      stroke: rgba(255, 255, 255, 0.2);
      stroke-width: 8;
    }

    .countdown-progress {
      fill: none;
      stroke: #ffffff;
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.3s linear;
    }

    .countdown-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: white;
    }

    .seconds {
      display: block;
      font-size: 3rem;
      font-weight: bold;
      line-height: 1;
    }

    .label {
      display: block;
      font-size: 0.875rem;
      opacity: 0.9;
      margin-top: 0.25rem;
    }

    .countdown-message {
      color: white;
      font-size: 1rem;
      font-weight: 500;
      text-align: center;
      animation: fadeIn 0.5s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class CountdownTimerComponent implements OnInit, OnDestroy {
  @Input() duration: number = 45;
  @Input() sessionCode: string = '';
  @Input() questionIndex?: number;
  @Input() autoStart: boolean = false;
  @Input() showMessage: boolean = true;
  @Output() countdownComplete = new EventEmitter<void>();
  @Output() tick = new EventEmitter<number>();

  remainingSeconds: number = 45;
  progress: number = 100;
  circumference: number = 283; // 2 * PI * 45
  message: string = 'Time remaining';
  
  private countdownSubscription?: Subscription;
  private localInterval?: any;

  constructor(private signalrService: SignalrService) {}

  ngOnInit(): void {
    this.remainingSeconds = this.duration;
    this.updateProgress();

    // Subscribe to SignalR countdown ticks
    this.countdownSubscription = this.signalrService.countdownTick$.subscribe(
      (data) => {
        if (data.sessionCode === this.sessionCode) {
          if (this.questionIndex === undefined || data.questionIndex === this.questionIndex) {
            this.remainingSeconds = data.remainingSeconds;
            this.updateProgress();
            this.updateMessage();
            this.tick.emit(this.remainingSeconds);

            if (this.remainingSeconds === 0) {
              this.handleCountdownComplete();
            }
          }
        }
      }
    );

    // Fallback: local countdown if SignalR is not connected
    if (this.autoStart) {
      this.startLocalCountdown();
    }
  }

  ngOnDestroy(): void {
    this.countdownSubscription?.unsubscribe();
    if (this.localInterval) {
      clearInterval(this.localInterval);
    }
  }

  private startLocalCountdown(): void {
    this.localInterval = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.updateProgress();
        this.updateMessage();
        this.tick.emit(this.remainingSeconds);
      } else {
        this.handleCountdownComplete();
        clearInterval(this.localInterval);
      }
    }, 1000);
  }

  private updateProgress(): void {
    this.progress = (this.remainingSeconds / this.duration) * 100;
  }

  private updateMessage(): void {
    if (this.remainingSeconds <= 5) {
      this.message = 'Hurry up!';
    } else if (this.remainingSeconds <= 10) {
      this.message = 'Almost out of time!';
    } else {
      this.message = 'Time remaining';
    }
  }

  private handleCountdownComplete(): void {
    this.message = 'Time\'s up!';
    this.countdownComplete.emit();
  }

  reset(newDuration?: number): void {
    if (newDuration) {
      this.duration = newDuration;
    }
    this.remainingSeconds = this.duration;
    this.updateProgress();
    this.message = 'Time remaining';
  }

  pause(): void {
    if (this.localInterval) {
      clearInterval(this.localInterval);
    }
  }

  resume(): void {
    if (this.autoStart && !this.localInterval) {
      this.startLocalCountdown();
    }
  }
}
