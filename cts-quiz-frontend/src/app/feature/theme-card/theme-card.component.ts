// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-theme-card',
//   imports: [],
//   templateUrl: './theme-card.component.html',
//   styleUrl: './theme-card.component.css'
// })
// export class ThemeCardComponent {

// }

import { Component, EventEmitter, Input, input, Output, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeModel } from '../../models/theme.model';

@Component({
  selector: 'app-theme-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-card.component.html',
  styleUrl: './theme-card.component.css'
})
export class ThemeCardComponent implements OnInit {
  // theme = input.required<ThemeModel>();
  // select = output<ThemeModel>();
  
@Input({ required: true }) theme!: ThemeModel; // ✅ must be ThemeModel
  @Output() select = new EventEmitter<ThemeModel>();
  @Output() delete = new EventEmitter<ThemeModel>();
  @Output() edit = new EventEmitter<ThemeModel>();

  // ✅ Log theme details when component initializes
  ngOnInit() {
    console.log('🎴 Theme card initialized:', {
      name: this.theme.name,
      id: this.theme.id,
      isDefault: this.theme.isDefault,
      showButtons: !this.theme.isDefault
    });
  }

  // ✅ Check if theme can be edited/deleted
  canModify(): boolean {
    // Don't allow modification of default themes
    if (this.theme.isDefault) return false;
    
    // Don't allow modification of Light, Dark, Ocean category themes
    const protectedCategories = ['Light', 'Dark', 'Ocean', 'Professional', 'Creative'];
    if (this.theme.category && protectedCategories.includes(this.theme.category)) {
      return false;
    }
    
    // Additional check: protect specific theme names regardless of category
    const themeName = this.theme.name?.toLowerCase() || '';
    const protectedKeywords = ['light', 'dark', 'ocean', 'midnight', 'minimal', 'breeze', 'professional', 'creative'];
    const isProtectedByName = protectedKeywords.some(keyword => themeName.includes(keyword));
    
    if (isProtectedByName) {
      return false;
    }
    
    // Only allow modification of truly custom user-created themes
    return this.theme.category === 'Custom';
  }

  onSelect() {
    this.select.emit(this.theme);
  }

  onEdit(event: Event) {
    console.log('🖱️ Edit button clicked in theme-card component');
    console.log('Theme:', this.theme);
    event.stopPropagation(); // Prevent card click
    event.preventDefault(); // Prevent any default behavior
    console.log('Emitting edit event...');
    this.edit.emit(this.theme);
    console.log('Edit event emitted');
  }

  onDelete(event: Event) {
    event.stopPropagation(); // Prevent card click
    if (confirm(`Are you sure you want to delete "${this.theme.name}"?`)) {
      this.delete.emit(this.theme);
    }
  }

  previewStyle() {
    if (!this.theme) return {};

    // Priority 1: Check backgroundType and backgroundValue first (handles images, solids, and predefined themes)
    if (this.theme.backgroundType && this.theme.backgroundValue) {
      if (this.theme.backgroundType === 'image') {
        return {
          'background-image': `url('${this.theme.backgroundValue}')`,
          'background-size': 'cover',
          'background-position': 'center',
          'background-repeat': 'no-repeat',
          'background-color': '#000'
        };
      }
      
      // solid or gradient with backgroundValue
      return { background: this.theme.backgroundValue };
    }

    // Priority 2: For custom themes with gradient colors (fallback)
    const gradientColor1 = this.theme.gradientColor1 || this.theme.primaryColor;
    const gradientColor2 = this.theme.gradientColor2 || this.theme.secondaryColor;
    
    if (gradientColor1 && gradientColor2) {
      return {
        background: `linear-gradient(135deg, ${gradientColor1}, ${gradientColor2})`
      };
    }

    // Fallback
    return { background: '#111111' };
  }
}
