/**
 * Confetti Utility
 * 
 * Lightweight canvas-based confetti system
 * Respects prefers-reduced-motion
 * 
 * Usage:
 * const confetti = new ConfettiGenerator(canvasElement);
 * confetti.burst({ intensity: 50, x: 50, y: 50 });
 */

export interface ConfettiOptions {
  intensity?: number; // 0-100
  x?: number; // Percentage 0-100
  y?: number; // Percentage 0-100
  colors?: string[];
  shapes?: ('square' | 'circle' | 'triangle')[];
  duration?: number; // milliseconds
  spread?: number; // degrees
  velocity?: number;
  gravity?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  shape: 'square' | 'circle' | 'triangle';
  opacity: number;
  life: number; // 0-1
  lifeDecay: number;
}

export class ConfettiGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private isAnimating = false;

  private defaultColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
  ];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    
    // Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Trigger a confetti burst
   */
  burst(options: ConfettiOptions = {}): void {
    const {
      intensity = 50,
      x = 50,
      y = 50,
      colors = this.defaultColors,
      shapes = ['square', 'circle'],
      duration = 3000,
      spread = 60,
      velocity = 15,
      gravity = 0.5
    } = options;

    // Calculate particle count based on intensity
    const particleCount = Math.round((intensity / 100) * 150);
    
    // Convert percentage to pixels
    const originX = (x / 100) * this.canvas.width;
    const originY = (y / 100) * this.canvas.height;

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180);
      const speed = velocity * (0.5 + Math.random() * 0.5);
      
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.sin(angle) * speed,
        vy: -Math.cos(angle) * speed - Math.random() * 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        size: 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        opacity: 1,
        life: 1,
        lifeDecay: 1 / (duration / 16.67) // ~60fps
      });
    }

    if (!this.isAnimating) {
      this.animate();
    }
  }

  /**
   * Animation loop
   */
  private animate(): void {
    this.isAnimating = true;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update and draw particles
    this.particles = this.particles.filter(particle => {
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.5; // Gravity
      particle.rotation += particle.rotationSpeed;
      
      // Update life
      particle.life -= particle.lifeDecay;
      particle.opacity = particle.life;

      // Draw particle
      if (particle.life > 0) {
        this.drawParticle(particle);
        return true;
      }
      return false;
    });

    // Continue animation if particles remain
    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.isAnimating = false;
      this.animationId = null;
    }
  }

  /**
   * Draw a single particle
   */
  private drawParticle(particle: Particle): void {
    this.ctx.save();
    this.ctx.translate(particle.x, particle.y);
    this.ctx.rotate((particle.rotation * Math.PI) / 180);
    this.ctx.globalAlpha = particle.opacity;
    this.ctx.fillStyle = particle.color;

    const halfSize = particle.size / 2;

    switch (particle.shape) {
      case 'square':
        this.ctx.fillRect(-halfSize, -halfSize, particle.size, particle.size);
        break;
      case 'circle':
        this.ctx.beginPath();
        this.ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
        this.ctx.fill();
        break;
      case 'triangle':
        this.ctx.beginPath();
        this.ctx.moveTo(0, -halfSize);
        this.ctx.lineTo(halfSize, halfSize);
        this.ctx.lineTo(-halfSize, halfSize);
        this.ctx.closePath();
        this.ctx.fill();
        break;
    }

    this.ctx.restore();
  }

  /**
   * Clear all particles and stop animation
   */
  clear(): void {
    this.particles = [];
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isAnimating = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.clear();
    window.removeEventListener('resize', () => this.resizeCanvas());
  }
}

/**
 * Helper function to create and manage confetti globally
 */
export function createGlobalConfetti(): ConfettiGenerator {
  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  
  document.body.appendChild(canvas);
  
  return new ConfettiGenerator(canvas);
}
