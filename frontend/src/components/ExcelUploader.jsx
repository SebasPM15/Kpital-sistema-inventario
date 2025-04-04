import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { read, utils } from 'xlsx';
import axios from 'axios';
import ColumnMapper from './ColumnMapper';
import { uploadExcelForPredictions } from '../services/api';

/**
 * @component ExcelUploader
 * @description Componente para cargar y procesar archivos Excel con confirmación
 * paso a paso de mapeo de columnas.
 */
const ExcelUploader = ({ onComplete }) => {
  const [excelData, setExcelData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados para el flujo paso a paso
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmedMappings, setConfirmedMappings] = useState({});
  const [detectedHistoricColumns, setDetectedHistoricColumns] = useState([]);
  const [showAdditionalSelector, setShowAdditionalSelector] = useState(false);
  const [additionalColumns, setAdditionalColumns] = useState([]);
  const [uploadingToBackend, setUploadingToBackend] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);

  // Lista de campos requeridos por nuestra aplicación (memoizada)
  const requiredFields = useMemo(() => [
    { id: 'codigo', name: 'Código del producto' },
    { id: 'nombre', name: 'Nombre del producto' },
    { id: 'stock_actual', name: 'Stock actual' },
    { id: 'unidades_por_caja', name: 'Unidades por caja' },
    { id: 'historico', name: 'Columnas de consumo histórico', multiple: true }
  ], []);

  // Mapeo automático basado en nombres comunes (memoizado)
  const autoMapColumns = useCallback((headers) => {
    const exactMatches = {
      stock_actual: ["STOCK  TOTAL"]
    };
    
    const commonMappings = {
      codigo: ['codigo', 'code', 'sku', 'id producto', 'id_producto'],
      nombre: ['nombre', 'descripcion', 'producto', 'name', 'description'],
      stock_actual: ['stock  total', 'stock total', 'stock', 'inventario', 'inventory'],
      unidades_por_caja: ['unidades_por_caja', 'unidades por caja', 'unid/caja', 'unidades caja']
    };
    
    const mappings = {};
    
    headers.forEach(header => {
      Object.keys(exactMatches).forEach(fieldKey => {
        if (exactMatches[fieldKey].includes(header)) {
          mappings[fieldKey] = header;
        }
      });
    });
    
    headers.forEach(header => {
      const headerLower = header.toLowerCase();
      
      Object.keys(commonMappings).forEach(fieldKey => {
        if (!mappings[fieldKey]) {
          if (commonMappings[fieldKey].some(pattern => {
            if (headerLower === pattern) return true;
            return headerLower.includes(pattern);
          })) {
            mappings[fieldKey] = header;
          }
        }
      });
    });
    
    const endIndex = Math.min(19, headers.length);
    const historicColumns = headers.slice(5, endIndex).filter(header => header?.trim());
    
    mappings.historico = historicColumns;
    setDetectedHistoricColumns(historicColumns);
    
    return mappings;
  }, []);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setCurrentStep(0);
    setConfirmedMappings({});
    setOriginalFile(file); // Save original file for later upload to backend

    const processExcel = async () => {
      try {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            
            const rawData = utils.sheet_to_json(sheet, { header: 1 });
            
            if (rawData.length < 3) {
              throw new Error('El archivo Excel no tiene suficientes filas. Necesita al menos 3 filas.');
            }
            
            const headerRow = rawData[2];
            
            if (!headerRow || headerRow.length === 0) {
              throw new Error('No se encontraron títulos de columnas en la tercera fila del Excel.');
            }
            
            const headers = headerRow.map(header => header?.toString() || '');
            
            const jsonData = rawData.slice(3)
              .filter(row => row && row.length > 0)
              .map(row => {
                const rowData = {};
                headers.forEach((header, index) => {
                  if (index < row.length) {
                    rowData[header] = row[index];
                  }
                });
                return rowData;
              });
            
            setExcelData(jsonData);
            setHeaders(headers);
            
            const initialMappings = autoMapColumns(headers);
            setMappings(initialMappings);
            
            setCurrentStep(1);
            
            setLoading(false);
          } catch (err) {
            setError(`Error al procesar el archivo: ${err.message}`);
            setLoading(false);
          }
        };
        
        reader.onerror = () => {
          setError('Error al leer el archivo.');
          setLoading(false);
        };
        
        reader.readAsArrayBuffer(file);
      } catch (err) {
        setError(`Error procesando el archivo: ${err.message}`);
        setLoading(false);
      }
    };

    processExcel();
  }, [autoMapColumns]);

  const handleFieldConfirm = (fieldId, selectedColumn) => {
    setConfirmedMappings(prev => ({
      ...prev,
      [fieldId]: selectedColumn
    }));
    setCurrentStep(prev => prev + 1);
  };

  const handleAddHistoricColumns = (selected) => {
    if (!selected || selected.length === 0) {
      setShowAdditionalSelector(false);
      return;
    }
    
    const newColumns = selected.filter(col => !detectedHistoricColumns.includes(col));
    
    if (newColumns.length === 0) {
      setShowAdditionalSelector(false);
      return;
    }
    
    const updatedHistoricColumns = [...detectedHistoricColumns, ...newColumns];
    setDetectedHistoricColumns(updatedHistoricColumns);
    setAdditionalColumns([...additionalColumns, ...newColumns]);
    setShowAdditionalSelector(false);
  };

  const handleCompleteMapping = async () => {
    const finalMappings = {
      ...confirmedMappings,
      historico: detectedHistoricColumns
    };
    
    try {
      setUploadingToBackend(true);
      
      // First prepare mapped data for our onComplete handler
      onComplete({
        data: excelData,
        mappings: finalMappings
      });
      
      // Then upload the original file to the colleague's backend
      if (originalFile) {
        console.log('Subiendo archivo Excel al backend...', originalFile.name, originalFile.size);
        
        try {
          // Crear un FormData para el envío del archivo
          const formData = new FormData();
          formData.append('excel', originalFile);
          
          // Registrar los headers para debugging
          console.log('FormData creado para subir Excel');
          
          // Upload directly with axios to ensure correct request format
          const response = await axios.post(`http://localhost:3000/api/predictions/refresh`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          
          console.log('Respuesta del servidor al subir Excel:', response.data);
          console.log('Excel subido correctamente al backend');
        } catch (uploadErr) {
          console.error('Error subiendo Excel al backend:', uploadErr);
          
          if (uploadErr.response) {
            console.error('Detalles del error:', uploadErr.response.data);
            setError(`Error al subir el archivo: ${uploadErr.response.data.error || uploadErr.response.statusText}`);
          } else if (uploadErr.request) {
            console.error('No se recibió respuesta del servidor');
            setError('Error de conexión: No se pudo contactar al servidor de predicciones');
          } else {
            setError(`Error al subir el archivo: ${uploadErr.message}`);
          }
        }
      }
    } catch (err) {
      console.error('Error completando el mapeo:', err);
      setError(`Error al procesar el archivo: ${err.message}`);
    } finally {
      setUploadingToBackend(false);
    }
  };

  const renderCurrentStep = () => {
    const basicFields = requiredFields.filter(field => !field.multiple);
    
    if (currentStep > 0 && currentStep <= basicFields.length) {
      const currentField = basicFields[currentStep - 1];
      const suggestedColumn = mappings?.[currentField.id] || '';
      
      return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-4 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-blue-600 font-bold">
              {currentStep}
            </div>
            <h4 className="text-lg font-semibold">
              Confirmar {currentField.name}
            </h4>
          </div>
          
          <div className="w-full bg-gray-200 h-2 rounded-full mb-4">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / (basicFields.length + 1)) * 100}%` }}
            ></div>
          </div>
          
          <p className="mb-4 text-sm text-gray-600 pl-3 border-l-2 border-blue-400 bg-blue-50 py-2">
            Seleccione la columna del Excel que corresponde a {currentField.name.toLowerCase()}
          </p>
          
          <div className="mb-4">
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Columna sugerida: {suggestedColumn ? (
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-bold">
                    {suggestedColumn}
                  </span>
                ) : (
                  <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    No detectada
                  </span>
                )}
              </label>
            </div>
            
            <select
              className="w-full p-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-blue-300 bg-gray-50"
              value={confirmedMappings[currentField.id] || suggestedColumn}
              onChange={e => handleFieldConfirm(currentField.id, e.target.value)}
            >
              <option value="">-- Seleccionar columna --</option>
              {headers.map((header, idx) => (
                <option key={idx} value={header}>{header}</option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-between">
            <button
              type="button"
              className="text-gray-600 hover:text-gray-800 px-4 py-2 rounded-md hover:bg-gray-100 transition-all duration-200 flex items-center"
              onClick={() => currentStep > 1 ? setCurrentStep(prev => prev - 1) : null}
              disabled={currentStep === 1}
            >
              {currentStep > 1 ? (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Anterior
                </>
              ) : ''}
            </button>
            
            <button
              type="button"
              className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-lg shadow-sm hover:shadow transition-all duration-200 transform hover:-translate-y-1 flex items-center"
              onClick={() => handleFieldConfirm(
                currentField.id, 
                confirmedMappings[currentField.id] || suggestedColumn
              )}
            >
              Siguiente
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      );
    }
    
    if (currentStep === basicFields.length + 1) {
      return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-4 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-blue-600 font-bold">
              {currentStep}
            </div>
            <h4 className="text-lg font-semibold">Columnas Históricas</h4>
          </div>
          
          <div className="w-full bg-gray-200 h-2 rounded-full mb-4">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / (basicFields.length + 1)) * 100}%` }}
            ></div>
          </div>
          
          <p className="mb-4 text-sm text-gray-600 pl-3 border-l-2 border-blue-400 bg-blue-50 py-2">
            Se han detectado automáticamente las siguientes columnas históricas (F3-S3):
          </p>
          
          {detectedHistoricColumns.length > 0 ? (
            <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="text-green-800 font-medium mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {detectedHistoricColumns.length} columnas históricas detectadas
              </div>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {detectedHistoricColumns.map((col, idx) => (
                  <li key={idx} className="text-sm bg-white p-2 rounded border border-green-200 transition-all hover:shadow-sm hover:border-green-300">
                    {col}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-yellow-700">
                  No se detectaron columnas históricas en el rango F3-S3.
                  <br/>
                  <span className="mt-1 block text-xs">Es necesario agregar al menos una columna histórica para continuar.</span>
                </p>
              </div>
            </div>
          )}
          
          {!showAdditionalSelector ? (
            <div className="flex justify-between mt-6">
              <button
                type="button"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all duration-200 flex items-center"
                onClick={() => setCurrentStep(prev => prev - 1)}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border border-blue-300 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 flex items-center shadow-sm hover:shadow"
                  onClick={() => setShowAdditionalSelector(true)}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Agregar más columnas
                </button>
                
                <button
                  type="button"
                  className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-1 flex items-center"
                  onClick={handleCompleteMapping}
                  disabled={detectedHistoricColumns.length === 0 || uploadingToBackend}
                >
                  {uploadingToBackend ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Procesando...
                    </>
                  ) : (
                    <>
                      Completar
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h5 className="text-sm font-medium mb-3 flex items-center">
                <svg className="w-4 h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Seleccionar columnas adicionales:
              </h5>
              
              <select
                className="w-full p-3 border rounded-lg mb-3 focus:ring-blue-500 focus:border-blue-500"
                multiple
                size={Math.min(6, headers.filter(h => !detectedHistoricColumns.includes(h)).length)}
              >
                {headers
                  .filter(header => !detectedHistoricColumns.includes(header) && header?.trim())
                  .map((header, idx) => (
                    <option key={idx} value={header}>{header}</option>
                  ))}
              </select>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-200"
                  onClick={() => setShowAdditionalSelector(false)}
                >
                  Cancelar
                </button>
                
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-sm hover:shadow flex items-center"
                  onClick={() => {
                    const selectElement = document.querySelector('.mb-4 select[multiple]');
                    if (selectElement) {
                      const selected = Array.from(selectElement.selectedOptions || [], option => option.value);
                      handleAddHistoricColumns(selected);
                    }
                  }}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Agregar seleccionadas
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="excel-uploader bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300" role="region" aria-labelledby="excel-uploader-title">
      <h3 id="excel-uploader-title" className="text-lg font-semibold mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Importar Datos desde Excel
      </h3>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-start" role="alert">
          <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      
      {currentStep === 0 && (
        <div className="mb-6 scale">
          <label htmlFor="excel-file-input" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Seleccione el archivo Excel:
          </label>
          
          <div className="relative">
            <input
              id="excel-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 
                        file:mr-4 file:py-2.5 file:px-4 
                        file:rounded-lg file:border-0 
                        file:text-sm file:font-medium 
                        file:bg-blue-50 file:text-blue-700 
                        hover:file:bg-blue-100 
                        hover:file:shadow-sm
                        hover:file:translate-y-[-2px]
                        file:transition-all
                        focus:outline-none
                        border-2 border-dashed border-gray-300
                        rounded-lg
                        p-6
                        transition-all
                        hover:border-blue-300
                        hover:bg-blue-50/30"
              aria-describedby="file-description"
              disabled={loading}
            />
            
            <div className="flex justify-center absolute inset-0 items-center pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
              <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p id="file-description" className="text-sm text-blue-700 flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                El archivo debe tener los títulos de las columnas en la <strong>tercera fila (fila 3)</strong>.
                Los datos se leerán a partir de la cuarta fila.
              </span>
            </p>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="flex flex-col items-center justify-center my-6 py-8" role="status" aria-label="Cargando archivo">
          <div className="loader-container">
            <svg className="circular-loader" viewBox="25 25 50 50" width="60" height="60">
              <circle className="loader-path" cx="50" cy="50" r="20" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-4 text-gray-600 font-medium animate-pulse">Procesando archivo Excel...</p>
          
          <style jsx>{`
            .circular-loader {
              animation: rotate 2s linear infinite;
            }
            
            .loader-path {
              stroke-dasharray: 1, 150;
              stroke-dashoffset: 0;
              animation: dash 1.5s ease-in-out infinite;
            }
            
            @keyframes rotate {
              100% { transform: rotate(360deg); }
            }
            
            @keyframes dash {
              0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
              50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
              100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
            }
          `}</style>
        </div>
      )}
      
      {!loading && renderCurrentStep()}
    </div>
  );
};

ExcelUploader.propTypes = {
  onComplete: PropTypes.func.isRequired
};

export default ExcelUploader;
