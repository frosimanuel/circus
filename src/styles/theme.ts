/**
 * Circus Finance Theme Configuration
 *
 * Retro 8-bit arcade aesthetic inspired by Circus Charlie (Konami, 1984)
 * Classic arcade game vibes with pixel-perfect precision.
 */

export const circusTheme = {
  colors: {
    // Primary palette - Classic arcade colors
    primary: {
      red: '#FF0000',        // Pure arcade red
      blue: '#0066FF',       // Classic blue
      yellow: '#FFFF00',     // Bright yellow
      cyan: '#00FFFF',       // Arcade cyan
    },

    // Accent palette - Retro game colors
    accent: {
      green: '#00FF00',      // Bright green
      magenta: '#FF00FF',    // Hot magenta
      orange: '#FF8800',     // Fire orange
      white: '#FFFFFF',      // Pure white
    },

    // Neutral palette - Classic arcade
    neutral: {
      white: '#FFFFFF',
      black: '#000000',
      darkBlue: '#000033',   // Deep arcade background
      gray: {
        100: '#F0F0F0',
        200: '#D0D0D0',
        300: '#A0A0A0',
        400: '#808080',
        500: '#606060',
        600: '#404040',
        700: '#202020',
      }
    },

    // Pixel-perfect patterns
    patterns: {
      stripes: 'repeating-linear-gradient(0deg, #FF0000 0px, #FF0000 8px, #FFFF00 8px, #FFFF00 16px)',
      checkerboard: 'repeating-conic-gradient(#000000 0% 25%, #0066FF 0% 50%)',
      tentStripes: 'repeating-linear-gradient(90deg, #FF0000 0px, #FF0000 40px, #FFFFFF 40px, #FFFFFF 80px)',
    }
  },

  fonts: {
    display: '"Press Start 2P", cursive',  // Classic pixel font
    body: '"VT323", monospace',            // Retro terminal font
    arcade: '"Press Start 2P", cursive',   // Arcade-style text
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
    '4xl': '6rem',
  },

  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },

  shadows: {
    pixel: '4px 4px 0 rgba(0, 0, 0, 1)',        // Pixel-perfect shadow
    pixelLarge: '8px 8px 0 rgba(0, 0, 0, 1)',   // Larger pixel shadow
    arcade: '0 0 10px #FFFF00, 0 0 20px #FF0000', // Arcade glow
    neon: '0 0 5px #00FFFF, 0 0 10px #00FFFF',   // Neon effect
  },

  transitions: {
    instant: '0ms',                              // No transition for pixel-perfect
    fast: '100ms steps(4)',                      // Stepped animation
    base: '200ms steps(8)',                      // Classic arcade timing
    slow: '400ms steps(12)',                     // Slower stepped
  },

  zIndex: {
    base: 1,
    dropdown: 1000,
    overlay: 2000,
    modal: 3000,
    tooltip: 4000,
  }
} as const;

export type CircusTheme = typeof circusTheme;
