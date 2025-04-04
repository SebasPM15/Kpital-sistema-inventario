/**
 * Sistema de diseño centralizado para la aplicación
 * Contiene paleta de colores, variables de tamaño, espaciado, etc.
 */

export const theme = {
  // Paleta de colores principal (moderna)
  colors: {
    primary: '#2563EB', // Azul moderno (tailwind)
    secondary: '#10B981', // Verde esmeralda
    accent: '#F59E0B', // Naranja vibrante
    background: '#FDFDFD', // Blanco ultra claro
    surface: '#FFFFFF', // Blanco puro
    error: '#DC2626', // Rojo error
    success: '#16A34A', // Verde éxito
    warning: '#F59E0B', // Amarillo advertencia
    info: '#3B82F6', // Azul información
    text: {
      primary: '#1F2937', // Texto principal
      secondary: '#4B5563', // Texto secundario
      muted: '#6B7280', // Texto atenuado
      white: '#FFFFFF', // Texto blanco
    },
    gradient: {
      primary: 'linear-gradient(135deg, #3B82F6, #2563EB)',
      success: 'linear-gradient(135deg, #10B981, #059669)',
      warning: 'linear-gradient(135deg, #F59E0B, #D97706)',
      error: 'linear-gradient(135deg, #DC2626, #B91C1C)',
    }
  },
  
  // Tipografía
  typography: {
    fontFamily: "'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif",
    fontSizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    }
  },
  
  // Espacio y tamaños
  spacing: {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '2.5rem', // 40px
    '3xl': '3rem',   // 48px
  },
  
  // Bordes y sombras
  borders: {
    radius: {
      sm: '0.25rem',  // 4px
      md: '0.5rem',   // 8px
      lg: '0.75rem',  // 12px
      xl: '1rem',     // 16px
      full: '9999px', // Circular
    },
    width: {
      thin: '1px',
      normal: '2px',
      thick: '4px',
    }
  },
  
  // Sombras modernas con blur suave
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
    md: '0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.03)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.04), 0 4px 6px rgba(0, 0, 0, 0.02)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.04), 0 8px 10px rgba(0, 0, 0, 0.02)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.03)',
  },
  
  // Transiciones
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // Breakpoints para responsive
  breakpoints: {
    xs: '480px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // Z-indices
  zIndices: {
    base: 0,
    elevated: 10,
    dropdown: 1000,
    sticky: 1100,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1800,
  },
  
  // Estilos específicos para componentes
  components: {
    button: {
      primary: {
        bg: '#2563EB',
        hover: '#1D4ED8',
        text: '#FFFFFF',
      },
      secondary: {
        bg: '#10B981',
        hover: '#059669',
        text: '#FFFFFF',
      },
      accent: {
        bg: '#F59E0B',
        hover: '#D97706',
        text: '#FFFFFF',
      },
    },
    card: {
      bgColor: '#FFFFFF',
      shadow: '0 4px 6px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.03)',
      borderRadius: '0.75rem',
    },
    input: {
      borderColor: '#E5E7EB',
      focusBorderColor: '#3B82F6',
      errorBorderColor: '#DC2626',
      borderRadius: '0.5rem',
    },
    navbar: {
      height: '64px',
      bgColor: '#FFFFFF',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    },
    // Nuevos componentes visuales
    glassmorphism: {
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    gradient: {
      primary: 'linear-gradient(90deg, #3B82F6, #2563EB)',
      success: 'linear-gradient(90deg, #10B981, #059669)',
      warning: 'linear-gradient(90deg, #F59E0B, #D97706)',
      error: 'linear-gradient(90deg, #DC2626, #B91C1C)',
    }
  }
};

export default theme;
