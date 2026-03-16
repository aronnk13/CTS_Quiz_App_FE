import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeType = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSubject = new BehaviorSubject<ThemeType>('light');
  public theme$: Observable<ThemeType> = this.themeSubject.asObservable();
  private currentTheme = signal<ThemeType>('light');

  constructor() {
    this.loadTheme();
  }

  /**
   * Load theme from localStorage
   */
  private loadTheme(): void {
    const savedTheme = localStorage.getItem('theme') as ThemeType | null;
    const theme = savedTheme || 'light';
    this.setTheme(theme);
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): ThemeType {
    return this.currentTheme();
  }

  /**
   * Set theme
   */
  setTheme(theme: ThemeType): void {
    this.currentTheme.set(theme);
    this.themeSubject.next(theme);
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme(): void {
    const newTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: ThemeType): void {
    const htmlElement = document.documentElement;
    if (theme === 'dark') {
      htmlElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      htmlElement.setAttribute('data-theme', 'light');
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }
  }
}
