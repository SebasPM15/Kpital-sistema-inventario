import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { calcularInventario } from '../services/api';
import StockProjection from './StockProjection';

/**
 * @module InventoryForm
 * @description Módulo para cálculo y visualización de inventario óptimo
 */

/**
 * Componente para mensajes de información
 */
const InfoMessage = memo(function InfoMessage({ 
  type = 'info',
  title, 
  message, 
  onClose = null,
  className = ''
}) {
  const bgColors = {
    success: 'bg-green-50 border-l-4 border-green-600',
    error: 'bg-red-50 border-l-4 border-red-600',
    warning: 'bg-yellow-50 border-l-4 border-yellow-600',
    info: 'bg-blue-50 border-l-4 border-blue-600'
  };
  
  const textColors = {
    success: 'text-green-700',
    error: 'text-red-700',
    warning: 'text-yellow-700',
    info: 'text-blue-700'
  };
  
  return (
    <div className={`${bgColors[type]} p-4 rounded-r-lg ${className}`} role={type === 'error' ? 'alert' : 'status'}>
      <div className="flex items-center">
        <div className="flex-grow">
          {title && <h4 className={`font-semibold ${textColors[type]}`}>{title}</h4>}
          <p className={textColors[type]}>{message}</p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className={`ml-3 ${textColors[type]} hover:opacity-75`}
            aria-label="Cerrar mensaje"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
});

InfoMessage.propTypes = {
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func,
  className: PropTypes.string
};

/**
 * Componente de campo de formulario reutilizable
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
 * Hook personalizado para manejar la validación de formularios
 * @param {Object} initialValues - Valores iniciales del formulario
 * @returns {Object} - Objeto con valores, errores y funciones de manejo
 */
const useInventoryFormValidation = (initialValues = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Intentar obtener datos guardados del localStorage
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('inventory-form-data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setValues(prevValues => ({
          ...prevValues,
          ...(parsedData || {})
        }));
      }
    } catch (error) {
      console.error('Error loading saved form data:', error);
    }
  }, []);

  // Marcar formulario como modificado cuando cambian los valores
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      setIsFormDirty(true);
    }
  }, [values, touched]);

  // Guardado automático de los datos del formulario
  useEffect(() => {
    if (isFormDirty && Object.keys(values).length > 0) {
      try {
        localStorage.setItem('inventory-form-data', JSON.stringify(values));
      } catch (error) {
        console.error('Error saving form data:', error);
      }
    }
  }, [values, isFormDirty]);

  // Validación de campos
  const validateField = useCallback((name, value) => {
    let error = null;

    switch (name) {
      case 'historico':
        if (!value || !Array.isArray(value)) {
          error = 'El histórico es requerido';
        } else if (value.length === 0) {
          error = 'Debe ingresar al menos un mes de histórico';
        } else if (value.length > 12) {
          error = 'El histórico no puede tener más de 12 meses';
        } else if (value.some(v => v < 0)) {
          error = 'Los valores no pueden ser negativos';
        } else if (value.every(v => v === 0)) {
          error = 'Debe ingresar al menos un valor mayor a cero';
        }
        break;

      case 'stockActual':
        if (value === '' || value === null) {
          error = 'El stock actual es requerido';
        } else if (isNaN(Number(value)) || Number(value) < 0) {
          error = 'Debe ser un número positivo';
        }
        break;

      case 'unidadesPorCaja':
        if (value === '' || value === null) {
          error = 'Las unidades por caja son requeridas';
        } else if (isNaN(Number(value)) || Number(value) <= 0) {
          error = 'Debe ser un número mayor a cero';
        } else if (!Number.isInteger(Number(value))) {
          error = 'Debe ser un número entero';
        }
        break;

      default:
        break;
    }

    return error;
  }, []);

  // Validar todos los campos
  const validateForm = useCallback(() => {
    const newErrors = {};
    
    Object.keys(values).forEach(name => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, validateField]);

  // Actualizar un campo específico
  const handleChange = useCallback((name, value) => {
    setValues(prevValues => ({
      ...prevValues,
      [name]: value
    }));
    
    setTouched(prevTouched => ({
      ...prevTouched,
      [name]: true
    }));
    
    if (touched[name] || isSubmitting) {
      const error = validateField(name, value);
      setErrors(prevErrors => ({
        ...prevErrors,
        [name]: error
      }));
    }
  }, [touched, isSubmitting, validateField]);

  // Marcar campo como tocado al perder foco
  const handleBlur = useCallback((name) => {
    setTouched(prevTouched => ({
      ...prevTouched,
      [name]: true
    }));
    
    const error = validateField(name, values[name]);
    setErrors(prevErrors => ({
      ...prevErrors,
      [name]: error
    }));
  }, [values, validateField]);

  // Reiniciar formulario
  const resetForm = useCallback((newValues = {}) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setIsFormDirty(false);
  }, []);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isFormDirty,
    setIsSubmitting,
    handleChange,
    handleBlur,
    validateForm,
    resetForm
  };
};

/**
 * @component InventoryForm
 * @description Formulario para calcular parámetros óptimos de inventario
 * @returns {JSX.Element} Componente de formulario de inventario
 */
const InventoryForm = memo(function InventoryForm() {
  // Referencia para hacer scroll a resultados
  const resultadoRef = useRef(null);

  // Estado del formulario con custom hook de validación
  const {
    values,
    errors,
    touched,
    isSubmitting,
    setIsSubmitting,
    handleChange,
    handleBlur,
    validateForm,
    resetForm
  } = useInventoryFormValidation({
    historico: [10, 15, 12, 18, 14], // Valores iniciales más significativos
    stockActual: '100',
    unidadesPorCaja: '24'
  });

  // Estados adicionales
  const [resultado, setResultado] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Scrollear a los resultados cuando estén disponibles
  useEffect(() => {
    if (resultado && resultadoRef.current) {
      resultadoRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [resultado]);

  // Helper para verificar si un campo tiene error
  const hasError = useCallback((fieldName) => {
    return touched[fieldName] && errors[fieldName];
  }, [touched, errors]);

  // Manejo del envío del formulario
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    
    const isValid = validateForm();
    
    if (!isValid) {
      setIsSubmitting(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const data = {
        historico: values.historico.map(Number),
        stock_actual: parseFloat(values.stockActual),
        unidades_por_caja: parseInt(values.unidadesPorCaja, 10),
      };

      const res = await calcularInventario(data);
      setResultado(res);
      setSuccessMessage('Cálculo completado exitosamente');
      
      // Temporizador para hacer desaparecer el mensaje de éxito
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Error en cálculo de inventario:', err);
      setError(err.error || err.message || 'Algo salió mal. Por favor, intente nuevamente.');
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  }, [values, validateForm, setIsSubmitting]);

  // Manejar cambio en histórico
  const handleHistoricoChange = useCallback((idx, value) => {
    const newHistorico = [...values.historico];
    newHistorico[idx] = parseFloat(value) || 0;
    handleChange('historico', newHistorico);
  }, [values.historico, handleChange]);

  // Agregar un mes al histórico
  const addMonth = useCallback(() => {
    if (values.historico.length < 12) {
      handleChange('historico', [...values.historico, 0]);
    }
  }, [values.historico, handleChange]);

  // Eliminar el último mes del histórico
  const removeMonth = useCallback(() => {
    if (values.historico.length > 1) {
      handleChange('historico', values.historico.slice(0, -1));
    }
  }, [values.historico, handleChange]);

  // Función para reiniciar el formulario
  const handleReset = useCallback(() => {
    resetForm({
      historico: [0, 0, 0, 0, 0],
      stockActual: '',
      unidadesPorCaja: ''
    });
    setResultado(null);
    setError(null);
    setSuccessMessage(null);
  }, [resetForm]);

  // Renderizar mensaje de error para un campo
  const renderFieldError = useCallback((fieldName) => {
    return hasError(fieldName) ? (
      <p className="mt-1 text-sm text-red-600" role="alert">{errors[fieldName]}</p>
    ) : null;
  }, [hasError, errors]);

  // Memoizar el renderizado de resultados para evitar recálculos
  const memoizedResultado = useMemo(() => {
    if (!resultado) return null;
    
    // Función para determinar la clase CSS según el nivel de alerta
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
        aria-live="polite"
      >
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-xl font-semibold text-gray-800">Resultados del Cálculo</h3>
          <button
            onClick={() => window.print()}
            className="p-1 bg-gray-100 rounded hover:bg-gray-200 text-gray-700"
            aria-label="Imprimir resultados"
            title="Imprimir resultados"
          >
            <span className="text-md">🖨️</span>
          </button>
        </div>

        <div className="resultado-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Consumo diario calculado proveniente del backend */}
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
                ({Math.ceil(resultado.cantidad_pedir / parseInt(values.unidadesPorCaja))}) cajas
              </p>
              <p className="font-medium mt-1">
                <strong>Fecha sugerida para ordenar:</strong> {resultado.fecha_sugerida}
              </p>
            </div>
          )}
        </div>

        {resultado.prediccion && resultado.prediccion.length > 0 && (
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-4 border-b pb-2">Proyección de Stock</h4>
            <StockProjection 
              data={resultado.prediccion} 
              punto_reorden={resultado.punto_reorden} 
              stock_minimo={resultado.stock_minimo} 
            />
          </div>
        )}
      </div>
    );
  }, [resultado, values.unidadesPorCaja, resultadoRef, values.stockActual]);

  return (
    <div className="inventory-form-container">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Calcular Inventario</h2>

      {error && (
        <InfoMessage 
          type="error" 
          message={error} 
          onClose={() => setError(null)} 
          className="mb-6" 
        />
      )}

      {successMessage && (
        <InfoMessage 
          type="success" 
          message={successMessage} 
          className="mb-6 animate-fadeIn" 
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-lg shadow-sm">
        <div className="form-group">
          <fieldset>
            <legend className="block font-medium text-gray-700 mb-2">
              Consumo histórico ({values.historico.length} {values.historico.length === 1 ? 'mes' : 'meses'}): 
              <span className="text-red-500">*</span>
            </legend>
            
            <div className="flex justify-between mb-3">
              <p className="text-xs text-gray-500">Ingrese el consumo mensual, del más reciente al más antiguo.</p>
              <div className="flex space-x-2">
                <button 
                  type="button"
                  onClick={removeMonth}
                  disabled={values.historico.length <= 1}
                  className={`px-2 py-1 rounded text-sm ${
                    values.historico.length <= 1 
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
                  disabled={values.historico.length >= 12}
                  className={`px-2 py-1 rounded text-sm ${
                    values.historico.length >= 12 
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
              {values.historico.map((val, idx) => (
                <div key={idx} className="relative">
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => handleHistoricoChange(idx, e.target.value)}
                    onBlur={() => handleBlur('historico')}
                    min="0"
                    placeholder={`Mes ${idx + 1}`}
                    aria-label={`Consumo mes ${idx + 1}`}
                    aria-invalid={hasError('historico')}
                    className={`border rounded-md p-2 w-full focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white transition-colors ${
                      hasError('historico') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-xs">u</span>
                  </div>
                </div>
              ))}
            </div>
            {renderFieldError('historico')}
          </fieldset>
        </div>

        <FormField
          id="stockActual"
          label="Stock Actual"
          error={hasError('stockActual') ? errors.stockActual : null}
          required={true}
          hint="Cantidad actual de unidades disponibles en inventario"
        >
          <div className="relative">
            <input
              id="stockActual"
              type="number"
              value={values.stockActual}
              onChange={(e) => handleChange('stockActual', e.target.value)}
              onBlur={() => handleBlur('stockActual')}
              min="0"
              placeholder="Unidades actualmente en bodega"
              aria-invalid={hasError('stockActual')}
              className={`border rounded-md p-2 w-full focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white transition-colors ${
                hasError('stockActual') ? 'border-red-300' : 'border-gray-300'
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
          error={hasError('unidadesPorCaja') ? errors.unidadesPorCaja : null}
          required={true}
          hint="Cantidad de unidades que vienen en cada caja del proveedor"
        >
          <input
            id="unidadesPorCaja"
            type="number"
            value={values.unidadesPorCaja}
            onChange={(e) => handleChange('unidadesPorCaja', e.target.value)}
            onBlur={() => handleBlur('unidadesPorCaja')}
            min="1"
            placeholder="Cantidad de unidades en cada caja"
            aria-invalid={hasError('unidadesPorCaja')}
            className={`border rounded-md p-2 w-full focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white transition-colors ${
              hasError('unidadesPorCaja') ? 'border-red-300' : 'border-gray-300'
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
                Calculando...
              </span>
            ) : 'Calcular Inventario'}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            aria-label="Reiniciar formulario"
          >
            Reiniciar
          </button>
        </div>
      </form>

      {memoizedResultado}
      
      {/* Información adicional para el usuario */}
      {!resultado && (
        <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h3 className="font-medium text-blue-800 mb-2">¿Cómo funciona esta calculadora?</h3>
          <p className="text-sm text-blue-700 mb-2">
            Esta herramienta calcula los parámetros óptimos de inventario basándose en el consumo histórico y su stock actual.
          </p>
          <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1">
            <li>El <strong>Stock Mínimo</strong> es la cantidad que debe mantener como seguridad</li>
            <li>El <strong>Punto de Reorden</strong> indica cuándo debe realizar un nuevo pedido</li>
            <li>La <strong>Proyección</strong> muestra la evolución esperada de su inventario</li>
          </ul>
        </div>
      )}
    </div>
  );
});

InventoryForm.propTypes = {};
InventoryForm.displayName = 'InventoryForm';

export default InventoryForm;
