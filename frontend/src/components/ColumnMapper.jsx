import React, { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';

/**
 * @component ColumnMapper
 * @description Componente para mapear columnas de Excel a campos requeridos siguiendo
 * principios de diseño modular y accesibilidad.
 */
const ColumnMapper = memo(function ColumnMapper({ headers, requiredFields, initialMappings, onComplete }) {
  const [mappings, setMappings] = useState(initialMappings || {});
  const [step, setStep] = useState(0);
  
  // Verificar si todos los campos requeridos tienen un mapeo
  const isMappingComplete = useCallback(() => {
    return requiredFields.every(field => {
      if (field.multiple) {
        return mappings[field.id]?.length > 0;
      }
      return mappings[field.id];
    });
  }, [mappings, requiredFields]);
  
  // Campos a mostrar en el paso actual (uno a la vez para simplificar)
  const currentField = requiredFields[step];
  
  // Manejar la selección de columnas (optimizado con useCallback)
  const handleSelect = useCallback((fieldId, value) => {
    setMappings(prevMappings => {
      const newMappings = { ...prevMappings };
      
      if (requiredFields.find(f => f.id === fieldId)?.multiple) {
        // Para campos que aceptan múltiples columnas (como histórico)
        newMappings[fieldId] = newMappings[fieldId] || [];
        
        // Verificar si ya está seleccionado
        const index = newMappings[fieldId].indexOf(value);
        if (index >= 0) {
          // Quitar de la selección (inmutable)
          return {
            ...newMappings,
            [fieldId]: [...newMappings[fieldId].slice(0, index), ...newMappings[fieldId].slice(index + 1)]
          };
        } else {
          // Agregar a la selección (inmutable)
          return {
            ...newMappings,
            [fieldId]: [...(newMappings[fieldId] || []), value]
          };
        }
      } else {
        // Para campos que solo aceptan una columna
        return {
          ...newMappings,
          [fieldId]: value
        };
      }
    });
  }, [requiredFields]);
  
  // Avanzar al siguiente paso
  const nextStep = useCallback(() => {
    if (step < requiredFields.length - 1) {
      setStep(prevStep => prevStep + 1);
    } else if (isMappingComplete()) {
      onComplete(mappings);
    }
  }, [step, requiredFields.length, isMappingComplete, mappings, onComplete]);
  
  // Retroceder al paso anterior
  const prevStep = useCallback(() => {
    if (step > 0) {
      setStep(prevStep => prevStep - 1);
    }
  }, [step]);
  
  // Renderizado condicional para optimización
  const renderFieldSelector = useCallback(() => {
    if (currentField.multiple) {
      return (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4" role="group" aria-labelledby="multiple-selection-label">
          <span id="multiple-selection-label" className="sr-only">Selección múltiple de columnas</span>
          {headers.map(header => (
            <div key={header} className="flex items-center">
              <input
                type="checkbox"
                id={`header-${header}`}
                checked={(mappings[currentField.id] || []).includes(header)}
                onChange={() => handleSelect(currentField.id, header)}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-checked={(mappings[currentField.id] || []).includes(header)}
              />
              <label htmlFor={`header-${header}`} className="text-sm text-gray-700 truncate">
                {header}
              </label>
            </div>
          ))}
        </div>
      );
    }
    
    return (
      <select
        value={mappings[currentField.id] || ''}
        onChange={(e) => handleSelect(currentField.id, e.target.value)}
        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        aria-label={`Seleccionar columna para ${currentField.name}`}
      >
        <option value="">Seleccione una columna</option>
        {headers.map(header => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
    );
  }, [headers, currentField, mappings, handleSelect]);
  
  return (
    <div className="column-mapper" role="form" aria-labelledby="mapper-heading">
      <h4 id="mapper-heading" className="text-md font-medium mb-3">Mapeando {currentField.name}</h4>
      <p className="text-sm text-gray-600 mb-4">
        Seleccione la columna del Excel que corresponde a este campo.
        {currentField.multiple && " Puede seleccionar múltiples columnas."}
      </p>
      
      <div className="mb-4">
        {renderFieldSelector()}
      </div>
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={prevStep}
          disabled={step === 0}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-disabled={step === 0}
        >
          Anterior
        </button>
        
        <button
          type="button"
          onClick={nextStep}
          disabled={currentField.multiple ? !(mappings[currentField.id]?.length > 0) : !mappings[currentField.id]}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-disabled={currentField.multiple ? !(mappings[currentField.id]?.length > 0) : !mappings[currentField.id]}
        >
          {step < requiredFields.length - 1 ? 'Siguiente' : 'Finalizar'}
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-500" aria-live="polite">
        Paso {step + 1} de {requiredFields.length}
      </div>
    </div>
  );
});

ColumnMapper.propTypes = {
  headers: PropTypes.array.isRequired,
  requiredFields: PropTypes.array.isRequired,
  initialMappings: PropTypes.object,
  onComplete: PropTypes.func.isRequired
};

export default ColumnMapper;
