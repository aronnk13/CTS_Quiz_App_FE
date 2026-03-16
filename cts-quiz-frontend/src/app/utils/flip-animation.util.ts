/**
 * FLIP Animation Utility
 * 
 * Implements FLIP technique for smooth list reordering:
 * F - First: Capture initial positions
 * L - Last: Update DOM and capture final positions
 * I - Invert: Apply transform to make elements appear at start position
 * P - Play: Animate to final position
 * 
 * Usage:
 * 1. Before update: const positions = capturePositions(elements)
 * 2. Update DOM (Angular re-renders)
 * 3. On next frame: animatePositionChanges(elements, positions)
 */

export interface ElementPosition {
  element: HTMLElement;
  rect: DOMRect;
}

export interface FlipAnimationOptions {
  duration?: number;
  easing?: string;
  onComplete?: () => void;
}

/**
 * Capture current positions of elements
 */
export function capturePositions(elements: HTMLElement[]): Map<HTMLElement, DOMRect> {
  const positions = new Map<HTMLElement, DOMRect>();
  
  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    positions.set(element, rect);
  });
  
  return positions;
}

/**
 * Animate elements from old positions to current positions
 */
export function animatePositionChanges(
  elements: HTMLElement[],
  oldPositions: Map<HTMLElement, DOMRect>,
  options: FlipAnimationOptions = {}
): void {
  const {
    duration = 400,
    easing = 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    onComplete
  } = options;

  let animationsCount = 0;
  const animations: Animation[] = [];

  elements.forEach(element => {
    const oldRect = oldPositions.get(element);
    if (!oldRect) return;

    const newRect = element.getBoundingClientRect();
    
    // Calculate delta
    const deltaX = oldRect.left - newRect.left;
    const deltaY = oldRect.top - newRect.top;

    // Skip if no movement
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

    // Invert: Set initial transform
    element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    element.style.transition = 'none';

    // Force reflow
    element.offsetHeight;

    // Play: Animate to final position
    element.style.transition = `transform ${duration}ms ${easing}`;
    element.style.transform = 'translate(0, 0)';

    animationsCount++;

    // Track completion
    const handleTransitionEnd = () => {
      element.style.transition = '';
      element.removeEventListener('transitionend', handleTransitionEnd);
      animationsCount--;
      
      if (animationsCount === 0 && onComplete) {
        onComplete();
      }
    };

    element.addEventListener('transitionend', handleTransitionEnd);
  });

  // Fallback if no animations
  if (animationsCount === 0 && onComplete) {
    setTimeout(onComplete, 0);
  }
}

/**
 * FLIP with Web Animations API (alternative approach)
 * More control and easier to cancel
 */
export function animatePositionChangesWithWAAPI(
  elements: HTMLElement[],
  oldPositions: Map<HTMLElement, DOMRect>,
  options: FlipAnimationOptions = {}
): Animation[] {
  const {
    duration = 400,
    easing = 'ease-out'
  } = options;

  const animations: Animation[] = [];

  elements.forEach(element => {
    const oldRect = oldPositions.get(element);
    if (!oldRect) return;

    const newRect = element.getBoundingClientRect();
    
    const deltaX = oldRect.left - newRect.left;
    const deltaY = oldRect.top - newRect.top;

    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

    // Use Web Animations API
    const animation = element.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' }
      ],
      {
        duration,
        easing,
        fill: 'none'
      }
    );

    animations.push(animation);
  });

  return animations;
}

/**
 * Helper to get element by tracking identifier
 */
export function getElementByTrackingId(
  container: HTMLElement,
  trackingAttribute: string,
  trackingValue: string
): HTMLElement | null {
  return container.querySelector(`[${trackingAttribute}="${trackingValue}"]`);
}

/**
 * Batch FLIP operation for Angular components
 * Usage in Angular component:
 * 
 * @ViewChild('listContainer') listContainer!: ElementRef;
 * 
 * updateList() {
 *   performFlipAnimation(
 *     () => this.listContainer.nativeElement,
 *     () => {
 *       this.items = sortItems(this.items);
 *       this.cdr.detectChanges();
 *     }
 *   );
 * }
 */
export function performFlipAnimation(
  getContainer: () => HTMLElement,
  updateFn: () => void,
  options?: FlipAnimationOptions
): void {
  const container = getContainer();
  const children = Array.from(container.children) as HTMLElement[];
  
  // First: Capture positions
  const oldPositions = capturePositions(children);
  
  // Last: Update DOM
  updateFn();
  
  // Invert + Play: Animate on next frame
  requestAnimationFrame(() => {
    const newChildren = Array.from(container.children) as HTMLElement[];
    animatePositionChanges(newChildren, oldPositions, options);
  });
}
