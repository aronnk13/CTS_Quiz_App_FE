export type BackgroundType = 'solid' | 'gradient' | 'image';
export type ThemeCategory = 'Professional' | 'Creative' | 'Dark' | 'Light' | 'Animation' | 'Images' | 'Custom';
export type AnimationType = 'none' | 'blinking' | 'moving-stars' | 'snow' | 'confetti' | 'galaxy';
export type FontStyle = 'Arial' | 'Comic Sans MS' | 'Impact' | 'Pacifico' | 'Bangers' | 'Lobster';

export interface ThemeModel {
  id: number;
  name: string;

  backgroundType: BackgroundType;
  backgroundValue: string;  // solid: "#111", gradient: "linear-gradient(...)", image: "https://..."
  textColor: string;        // "#ffffff"
  accentColor?: string;     // buttons/highlights
  cardBgColor?: string;     // panel background
  animation?: AnimationType; // Background animation (only for predefined themes)
  fontStyle?: FontStyle;    // Font style for theme

  isDefault: boolean;
  category?: ThemeCategory; // Theme category for grouping

  // For custom themes created with gradient colors
  gradientColor1?: string;
  gradientColor2?: string;
  
  // Backend returns these names for custom themes
  primaryColor?: string;
  secondaryColor?: string;
}

export interface ThemeCreateModel {
  name: string;
  
  textColor: string;
  accentColor?: string;
  fontStyle?: string;        // Font style
  animation?: string;         // Animation type
  
  // Backend expects these property names
  primaryColor: string;
  secondaryColor: string;
  
  // ✅ IMPORTANT: backgroundColor field stores the background type and value
  // Format: "solid:#hexcolor" | "image:url" | "gradient"
  // - For solid: "solid:#111111"
  // - For image: "image:https://example.com/image.jpg"
  // - For gradient: "gradient" (uses primaryColor + secondaryColor)
  // 
  // ⚠️ BACKEND REQUIREMENT: The API endpoint MUST accept this field
  // If backgroundColor is empty in DB, check:
  // 1. Backend Theme model has BackgroundColor property
  // 2. PUT/POST endpoints accept backgroundColor in request body
  // 3. Backend saves backgroundColor to database
  backgroundColor?: string;  // Should NOT be empty when sending to backend
  
  // ✅ NEW: Separate imageUrl field for image-based themes
  imageUrl?: string;         // Direct image URL (only for backgroundType='image')
  
  category?: string;         // Theme category
}
