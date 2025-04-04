import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { simularEscenario } from '../services/api';
import StockProjection from './StockProjection';

/**
 * @component FormField
 * @description Componente reutilizable para campos de formulario con manejo de errores
 */
const FormField = memo(function FormField({ 
  id, label, error, required = false, children, hint, className = '' 
}) {
  return (
    <div className={`form-group ${className}`}>
      <label htmlFor={id} className="block font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>
      )}
      {hint && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
});

FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  error: PropTypes.string,
  required: PropTypes.bool,
  children: PropTypes.node.isRequired,
  hint: PropTypes.node,
  className: PropTypes.string
};

/**
 * Hook personalizado para manejar el formulario de simulación
 * @returns {Object} Estado y funciones para manejar el formulario
 */
const useSimulatorForm = () => {
  // Intentamos obtener datos guardados previamente del localStorage
  const getSavedData = useCallback(() => {
    try {
      const savedData = localStorage.getItem('simulator-form');
      return savedData ? JSON.parse(savedData) : null;
    } catch (error) {
      console.error('Error al recuperar datos guardados:', error);
      return null;
    }
  }, []);

  const savedData = useMemo(() => getSavedData(), [getSavedData]);
  
  // Estado inicial del formulario con valores por defecto significativos
  const [historico, setHistorico] = useState(savedData?.historico || [10, 12, 15, 9, 10]);
  const [aumento, setAumento] = useState(savedData?.aumento || '10');
  const [stockActual, setStockActual] = useState(savedData?.stockActual || '100');
  const [unidadesPorCaja, setUnidadesPorCaja] = useState(savedData?.unidadesPorCaja || '24');
  const [resultado, setResultado] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Referencia para hacer scroll a resultados
  const resultadoRef = useRef(null);

  // Efecto para scrollear a los resultados cuando estén disponibles
  useEffect(() => {
    if (resultado && resultadoRef.current) {
      resultadoRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [resultado]);

  /**
   * Valida todos los campos del formulario
   * @returns {boolean} True si el formulario es válido
   */
  const validateForm = useCallback(() => {
    const errors = {};
    
    // Validar histórico
    if (historico.length === 0) {
      errors.historico = 'Debe ingresar al menos un mes de histórico';
    } else if (historico.length > 12) {
      errors.historico = 'El histórico no puede tener más de 12 meses';
    } else if (historico.every(val => val === 0)) {
      errors.historico = 'Debe ingresar al menos un valor mayor a cero';
    }
    
    // Validar aumento
    if (aumento === '') {
      errors.aumento = 'Debe ingresar un porcentaje';
    } else if (isNaN(parseFloat(aumento))) {
      errors.aumento = 'Debe ser un número válido';
    } else if (parseFloat(aumento) < -100) {
      errors.aumento = 'La disminución no puede ser menor a -100%';
    } else if (parseFloat(aumento) > 500) {
      errors.aumento = 'El aumento no puede ser mayor a 500%';
    }
    
    // Validar stock actual
    if (stockActual === '') {
      errors.stockActual = 'Debe ingresar el stock actual';
    } else if (isNaN(parseFloat(stockActual)) || parseFloat(stockActual) < 0) {
      errors.stockActual = 'Debe ser un número positivo';
    }
    
    // Validar unidades por caja
    if (unidadesPorCaja === '') {
      errors.unidadesPorCaja = 'Debe ingresar las unidades por caja';
    } else if (isNaN(parseInt(unidadesPorCaja)) || parseInt(unidadesPorCaja) <= 0) {
      errors.unidadesPorCaja = 'Debe ser un número entero mayor a cero';
    } else if (!Number.isInteger(Number(unidadesPorCaja))) {
      errors.unidadesPorCaja = 'Debe ser un número entero';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [historico, aumento, stockActual, unidadesPorCaja]);

  /**
   * Guarda los datos del formulario en localStorage
   */
  const saveFormData = useCallback(() => {
    try {
      localStorage.setItem('simulator-form', JSON.stringify({
        historico,
        aumento,
        stockActual,
        unidadesPorCaja
      }));
    } catch (error) {
      console.error('Error al guardar datos del formulario:', error);
    }
  }, [historico, aumento, stockActual, unidadesPorCaja]);

  // Guardar automáticamente cuando cualquier valor cambie
  useEffect(() => {
    if (isFormSubmitted) {
      saveFormData();
    }
  }, [historico, aumento, stockActual, unidadesPorCaja, isFormSubmitted, saveFormData]);

  // Agregar un mes al histórico
  const addMonth = useCallback(() => {
    if (historico.length < 12) {
      const newHistorico = [...historico, 0];
      setHistorico(newHistorico);
      if (isFormSubmitted) {
        setFormErrors(prev => {
          const newErrors = { ...prev };
          if (newHistorico.some(val => val > 0)) {
            delete newErrors.historico;
          }
          return newErrors;
        });
      }
    }
  }, [historico, isFormSubmitted]);

  // Eliminar el último mes del histórico
  const removeMonth = useCallback(() => {
    if (historico.length > 1) {
      const newHistorico = historico.slice(0, -1);
      setHistorico(newHistorico);
      if (isFormSubmitted) {
        setFormErrors(prev => {
          const newErrors = { ...prev };
          if (newHistorico.every(val => val === 0)) {
            newErrors.historico = 'Debe ingresar al menos un valor mayor a cero';
          }
          return newErrors;
        });
      }
    }
  }, [historico, isFormSubmitted]);

  /**
   * Maneja el cambio en los campos del histórico
   * @param {number} idx Índice del mes a modificar
   * @param {string} value Nuevo valor
   */
  const handleHistoricoChange = useCallback((idx, value) => {
    const newHistorico = [...historico];
    newHistorico[idx] = parseFloat(value) || 0;
    setHistorico(newHistorico);
    if (isFormSubmitted) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        if (newHistorico.some(val => val > 0)) {
          delete newErrors.historico;
        } else {
          newErrors.historico = 'Debe ingresar al menos un valor mayor a cero';
        }
        return newErrors;
      });
    }
  }, [historico, isFormSubmitted]);

  /**
   * Maneja el envío del formulario
   * @param {Event} e Evento de submit
   */
  const handleSimulate = useCallback(async (e) => {
    e.preventDefault();
    setIsFormSubmitted(true);
    setShowSuccessMessage(false);
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      saveFormData();
      
      const response = await simularEscenario({
        historico: historico.map(Number),
        aumento: parseFloat(aumento),
        stock_actual: parseFloat(stockActual),
        unidades_por_caja: parseInt(unidadesPorCaja),
      });
      
      setResultado(response);
      setShowSuccessMessage(true);
      
      // Auto-ocultar el mensaje de éxito después de 5 segundos
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
    } catch (error) {
      console.error('Error en simulación:', error);
      setError(error.error || 'Algo salió mal. Por favor, intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }, [historico, aumento, stockActual, unidadesPorCaja, validateForm, saveFormData]);

  // Función para limpiar el formulario
  const resetForm = useCallback(() => {
    setHistorico([0, 0, 0, 0, 0]);
    setAumento('');
    setStockActual('');
    setUnidadesPorCaja('');
    setFormErrors({});
    setIsFormSubmitted(false);
    setResultado(null);
    setError(null);
  }, []);

  return {
    historico,
    aumento,
    stockActual,
    unidadesPorCaja,
    resultado,
    isLoading,
    error,
    formErrors,
    showSuccessMessage,
    resultadoRef,
    handleHistoricoChange,
    setAumento,
    setStockActual,
    setUnidadesPorCaja,
    handleSimulate,
    addMonth,
    removeMonth,
    resetForm
  };
};

/**
 * @component Simulator
 * @description Componente para simular escenarios de consumo de inventario con diversos parámetros
 */
const Simulator = memo(function Simulator() {
  const {
    historico,
    aumento,
    stockActual,
    unidadesPorCaja,
    resultado,
    isLoading,
    error,
    formErrors,
    showSuccessMessage,
    resultadoRef,
    handleHistoricoChange,
    setAumento,
    setStockActual,
    setUnidadesPorCaja,
    handleSimulate,
    addMonth,
    removeMonth,
    resetForm
  } = useSimulatorForm();

  /**
   * Renderiza un mensaje de error para un campo específico
   * @param {string} field Nombre del campo
   * @returns {JSX.Element|null} Elemento JSX con el mensaje de error o null
   */
  const renderFieldError = useCallback((field) => {
    return formErrors[field] ? (
      <p className="mt-1 text-sm text-red-600" role="alert">{formErrors[field]}</p>
    ) : null;
  }, [formErrors]);

  // Memoizar el renderizado de los resultados
  const memoizedResult = useMemo(() => {
    if (!resultado) return null;
    
    // Determinar clase CSS basada en nivel de alerta
    const getAlertClass = (nivel) => {
      const nivelLower = nivel?.toLowerCase() || '';
      if (nivelLower === 'crítica') return 'bg-red-100 border-l-4 border-red-500';
      if (nivelLower === 'moderada') return 'bg-yellow-100 border-l-4 border-yellow-500';
      return 'bg-green-100 border-l-4 border-green-500';
    };

    // Función para formatear números grandes
    const formatNumber = (num) => {
      return new Intl.NumberFormat('es-ES', { 
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      }).format(num);
    };

    // Usar los valores de consumo diario calculados por el backend
    const consumoDiario = resultado.consumo_diario || 0;
    const consumoDiarioProyectado = resultado.consumo_diario_proyectado || 0;
    
    return (
      <div 
        ref={resultadoRef}
        className="resultado-container mt-8 bg-white p-6 rounded-lg shadow-md animate-fadeIn"
      >
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-xl font-semibold text-gray-800">Resultados de la Simulación</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">
              Simulación con {Math.abs(parseFloat(aumento))}% de {parseFloat(aumento) >= 0 ? 'aumento' : 'disminución'}
            </span>
            <button
              onClick={() => window.print()}
              className="p-1 bg-gray-100 rounded hover:bg-gray-200 text-gray-700"
              aria-label="Imprimir resultados"
            >
              <span className="text-md">🖨️</span>
            </button>
          </div>
        </div>
        
        <div className="resultado-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="resultado-item bg-blue-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
            <div className="flex justify-between items-start">
              <span className="block text-sm text-gray-600">Consumo Promedio</span>
              <span className="text-xl" aria-hidden="true">📊</span>
            </div>
            <div className="text-lg text-blue-700 font-bold mt-1">
              {formatNumber(resultado.consumo_promedio)}
              <span className="text-xs ml-1 font-normal whitespace-nowrap">u/mes</span>
            </div>
          </div>
          
          <div className="resultado-item bg-green-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
            <div className="flex justify-between items-start">
              <span className="block text-sm text-gray-600">Stock Mínimo</span>
              <span className="text-xl" aria-hidden="true">🛡️</span>
            </div>
            <div className="text-lg text-green-700 font-bold mt-1">
              {formatNumber(resultado.stock_minimo)}
              <span className="text-xs ml-1 font-normal whitespace-nowrap">u</span>
            </div>
          </div>
          
          <div className="resultado-item bg-purple-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
            <div className="flex justify-between items-start">
              <span className="block text-sm text-gray-600">Punto de Reorden</span>
              <span className="text-xl" aria-hidden="true">⚡</span>
            </div>
            <div className="text-lg text-purple-700 font-bold mt-1">
              {formatNumber(resultado.punto_reorden)}
              <span className="text-xs ml-1 font-normal whitespace-nowrap">u</span>
            </div>
          </div>
          
          <div className={`resultado-item p-4 rounded-lg transform hover:scale-105 transition-transform ${resultado.stock_proyectado < 0 ? 'bg-red-50' : 'bg-blue-50'}`}>
            <div className="flex justify-between items-start">
              <span className="block text-sm text-gray-600">Stock Proyectado</span>
              <span className="text-xl" aria-hidden="true">{resultado.stock_proyectado < 0 ? '⚠️' : '📈'}</span>
            </div>
            <div className={`text-lg ${resultado.stock_proyectado < 0 ? 'text-red-700' : 'text-blue-700'} font-bold mt-1`}>
              {formatNumber(resultado.stock_proyectado)}
              <span className="text-xs ml-1 font-normal whitespace-nowrap">u</span>
            </div>
            {resultado.stock_proyectado < 0 && (
              <div className="stock-warning mt-1 text-sm font-medium text-red-600">¡Posible desabasto!</div>
            )}
          </div>
        </div>

        {/* Consumo diario calculado desde el backend */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="resultado-item bg-amber-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
            <div className="flex justify-between items-start">
              <span className="block text-sm text-gray-600">Consumo Diario Actual</span>
              <span className="text-xl" aria-hidden="true">📆</span>
            </div>
            <div className="text-lg text-amber-700 font-bold mt-1">
              {formatNumber(consumoDiario)}
              <span className="text-xs ml-1 font-normal whitespace-nowrap">u/día</span>
            </div>
          </div>
          
          <div className="resultado-item bg-cyan-50 p-4 rounded-lg transform hover:scale-105 transition-transform">
            <div className="flex justify-between items-start">
              <span className="block text-sm text-gray-600">Consumo Diario Proyectado</span>
              <span className="text-xl" aria-hidden="true">🔮</span>
            </div>
            <div className="text-lg text-cyan-700 font-bold mt-1">
              {formatNumber(consumoDiarioProyectado)}
              <span className="text-xs ml-1 font-normal whitespace-nowrap">u/día</span>
            </div>
          </div>
        </div>
        
        <div className={`alerta-box mt-6 p-4 rounded-lg ${getAlertClass(resultado.alerta?.nivel)}`}>
          <h4 className="text-lg font-bold">ALERTA: {resultado.alerta.nivel}</h4>
          <p className="my-2">{resultado.alerta.accion}</p>
          
          {resultado.cantidad_pedir > 0 && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
              <p className="font-medium">
                <strong>Cantidad a Pedir:</strong> {formatNumber(resultado.cantidad_pedir)} unidades 
                ({Math.ceil(resultado.cantidad_pedir / parseInt(unidadesPorCaja))} cajas)
              </p>
              <p className="font-medium mt-1">
                <strong>Fecha sugerida para ordenar:</strong> {resultado.fecha_sugerida}
              </p>
            </div>
          )}
        </div>
        
        {resultado.prediccion && resultado.prediccion.length > 0 && (
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-4 border-b pb-2">Proyección con {parseFloat(aumento) >= 0 ? 'Aumento' : 'Disminución'} de Demanda</h4>
            <StockProjection 
              data={resultado.prediccion} 
              punto_reorden={resultado.punto_reorden} 
              stock_minimo={resultado.stock_minimo} 
            />
          </div>
        )}
      </div>
    );
  }, [resultado, unidadesPorCaja, aumento, resultadoRef, stockActual]);

  return (
    <div className="simulator-container">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Simulador de Escenarios</h2>
      
      {showSuccessMessage && (
        <div className="success-message mb-6 p-4 bg-green-50 border-l-4 border-green-600 rounded-r-lg animate-fadeIn" role="status">
          <p className="text-green-700">Simulación completada exitosamente</p>
        </div>
      )}
      
      {error && (
        <div className="error-message mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg" role="alert">
          <div className="flex items-center">
            <p className="text-red-700 flex-grow">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="ml-3 text-red-700 hover:text-red-900"
              aria-label="Cerrar mensaje de error"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSimulate} className="space-y-5 bg-white p-6 rounded-lg shadow-sm">
        <div className="form-group">
          <label className="block font-medium text-gray-700 mb-2">
            Consumo histórico ({historico.length} {historico.length === 1 ? 'mes' : 'meses'}): 
            <span className="text-red-500">*</span>
          </label>
          
          <div className="flex justify-between mb-3">
            <p className="text-xs text-gray-500">Ingrese el consumo mensual, del más reciente al más antiguo.</p>
            <div className="flex space-x-2">
              <button 
                type="button"
                onClick={removeMonth}
                disabled={historico.length <= 1}
                className={`px-2 py-1 rounded text-sm ${
                  historico.length <= 1 
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
                aria-label="Eliminar último mes"
              >
                - Quitar mes
              </button>
              <button 
                type="button"
                onClick={addMonth}
                disabled={historico.length >= 12}
                className={`px-2 py-1 rounded text-sm ${
                  historico.length >= 12 
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
                aria-label="Agregar nuevo mes"
              >
                + Agregar mes
              </button>
            </div>
          </div>
          
          <div className="historico-inputs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {historico.map((val, idx) => (
              <div key={idx} className="relative">
                <input
                  type="number"
                  value={val}
                  onChange={(e) => handleHistoricoChange(idx, e.target.value)}
                  min="0"
                  placeholder={`Mes ${idx + 1}`}
                  aria-label={`Consumo mes ${idx + 1}`}
                  className={`border rounded-md p-2 w-full focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white transition-colors ${
                    formErrors.historico ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-xs">u</span>
                </div>
              </div>
            ))}
          </div>
          {renderFieldError('historico')}
        </div>
        
        <FormField 
          id="aumento" 
          label="Porcentaje de aumento/disminución" 
          error={formErrors.aumento}
          required={true}
          hint="Use valores positivos para simular aumento en la demanda, negativos para disminución."
        >
          <div className="relative">
            <input 
              id="aumento"
              type="number" 
              value={aumento} 
              onChange={(e) => setAumento(e.target.value)} 
              placeholder="Ej: 10 para aumento del 10%, -5 para disminución del 5%" 
              aria-invalid={!!formErrors.aumento}
              className={`border rounded-md p-2 w-full focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white transition-colors ${
                formErrors.aumento ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-xs">%</span>
            </div>
          </div>
        </FormField>
        
        <FormField
          id="stockActual"
          label="Stock Actual"
          error={formErrors.stockActual}
          required={true}
        >
          <div className="relative">
            <input 
              id="stockActual"
              type="number" 
              value={stockActual} 
              onChange={(e) => setStockActual(e.target.value)} 
              min="0"
              placeholder="Unidades actualmente en bodega" 
              aria-invalid={!!formErrors.stockActual}
              className={`border rounded-md p-2 w-full focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white transition-colors ${
                formErrors.stockActual ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-xs">unidades</span>
            </div>
          </div>
        </FormField>
        
        <FormField
          id="unidadesPorCaja"
          label="Unidades por caja"
          error={formErrors.unidadesPorCaja}
          required={true}
          hint="Cantidad de unidades que vienen en cada caja del proveedor"
        >
          <input
            id="unidadesPorCaja"
            type="number"
            value={unidadesPorCaja}
            onChange={(e) => setUnidadesPorCaja(e.target.value)}
            min="1"
            placeholder="Cantidad de unidades en cada caja"
            aria-invalid={!!formErrors.unidadesPorCaja}
            className={`border rounded-md p-2 w-full focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white transition-colors ${
              formErrors.unidadesPorCaja ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        </FormField>
        
        <div className="flex space-x-3 mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className={`flex-grow py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            } transition-colors duration-200`}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Simulando...
              </span>
            ) : 'Simular Escenario'}
          </button>
          
          <button
            type="button"
            onClick={resetForm}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            aria-label="Reiniciar formulario"
          >
            Reiniciar
          </button>
        </div>
      </form>
      
      {memoizedResult}
    </div>
  );
});

Simulator.propTypes = {};
Simulator.displayName = 'Simulator';

export default Simulator;
