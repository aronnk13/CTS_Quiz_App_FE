import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatSnackBarModule],
  templateUrl: './countdown.component.html',
  styleUrls: ['./countdown.component.css']
})
export class CountdownComponent implements OnInit, OnDestroy {
  totalTime = 10;
  timeLeft = this.totalTime;
  progress = 100;

  private intervalId?: number;
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID); // detect SSR vs browser

  ngOnInit(): void {
    // Only run countdown in the browser
    if (isPlatformBrowser(this.platformId)) {
      this.startCountdown();
    }
  }

  private startCountdown() {
    // Use setInterval (not window.setInterval) and it’s still guarded by isPlatformBrowser
    this.intervalId = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
        this.progress = (this.timeLeft / this.totalTime) * 100;
      } else {
        this.stopCountdown();
        this.snackBar.open('Countdown finished!', 'Close', { duration: 1500 });
        this.router.navigate(['/quiz']);
      }
    }, 1000) as unknown as number; // cast for TS if strict typing complains
  }

  private stopCountdown() {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  get formattedTime(): string {
    return `00:${this.timeLeft.toString().padStart(2, '0')}`;
  }
}
