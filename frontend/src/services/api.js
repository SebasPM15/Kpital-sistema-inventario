import axios from 'axios';

/**
 * Cache para almacenar respuestas de API y reducir llamadas redundantes
 * @type {Map<string, {data: any, timestamp: number}>}
 */
const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

// Configuración del entorno
const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  retryAttempts: 2,
  retryDelay: 1000,
};

// Configuración para la API del compañero (backend de predicciones)
const PREDICTIONS_API = {
  baseURL: 'http://localhost:3000/api',
  timeout: 15000
};

/**
 * Instancia de axios configurada con interceptores para manejo uniforme de errores
 * @constant
 */
const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

/**
 * Instancia de axios para el backend de predicciones
 * @constant
 */
export const predictionsApi = axios.create({
  baseURL: PREDICTIONS_API.baseURL,
  timeout: PREDICTIONS_API.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Interceptor para añadir información de telemetría
api.interceptors.request.use(
  config => {
    config.metadata = { startTime: Date.now() };
    return config;
  },
  error => Promise.reject(error)
);

// Interceptor para manejo uniforme de errores
api.interceptors.response.use(
  response => {
    // Añadir telemetría
    const duration = Date.now() - response.config.metadata.startTime;
    console.debug(`API call to ${response.config.url} completed in ${duration}ms`);
    return response;
  },
  async error => {
    const originalRequest = error.config;
    const errorMessage = error.response?.data?.error || 
                        error.message || 
                        'Error de conexión con el servidor';
    
    // Añadir información de telemetría
    const duration = Date.now() - originalRequest.metadata.startTime;
                      
    // Información detallada para depuración
    console.error('API Error:', {
      endpoint: originalRequest?.url,
      method: originalRequest?.method,
      status: error.response?.status,
      message: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    // Implementar reintentos para errores de red o 5xx
    if ((!error.response || error.response.status >= 500) && 
        originalRequest._retryCount < API_CONFIG.retryAttempts) {
      
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      // Esperar antes de reintentar (exponential backoff)
      const delay = API_CONFIG.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
      console.log(`Retrying request to ${originalRequest.url} (attempt ${originalRequest._retryCount}/${API_CONFIG.retryAttempts}) in ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalRequest);
    }
    
    return Promise.reject({
      error: errorMessage,
      statusCode: error.response?.status,
      isServerError: error.response?.status >= 500 || !error.response,
      isNetworkError: !error.response
    });
  }
);

// Añadir interceptores similares para la API de predicciones
predictionsApi.interceptors.request.use(
  config => {
    config.metadata = { startTime: Date.now() };
    return config;
  },
  error => Promise.reject(error)
);

predictionsApi.interceptors.response.use(
  response => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.debug(`Predictions API call to ${response.config.url} completed in ${duration}ms`);
    return response;
  },
  async error => {
    const originalRequest = error.config;
    const errorMessage = error.response?.data?.error || 
                        error.message || 
                        'Error de conexión con el servidor';
    
    const duration = Date.now() - originalRequest.metadata.startTime;
                      
    console.error('Predictions API Error:', {
      endpoint: originalRequest?.url,
      method: originalRequest?.method,
      status: error.response?.status,
      message: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    // No implementamos reintentos para la API de predicciones para mantenerlo simple
    return Promise.reject({
      error: errorMessage,
      statusCode: error.response?.status,
      isServerError: error.response?.status >= 500 || !error.response,
      isNetworkError: !error.response
    });
  }
);

/**
 * Genera una clave de caché para una solicitud API basada en endpoint y datos
 * @param {string} endpoint - Ruta del endpoint
 * @param {Object} data - Datos de la solicitud
 * @returns {string} Clave única para esta solicitud
 */
const getCacheKey = (endpoint, data) => {
  return `${endpoint}:${JSON.stringify(data)}`;
};

/**
 * Realiza una solicitud a la API con soporte de caché
 * @param {string} endpoint - Endpoint a llamar
 * @param {Object} data - Datos para enviar
 * @param {boolean} useCache - Si debe usar caché
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Respuesta de la API
 */
const callApi = async (endpoint, data, useCache = true, options = {}) => {
  const cacheKey = getCacheKey(endpoint, data);
  
  // Verificar si tenemos una respuesta en caché válida
  if (useCache) {
    const cachedResponse = apiCache.get(cacheKey);
    if (cachedResponse && (Date.now() - cachedResponse.timestamp) < CACHE_TTL) {
      console.debug(`Using cached response for ${endpoint}`);
      return cachedResponse.data;
    }
  }
  
  // Realizar solicitud y almacenar en caché
  try {
    const response = await api.post(endpoint, data, options);
    
    if (useCache) {
      apiCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
    }
    
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Invalidar manualmente una entrada de caché
 * @param {string} endpoint - Endpoint a invalidar
 * @param {Object} data - Datos de la solicitud específica (opcional)
 */
export const invalidateCache = (endpoint, data = null) => {
  if (data) {
    const cacheKey = getCacheKey(endpoint, data);
    apiCache.delete(cacheKey);
  } else {
    // Eliminar todas las entradas que comienzan con este endpoint
    for (const key of apiCache.keys()) {
      if (key.startsWith(`${endpoint}:`)) {
        apiCache.delete(key);
      }
    }
  }
};

/**
 * Calcula información de inventario basada en histórico de consumo
 * @param {Object} data - Datos del inventario
 * @param {Array<number>} data.historico - Histórico de consumo
 * @param {number} data.stock_actual - Stock actual en unidades
 * @param {number} data.unidades_por_caja - Unidades por caja
 * @returns {Promise<Object>} Resultado del cálculo
 */
export const calcularInventario = async (data) => {
  return callApi('/calculate', data);
};

/**
 * Simula escenarios de inventario con aumento/disminución de demanda
 * @param {Object} data - Datos para simulación
 * @param {Array<number>} data.historico - Histórico de consumo
 * @param {number} data.aumento - Porcentaje de aumento de demanda
 * @param {number} data.stock_actual - Stock actual en unidades
 * @param {number} data.unidades_por_caja - Unidades por caja
 * @returns {Promise<Object>} Resultado de la simulación
 */
export const simularEscenario = async (data) => {
  return callApi('/simulate', data, false); // No usar caché para simulaciones
};

/**
 * Funciones para interactuar con el backend de predicciones
 */

/**
 * Obtiene todas las predicciones
 * @returns {Promise<Array>} Array de predicciones
 */
export const getAllPredictions = async () => {
  try {
    const response = await predictionsApi.get('/predictions');
    return response.data.data || [];
  } catch (error) {
    console.error('Error getting predictions:', error);
    throw error;
  }
};

/**
 * Obtiene la predicción para un producto específico
 * @param {string} code - Código del producto
 * @param {number} unidadesTransito - Unidades en tránsito (opcional)
 * @returns {Promise<Object>} Datos de predicción del producto
 */
export const getPredictionByCode = async (code, unidadesTransito = 0) => {
  try {
    console.log(`Solicitando datos para el código: ${code} con ${unidadesTransito} unidades en tránsito`);
    
    // Usar axios directamente para evitar problemas con instancias personalizadas
    const response = await axios.get(`${PREDICTIONS_API.baseURL}/predictions/${code}`, {
      params: {
        unidades_transito: unidadesTransito // Añadimos el parámetro aunque el backend lo ignore por ahora
      }
    });
    
    // Registrar la respuesta completa para depuración
    console.log('Respuesta completa del backend:', response);
    
    let data;
    
    // Adaptarse a diferentes estructuras de respuesta
    if (response.data && response.data.success && response.data.data) {
      data = response.data.data;
      console.log('Usando datos de response.data.data');
    } else if (response.data && typeof response.data === 'object') {
      data = response.data;
      console.log('Usando datos directamente de response.data');
    } else {
      throw new Error('Formato de respuesta no reconocido');
    }
    
    // Verificar campos críticos y registrar posibles problemas
    const camposEsperados = [
      'CODIGO', 'DESCRIPCION', 'UNID_POR_CAJA', 'STOCK_ACTUAL', 'CONSUMO_PROMEDIO',
      'PROYECCION_CONSUMO', 'CONSUMO_TOTAL_PROYECTADO', 'CONSUMO_DIARIO',
      'STOCK_SEGURIDAD', 'STOCK_MINIMO', 'PUNTO_REORDEN', 'DEFICIT_ACTUAL',
      'CAJAS_NECESARIAS', 'CAJAS_A_PEDIR', 'UNIDADES_A_PEDIR', 'CONSUMOS_HISTORICOS', 'PREDICCION'
    ];
    
    const camposDisponibles = Object.keys(data);
    console.log('Campos disponibles en la respuesta:', camposDisponibles);
    
    camposEsperados.forEach(campo => {
      if (!camposDisponibles.includes(campo)) {
        console.warn(`Campo esperado '${campo}' no encontrado en la respuesta`);
      }
    });
    
    // Si el campo de PREDICCION existe, verificar su estructura
    if (data.PREDICCION) {
      console.log('Estructura de PREDICCION:', 
        Array.isArray(data.PREDICCION) 
          ? `Array con ${data.PREDICCION.length} elementos` 
          : typeof data.PREDICCION
      );
      
      if (Array.isArray(data.PREDICCION) && data.PREDICCION.length > 0) {
        console.log('Muestra del primer item de PREDICCION:', data.PREDICCION[0]);
      }
    } else {
      console.warn('Campo PREDICCION no encontrado en la respuesta');
    }
    
    return data;
  } catch (error) {
    console.error(`Error obteniendo predicción para código ${code}:`, error);
    throw error;
  }
};

/**
 * Aplica unidades en tránsito a un producto específico
 * @param {string} code - Código del producto
 * @param {number} units - Unidades en tránsito a aplicar
 * @returns {Promise<Object>} Datos actualizados del producto
 */
export const applyTransitUnits = async (code, units) => {
  try {
    const response = await predictionsApi.post(`/predictions/${code}/transit`, {
      units: units
    });
    
    // Invalidar caché para este producto si es necesario
    invalidateCache(`/predictions/${code}`);
    
    return response.data;
  } catch (error) {
    console.error(`Error applying transit units to product ${code}:`, error);
    throw error;
  }
};

/**
 * Sube un archivo Excel para actualizar predicciones
 * @param {File} file - Archivo Excel a subir
 * @returns {Promise<Object>} Respuesta del servidor
 */
export const uploadExcelForPredictions = async (file) => {
  try {
    const formData = new FormData();
    formData.append('excel', file);
    
    // Asegurarse de usar POST para el endpoint refresh
    const response = await axios.post(`${PREDICTIONS_API.baseURL}/predictions/refresh`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    console.log('Excel upload response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading Excel file:', error);
    throw error;
  }
};

export default api;
