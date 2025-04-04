import React from 'react';
import PropTypes from 'prop-types';

/**
 * @component LoadingState
 * @description Componente reutilizable para mostrar estado de carga con animación moderna
 */
const LoadingState = ({ message = 'Cargando...' }) => (
  <div className="p-8 flex flex-col justify-center items-center bg-white rounded-lg shadow-sm transition-all duration-300">
    <div className="relative w-20 h-20 mb-4">
      {/* Círculo exterior pulsante */}
      <div className="absolute inset-0 rounded-full border-4 border-blue-100 opacity-75 animate-ping"></div>
      
      {/* Círculo rotativo */}
      <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
      
      {/* Círculo central */}
      <div className="absolute inset-4 rounded-full bg-blue-50 animate-pulse"></div>
    </div>
    
    <p className="mt-3 text-gray-700 font-medium animate-pulse">{message}</p>
    
    <div className="mt-6 flex space-x-1">
      <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  </div>
);

LoadingState.propTypes = {
  message: PropTypes.string
};

export default LoadingState;
