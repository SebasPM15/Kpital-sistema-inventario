import React from 'react';
import PropTypes from 'prop-types';

/**
 * @component ErrorState
 * @description Componente para mostrar mensajes de error con estilo moderno y opciones de recuperación
 */
const ErrorState = ({ error, onRetry, className = '' }) => {
  // Estimar la gravedad del error basado en el texto
  const isSevere = error && (
    error.toLowerCase().includes('servidor') || 
    error.toLowerCase().includes('conexión') ||
    error.toLowerCase().includes('fatal')
  );

  // Mensaje de acción personalizado según la severidad
  const actionText = isSevere 
    ? 'Parece que hay un problema con el servidor o la conexión.' 
    : 'Podemos intentarlo nuevamente.';

  return (
    <div className={`error-state bg-white p-6 rounded-xl shadow-sm ${className} scale`}>
      <div className="flex items-start space-x-4">
        <div className="error-icon-container flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-red-100">
          <svg 
            className="w-7 h-7 text-red-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        <div className="flex-grow">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Error</h3>
          <p className="text-red-600 mb-3">{error}</p>
          
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
            <p className="text-sm text-gray-700">{actionText}</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-300 hover:shadow-md transform hover:-translate-y-1"
                aria-label="Intentar nuevamente"
              >
                <div className="flex items-center">
                  <svg 
                    className="w-4 h-4 mr-2" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                  Intentar nuevamente
                </div>
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-all duration-300"
              aria-label="Recargar página"
            >
              <div className="flex items-center">
                <svg 
                  className="w-4 h-4 mr-2" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                Recargar página
              </div>
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-xs text-gray-500">
        <p>Si el problema persiste, contacte con soporte técnico.</p>
      </div>
    </div>
  );
};

ErrorState.propTypes = {
  error: PropTypes.string.isRequired,
  onRetry: PropTypes.func,
  className: PropTypes.string
};

export default ErrorState;
