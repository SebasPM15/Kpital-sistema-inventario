/**
 * Utility functions for consistent date handling across the application
 * @module dateUtils
 */

// Constantes para tiempo zonal de Ecuador (UTC-5)
const ECUADOR_OFFSET_MINUTES = 300; // UTC-5 en minutos
const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Ajusta una fecha a la zona horaria de Ecuador (UTC-5)
 * @param {Date|string} date - Fecha a ajustar
 * @returns {Date} Fecha ajustada a Ecuador o null si es inválida
 * @private
 */
const adjustToEcuadorTimezone = (date) => {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return null;
    }
    
    // Calcular ajuste de zona horaria
    const localOffset = dateObj.getTimezoneOffset();
    const totalOffset = localOffset + ECUADOR_OFFSET_MINUTES;
    
    // Crear nueva fecha ajustada a Ecuador
    return new Date(dateObj.getTime() + totalOffset * 60 * 1000);
  } catch (error) {
    console.error('Error ajustando fecha a zona horaria de Ecuador:', error);
    return null;
  }
};

/**
 * Normalizes date strings to Ecuador timezone (UTC-5) to avoid issues with day calculations
 * @param {string} dateString - ISO date string to normalize
 * @returns {string} Normalized date in YYYY-MM-DD format
 */
export const normalizeDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    const ecuadorDate = adjustToEcuadorTimezone(dateString);
    
    if (!ecuadorDate) {
      console.error(`Invalid date: ${dateString}`);
      return '';
    }
    
    // Format as YYYY-MM-DD
    const year = ecuadorDate.getFullYear();
    const month = String(ecuadorDate.getMonth() + 1).padStart(2, '0');
    const day = String(ecuadorDate.getDate()).padStart(2, '0');
    
    const result = `${year}-${month}-${day}`;
    return result;
  } catch (error) {
    console.error(`Error normalizing date: ${error.message}`);
    return '';
  }
};

/**
 * Formats a date for chart display with clear day of week (using Ecuador timezone)
 * @param {string} dateString - ISO date string to format
 * @returns {string} Formatted date string (e.g. "LUN 01-ene")
 */
export const formatChartDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    const ecuadorDate = adjustToEcuadorTimezone(dateString);
    
    if (!ecuadorDate) {
      return 'Invalid date';
    }
    
    // Get day of week
    const dayOfWeek = DAY_NAMES[ecuadorDate.getDay()];
    
    // Format day and month
    const day = String(ecuadorDate.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[ecuadorDate.getMonth()];
    
    return `${dayOfWeek} ${day}-${month}`;
  } catch (error) {
    console.error(`Error formatting date: ${error.message}`);
    return 'Error';
  }
};

/**
 * Checks if a date is a weekend (Saturday or Sunday) in Ecuador timezone
 * @param {string} dateString - ISO date string to check
 * @returns {boolean} True if the date is a weekend
 */
export const isWeekend = (dateString) => {
  try {
    const ecuadorDate = adjustToEcuadorTimezone(dateString);
    
    if (!ecuadorDate) {
      return false;
    }
    
    const day = ecuadorDate.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  } catch (error) {
    console.error(`Error checking weekend: ${error.message}`);
    return false;
  }
};

/**
 * Formats a date to a human-readable string
 * @param {string} dateString - ISO date string to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, options = {}) => {
  const { 
    showYear = true, 
    showWeekday = false, 
    format = 'short' 
  } = options;
  
  try {
    const ecuadorDate = adjustToEcuadorTimezone(dateString);
    
    if (!ecuadorDate) {
      return 'Invalid date';
    }
    
    const day = String(ecuadorDate.getDate()).padStart(2, '0');
    const month = format === 'short' 
      ? MONTH_NAMES[ecuadorDate.getMonth()]
      : String(ecuadorDate.getMonth() + 1).padStart(2, '0');
    
    let result = `${day}-${month}`;
    
    if (showYear) {
      result += `-${ecuadorDate.getFullYear()}`;
    }
    
    if (showWeekday) {
      result = `${DAY_NAMES[ecuadorDate.getDay()]}, ${result}`;
    }
    
    return result;
  } catch (error) {
    console.error(`Error formatting date: ${error.message}`);
    return 'Error';
  }
};
