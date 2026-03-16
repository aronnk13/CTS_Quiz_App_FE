import { Injectable, signal } from '@angular/core';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement: string; // CSS selector
  position: 'top' | 'bottom' | 'left' | 'right';
  skipable: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TutorialService {
  private _isActive = signal(false);
  private _currentStep = signal(0);
  private _steps = signal<TutorialStep[]>([]);
  private _currentComponent = signal<string>('');

  isActive = this._isActive.asReadonly();
  currentStep = this._currentStep.asReadonly();
  steps = this._steps.asReadonly();
  currentComponent = this._currentComponent.asReadonly();

  /**
   * Check if tutorial should auto-start for a component
   */
  shouldAutoStart(componentName: string): boolean {
    const sessionKey = `tutorial-session-${componentName}`;
    const pageKey = `tutorial-seen-${componentName}`;
    
    // Check if user has seen tutorial for this component
    const hasSeenTutorial = localStorage.getItem(pageKey);
    if (hasSeenTutorial) {
      return false;
    }

    // Check if tutorial has been shown in current session
    const currentSession = sessionStorage.getItem(sessionKey);
    if (currentSession) {
      return false;
    }

    // Mark as shown in current session
    sessionStorage.setItem(sessionKey, 'true');
    return true;
  }

  startTutorial(steps: TutorialStep[], componentName: string = ''): void {
    this._steps.set(steps);
    this._currentStep.set(0);
    this._currentComponent.set(componentName);
    this._isActive.set(true);
    console.log(`Tutorial started for ${componentName}:`, steps);
  }

  nextStep(): void {
    const current = this._currentStep();
    const totalSteps = this._steps().length;
    
    if (current < totalSteps - 1) {
      this._currentStep.update(step => step + 1);
    } else {
      this.endTutorial();
    }
  }

  previousStep(): void {
    if (this._currentStep() > 0) {
      this._currentStep.update(step => step - 1);
    }
  }

  skipTutorial(): void {
    this.markTutorialAsComplete();
    this.endTutorial();
  }

  endTutorial(): void {
    this.markTutorialAsComplete();
    this._isActive.set(false);
    this._currentStep.set(0);
    this._steps.set([]);
    this._currentComponent.set('');
  }

  private markTutorialAsComplete(): void {
    const component = this._currentComponent();
    if (component) {
      localStorage.setItem(`tutorial-seen-${component}`, 'true');
      console.log(`Tutorial marked as complete for ${component}`);
    }
  }

  resetTutorial(componentName: string): void {
    localStorage.removeItem(`tutorial-seen-${componentName}`);
    sessionStorage.removeItem(`tutorial-session-${componentName}`);
    console.log(`Tutorial reset for ${componentName}`);
  }

  getCurrentStepData(): TutorialStep | null {
    const steps = this._steps();
    const current = this._currentStep();
    return steps[current] || null;
  }
}