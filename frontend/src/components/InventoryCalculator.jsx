import React, { useState, useCallback, useMemo, Suspense, lazy, useEffect } from 'react';
import ExcelUploader from './ExcelUploader';
import ProductSearch from './ProductSearch';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import { getAllPredictions, getPredictionByCode } from '../services/api';

const StockProjection = lazy(() => import('./StockProjection'));

function InventoryCalculator() {
  const [isExcelLoaded, setIsExcelLoaded] = useState(false);
  const [excelData, setExcelData] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [calculationResult, setCalculationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showProductTable, setShowProductTable] = useState(false);
  const itemsPerPage = 10;
  const [hoveredRow, setHoveredRow] = useState(null);
  const [backendProducts, setBackendProducts] = useState([]);
  const [loadingBackendProducts, setLoadingBackendProducts] = useState(false);

  useEffect(() => {
    if (isExcelLoaded) {
      loadBackendProducts();
    }
  }, [isExcelLoaded]);

  const loadBackendProducts = async () => {
    try {
      setLoadingBackendProducts(true);
      const products = await getAllPredictions();

      if (products && Array.isArray(products)) {
        setBackendProducts(products);
        console.log('Productos cargados del backend:', products.length);
      } else {
        console.warn('Formato de respuesta inesperado:', products);
        setError('La respuesta del servidor no tiene el formato esperado');
      }
    } catch (err) {
      console.error('Error cargando productos del backend:', err);
      setError(`Error al cargar productos: ${err.message || 'Error de conexión'}`);
    } finally {
      setLoadingBackendProducts(false);
    }
  };

  const calculateInventory = useCallback(async (productData) => {
    setLoading(true);
    setError(null);
    setShowProductTable(false);

    try {
      const code = productData[columnMappings.codigo];
      console.log('Solicitando predicción para código:', code);

      let backendProduct;
      try {
        backendProduct = await getPredictionByCode(code);
        console.log('Datos recibidos del backend:', backendProduct);
      } catch (fetchError) {
        console.error('Error al obtener datos del backend:', fetchError);
        setError(`Error al conectar con el servidor de predicciones: ${fetchError.message}`);
        setLoading(false);
        return;
      }

      if (!backendProduct) {
        throw new Error('No se encontró información para este producto en el backend');
      }

      const getCampo = (posiblesNombres, valorPorDefecto) => {
        for (const nombre of posiblesNombres) {
          if (backendProduct[nombre] !== undefined) {
            const valor = backendProduct[nombre];
            if (typeof valor === 'number') return valor;
            if (typeof valor === 'string' && !isNaN(parseFloat(valor.replace(/,/g, '')))) {
              return parseFloat(valor.replace(/,/g, ''));
            }
            return valor;
          }
        }
        console.warn(`Ninguno de estos campos encontrados: ${posiblesNombres.join(', ')}. Usando valor por defecto: ${valorPorDefecto}`);
        return valorPorDefecto;
      };

      const hasPredictionData = backendProduct.PREDICCION && 
                               Array.isArray(backendProduct.PREDICCION) && 
                               backendProduct.PREDICCION.length > 0;
      
      const firstPrediction = hasPredictionData ? backendProduct.PREDICCION[0] : null;
      
      const adaptedData = {
        codigo: getCampo(['CODIGO', 'codigo', 'Code'], productData[columnMappings.codigo]),
        nombre: getCampo(['DESCRIPCION', 'descripcion', 'Description'], productData[columnMappings.nombre]),
        stock_actual: getCampo(['STOCK_ACTUAL', 'STOCK  TOTAL', 'STOCK TOTAL', 'stock_actual', 'StockActual'], 
                            productData[columnMappings.stock_actual]),
        unidades_por_caja: getCampo(['UNID_POR_CAJA', 'UNID/CAJA', 'unidades_por_caja', 'UnidadesPorCaja'], 
                                productData[columnMappings.unidades_por_caja]),
        consumo_promedio: getCampo(['CONSUMO_PROMEDIO', 'PROM CONSU', 'consumo_promedio', 'ConsumoPromedio'], 0),
        stock_seguridad: getCampo(['STOCK_SEGURIDAD', 'SS', 'stock_seguridad', 'StockSeguridad'], 0),
        punto_reorden: getCampo(['PUNTO_REORDEN', 'PUNTO DE REORDEN (44 días)', 'punto_reorden', 'PuntoReorden'], 0),
        stock_minimo: getCampo(['STOCK_MINIMO', 'SS', 'stock_minimo', 'StockMinimo'], 0),
        stock_proyectado: (() => {
          const directValue = getCampo(['STOCK_PROYECTADO', 'stock_proyectado', 'StockProyectado'], null);
          if (directValue !== null) return directValue;
          
          if (firstPrediction) {
            if (firstPrediction.stock_final !== undefined) return firstPrediction.stock_final;
            if (firstPrediction.stock_actual !== undefined) return firstPrediction.stock_actual;
          }
          
          const stockActual = getCampo(['STOCK_ACTUAL'], 0);
          const deficit = getCampo(['DEFICIT_ACTUAL'], 0);
          
          return Math.max(0, stockActual - (deficit || 0));
        })(),
        consumo_diario: getCampo(['CONSUMO_DIARIO', 'consumo_diario', 'ConsumoDiario'], 
                              parseFloat(getCampo(['CONSUMO_PROMEDIO', 'PROM CONSU'], 0)) / 30),
        consumo_diario_proyectado: getCampo(['PROYECCION_CONSUMO', 'consumo_diario_proyectado'], 
                                        parseFloat(getCampo(['CONSUMO_PROMEDIO', 'PROM CONSU'], 0)) / 30),
        cantidad_pedir: getCampo(['UNIDADES_A_PEDIR', 'CAJAS_A_PEDIR', 'CANT.PEDIR', 'cantidad_pedir'], 0),
        fecha_sugerida: (() => {
          const directValue = getCampo(['FECHA_SUGERIDA', 'fecha_sugerida', 'FECHA SUGERIDA'], null);
          if (directValue) return directValue;
        
          if (firstPrediction && firstPrediction.mes) {
            try {
              const parts = firstPrediction.mes.split('-');
              if (parts.length === 2) {
                const monthStr = parts[0];
                const year = parseInt(parts[1]);
                
                const monthMap = {
                  'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
                  'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
                };
                
                if (monthMap[monthStr.toUpperCase()] !== undefined) {
                  const fecha = new Date(year, monthMap[monthStr.toUpperCase()], 15);
                  return fecha.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                }
              }
            } catch (e) {
              console.warn('Error al procesar fecha de predicción:', e);
            }
          }
        
          const fecha = new Date();
          fecha.setDate(fecha.getDate() + 15);
          return fecha.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        })(),
        consumos_historicos: backendProduct.CONSUMOS_HISTORICOS || {}
      };

      const prediccion = backendProduct.PREDICCION;

      if (prediccion) {
        try {
          adaptedData.prediccion = {
            diario: adaptDailyPrediction(prediccion),
            semanal: adaptWeeklyPrediction(prediccion)
          };
          console.log("Prediction data prepared:", adaptedData.prediccion);
        } catch (predictionError) {
          console.error('Error adaptando predicciones:', predictionError);
          adaptedData.prediccion = {
            diario: generateSamplePrediction(adaptedData.stock_actual, adaptedData.consumo_diario),
            semanal: []
          };
        }
      } else {
        console.log("No prediction data found, using sample data");
        adaptedData.prediccion = {
          diario: generateSamplePrediction(adaptedData.stock_actual, adaptedData.consumo_diario),
          semanal: []
        };
      }

      if (adaptedData.stock_proyectado < 0) {
        adaptedData.alerta = {
          nivel: 'Crítico',
          accion: 'Realizar pedido urgente. El stock proyectado es negativo.'
        };
      } else if (adaptedData.stock_actual < adaptedData.punto_reorden) {
        adaptedData.alerta = {
          nivel: 'Moderada',
          accion: 'Considerar realizar un pedido pronto. El stock está por debajo del punto de reorden.'
        };
      } else {
        adaptedData.alerta = {
          nivel: 'Normal',
          accion: 'No se requiere acción inmediata. El stock es adecuado.'
        };
      }

      setCalculationResult(adaptedData);
    } catch (err) {
      console.error('Error calculando inventario:', err);

      if (err.response) {
        setError(`Error ${err.response.status}: ${err.response.data?.error || err.response.statusText}`);
      } else if (err.request) {
        setError('No se pudo conectar con el servidor. Verifique su conexión.');
      } else {
        setError(err.message || 'Error al calcular el inventario. Por favor intente de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }, [columnMappings]);

  // Generate sample prediction data when actual data is not available
  const generateSamplePrediction = (startStock, dailyConsumption) => {
    const prediction = [];
    const today = new Date();
    let currentStock = parseFloat(startStock) || 100;

    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const consumption = isWeekend ? 0 : (parseFloat(dailyConsumption) || 5);
      currentStock -= consumption;

      prediction.push({
        ds: date.toISOString().split('T')[0],
        yhat: consumption,
        stock_proyectado: Math.max(0, currentStock),
        es_fin_semana: isWeekend,
        es_festivo: false
      });
    }

    return prediction;
  };

  // Adapt daily prediction data from backend format to component format
  const adaptDailyPrediction = (predictions) => {
    if (!predictions) return [];

    if (!Array.isArray(predictions)) {
      if (typeof predictions === 'object') {
        try {
          const convertido = Object.values(predictions);
          if (Array.isArray(convertido) && convertido.length > 0) {
            predictions = convertido;
          } else {
            return [];
          }
        } catch (e) {
          return [];
        }
      } else {
        return [];
      }
    }

    if (predictions.length === 0) return [];

    try {
      const tieneFormatoDiario = predictions.some(p => 
        p && (p.ds || p.fecha || p.date) && 
        (p.yhat !== undefined || p.consumo !== undefined || p.valor !== undefined)
      );

      if (tieneFormatoDiario) {
        return predictions.map(p => ({
          ds: p.ds || p.fecha || p.date || new Date().toISOString().split('T')[0],
          yhat: parseFloat(p.yhat || p.consumo || p.valor || 0),
          stock_proyectado: parseFloat(p.stock_proyectado || p.stock || 0),
          es_fin_semana: p.es_fin_semana || p.weekend || false,
          es_festivo: p.es_festivo || p.holiday || false
        }));
      }

      return predictions.map((pred, index) => {
        const fechaBase = new Date();
        fechaBase.setMonth(fechaBase.getMonth() + index);
        fechaBase.setDate(15);

        const fecha = fechaBase.toISOString().split('T')[0];

        return {
          ds: fecha,
          yhat: pred.consumo_diario || (pred.consumo_mensual / 30) || 0,
          stock_proyectado: pred.stock_proyectado || pred.stock_final || pred.stock_actual || 0,
          es_fin_semana: false,
          es_festivo: false
        };
      });
    } catch (err) {
      console.error("Error adapting daily prediction data:", err);
      return generateSamplePrediction(100, 5);
    }
  };

  // Convert monthly predictions to weekly format
  const adaptWeeklyPrediction = (monthlyPredictions) => {
    if (!monthlyPredictions || !Array.isArray(monthlyPredictions)) return [];

    const weeklyPredictions = [];

    monthlyPredictions.forEach((monthData, monthIndex) => {
      if (!monthData) return;

      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() + monthIndex);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });
      const year = monthDate.getFullYear();

      const consumoSemanal = (monthData.consumo_total || monthData.consumo_mensual || 0) / 4;

      for (let week = 0; week < 4; week++) {
        let stockSemana = 0;

        if (monthIndex === 0 && week === 0) {
          stockSemana = monthData.stock_actual || 0;
        } else if (week === 0) {
          const lastWeekPrevMonth = weeklyPredictions[weeklyPredictions.length - 1];
          stockSemana = lastWeekPrevMonth.stock_proyectado - consumoSemanal;
        } else {
          const prevWeek = weeklyPredictions[weeklyPredictions.length - 1];
          stockSemana = prevWeek.stock_proyectado - consumoSemanal;
        }

        weeklyPredictions.push({
          semana: `Sem ${week + 1} ${monthName} ${year}`,
          consumo_total: consumoSemanal,
          stock_proyectado: Math.max(0, stockSemana)
        });
      }
    });

    return weeklyPredictions;
  };

  const handleExcelLoaded = useCallback(({ data, mappings }) => {
    setExcelData(data);
    setColumnMappings(mappings);
    setIsExcelLoaded(true);
    setSelectedProduct(null);
    setCalculationResult(null);
    setSearchTerm('');
    setCurrentPage(1);
    setShowProductTable(false);
  }, []);

  const handleProductSelect = useCallback((productData) => {
    setSelectedProduct(productData);
    calculateInventory(productData);
  }, [calculateInventory]);

  const filteredProducts = useMemo(() => {
    if (!excelData || !columnMappings?.codigo || !columnMappings?.nombre) return [];

    return excelData.filter(item => {
      const codigo = item[columnMappings.codigo]?.toString().toLowerCase() || '';
      const nombre = item[columnMappings.nombre]?.toString().toLowerCase() || '';
      const term = searchTerm.toLowerCase();

      return codigo.includes(term) || nombre.includes(term);
    });
  }, [excelData, columnMappings, searchTerm]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }, []);

  return (
    <div className="inventory-calculator-container animate-fadeIn p-6 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 tracking-tight flex items-center">
        <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Calculadora de Inventario
      </h2>
      
      {!isExcelLoaded && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg shadow-sm transition-all duration-300 hover:shadow" role="region" aria-label="Instrucciones importantes">
          <p className="text-sm text-blue-700 leading-relaxed">
            <strong className="font-semibold">Nota importante:</strong> El sistema espera que los títulos de las columnas estén en la 
            <strong className="font-semibold"> tercera fila</strong> del archivo Excel. Los datos serán leídos a partir de la cuarta fila.
            Puede seleccionar tantas columnas de consumo histórico como necesite para el cálculo.
          </p>
        </div>
      )}
      
      {!isExcelLoaded ? (
        <ExcelUploader onComplete={handleExcelLoaded} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-4 justify-between items-center">
            <button
              type="button"
              className="text-white bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2.5 rounded-xl transition-all duration-300 flex items-center group shadow-sm hover:shadow-md transform hover:-translate-y-1"
              onClick={() => setIsExcelLoaded(false)}
            >
              <svg className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Cargar otro Excel
            </button>
            
            <button
              type="button"
              className={`px-5 py-2.5 rounded-xl transition-all duration-300 flex items-center shadow-sm hover:shadow transform ${
                showProductTable
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:-translate-y-1'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:-translate-y-1'
              }`}
              onClick={() => setShowProductTable(!showProductTable)}
            >
              {showProductTable ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Ocultar tabla
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Ver todos los productos
                </>
              )}
            </button>
          </div>

          {showProductTable && (
            <div className="bg-white p-6 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md mb-6 scale backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-5 flex items-center text-gray-800">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Productos Cargados
              </h3>
              
              <div className="mb-5 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar por código o nombre"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full p-3.5 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-300 bg-gray-50 hover:bg-white"
                />
              </div>
              
              {filteredProducts.length > 0 ? (
                <>
                  <div className="overflow-x-auto rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200 border-collapse">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Código
                          </th>
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Stock
                          </th>
                          <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Unid/Caja
                          </th>
                          <th scope="col" className="px-6 py-3.5 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Acción
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedProducts.map((product, index) => (
                          <tr 
                            key={index} 
                            className={`transition-all duration-300 border-l-2 ${
                              hoveredRow === index 
                                ? 'bg-blue-50 border-l-blue-500 transform scale-[1.01] shadow-sm z-10'
                                : index % 2 === 0 ? 'bg-white border-l-transparent' : 'bg-gray-50/30 border-l-transparent'
                            }`}
                            onMouseEnter={() => setHoveredRow(index)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                              {product[columnMappings.codigo]}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {product[columnMappings.nombre]}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <span className="px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {product[columnMappings.stock_actual]}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {product[columnMappings.unidades_por_caja]}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                type="button"
                                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white transition-all duration-300 px-4 py-2 rounded-lg flex items-center ml-auto shadow-sm hover:shadow transform hover:-translate-y-0.5"
                                onClick={() => handleProductSelect(product)}
                              >
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Calcular
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="pagination-controls flex flex-wrap items-center justify-between mt-5 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        className="px-4 py-2 flex items-center bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg transition-all duration-300 hover:from-blue-700 hover:to-blue-600 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Anterior
                      </button>
                      
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = currentPage <= 3 
                            ? i + 1 
                            : currentPage + i - 2 > totalPages 
                              ? totalPages - 4 + i 
                              : currentPage + i - 2;
                              
                          if (pageNum <= totalPages && pageNum > 0) {
                            return (
                              <button 
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm hover:shadow ${
                                  currentPage === pageNum 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium transform scale-110' 
                                    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                          return null;
                        })}
                      </div>
                      
                      <button
                        type="button"
                        className="px-4 py-2 flex items-center bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg transition-all duration-300 hover:from-blue-700 hover:to-blue-600 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500 mb-4">No se encontraron productos que coincidan con la búsqueda.</p>
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm flex items-center mx-auto bg-white py-2 px-4 rounded-lg shadow-sm hover:shadow transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Limpiar búsqueda
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-1">
              <ProductSearch 
                data={excelData} 
                mappings={columnMappings}
                onSelectProduct={handleProductSelect}
              />
            </div>
            
            <div className="lg:col-span-2">
              {loading && <LoadingState message="Calculando inventario..." />}
              
              {error && !loading && (
                <ErrorState 
                  error={error} 
                  onRetry={() => selectedProduct && calculateInventory(selectedProduct)} 
                />
              )}
              
              {calculationResult && !loading && !error && (
                <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
                  <div className="mb-4 flex flex-wrap justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Resultados del Cálculo
                    </h3>
                    <div className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700 flex items-center">
                      <span className="font-medium mr-2">{calculationResult.codigo}</span>
                      <span className="text-gray-500">-</span>
                      <span className="ml-2 truncate max-w-[200px]">{calculationResult.nombre}</span>
                    </div>
                  </div>

                  {Object.keys(calculationResult.consumos_historicos || {}).length > 0 && (
                    <div className="mb-4 bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 mr-1.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Histórico de Consumos</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                        {Object.entries(calculationResult.consumos_historicos)
                          .sort(([mesA], [mesB]) => {
                            const mesesOrden = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 
                                           'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
                            const mesANombre = mesA.replace('CONS_', '').substring(0, 3);
                            const mesBNombre = mesB.replace('CONS_', '').substring(0, 3);
                            
                            const anioA = mesA.includes('-') ? parseInt(mesA.split('-')[1]) : 0;
                            const anioB = mesB.includes('-') ? parseInt(mesB.split('-')[1]) : 0;
                            
                            if (anioA !== anioB) return anioA - anioB;
                            return mesesOrden.indexOf(mesANombre) - mesesOrden.indexOf(mesBNombre);
                          })
                          .map(([mes, valor]) => (
                            <div key={mes} className="bg-white p-2 rounded border border-gray-200 text-center transform hover:scale-105 transition-all duration-200 hover:shadow-sm">
                              <div className="text-xs text-blue-600 font-medium">
                                {mes.replace('CONS_', '').replace(/_/g, ' ')}
                              </div>
                              <div className="text-gray-800 font-bold text-sm">
                                {typeof valor === 'number' ? valor.toLocaleString('es-ES') : valor}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/70 p-4 rounded-xl border border-blue-200 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-sm text-blue-700 font-medium flex items-center mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        Stock Actual
                      </div>
                      <div className="text-3xl font-bold text-blue-800">
                        {Math.round(calculationResult.stock_actual)}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-green-100/70 p-4 rounded-xl border border-green-200 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-sm text-green-700 font-medium flex items-center mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Consumo Promedio
                      </div>
                      <div className="text-3xl font-bold text-green-800">
                        {Math.round(calculationResult.consumo_promedio)}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/70 p-4 rounded-xl border border-yellow-200 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-sm text-yellow-700 font-medium flex items-center mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        </svg>
                        Stock de Seguridad
                      </div>
                      <div className="text-3xl font-bold text-yellow-800">
                        {Math.round(calculationResult.stock_seguridad)}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-red-50 to-red-100/70 p-4 rounded-xl border border-red-200 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-sm text-red-700 font-medium flex items-center mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Punto de Reorden
                      </div>
                      <div className="text-3xl font-bold text-red-800">
                        {Math.round(calculationResult.punto_reorden)}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/70 p-4 rounded-xl border border-purple-200 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-sm text-purple-700 font-medium flex items-center mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        Stock Mínimo
                      </div>
                      <div className="text-3xl font-bold text-purple-800">
                        {Math.round(calculationResult.stock_minimo)}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100/70 p-4 rounded-xl border border-pink-200 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-sm text-pink-700 font-medium flex items-center mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16h1m-7 0h7" />
                        </svg>
                        Consumo Diario
                      </div>
                      <div className="text-3xl font-bold text-pink-800">
                        {Math.round(calculationResult.consumo_diario)}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/70 p-4 rounded-xl border border-indigo-200 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-sm text-indigo-700 font-medium flex items-center mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0h-1v1h1m-7 0h7M5 21h7a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Cantidad a Pedir
                      </div>
                      <div className="text-3xl font-bold text-indigo-800">
                        {Math.round(calculationResult.cantidad_pedir)}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100/70 p-4 rounded-xl border border-teal-200 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-sm text-teal-700 font-medium flex items-center mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Fecha Sugerida
                      </div>
                      <div className="text-xl font-bold text-teal-800 break-words">
                        {calculationResult.fecha_sugerida || "Fecha no disponible"}
                      </div>
                    </div>
                  </div>
                  
                  {calculationResult.prediccion && (
                    <div className="rounded-xl overflow-hidden p-1 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100">
                      <div className="bg-white rounded-lg p-4 shadow-inner">
                        <Suspense fallback={
                          <div className="p-8 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 rounded-full border-4 border-t-blue-500 border-blue-200 animate-spin mb-4"></div>
                            <p className="text-gray-500 animate-pulse">Cargando gráfica...</p>
                          </div>
                        }>
                          <StockProjection 
                            data={calculationResult.prediccion}
                            punto_reorden={calculationResult.punto_reorden}
                            stock_minimo={calculationResult.stock_minimo}
                          />
                        </Suspense>
                      </div>
                    </div>
                  )}
                  
                  {calculationResult.alerta && (
                    <div className={`mt-6 p-5 rounded-xl shadow-sm backdrop-blur-sm transition-all duration-500 animate-fadeIn ${
                      calculationResult.alerta.nivel === 'Crítico' 
                        ? 'bg-red-50 border border-red-200' 
                        : calculationResult.alerta.nivel === 'Moderada'
                            ? 'bg-yellow-50 border border-yellow-200'
                            : 'bg-green-50 border border-green-200'
                    }`}>
                      <h4 className="text-lg font-semibold flex items-center mb-2">
                        {calculationResult.alerta.nivel === 'Crítico' ? (
                          <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : calculationResult.alerta.nivel === 'Moderada' ? (
                          <svg className="w-6 h-6 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <span className={`${
                          calculationResult.alerta.nivel === 'Crítico' 
                            ? 'text-red-700' 
                            : calculationResult.alerta.nivel === 'Moderada'
                                ? 'text-yellow-700'
                                : 'text-green-700'
                        }`}>
                          {calculationResult.alerta.nivel}
                        </span>
                      </h4>
                      <p className={`${
                        calculationResult.alerta.nivel === 'Crítico' 
                          ? 'text-red-600' 
                          : calculationResult.alerta.nivel === 'Moderada'
                              ? 'text-yellow-600'
                              : 'text-green-600'
                      }`}>
                        {calculationResult.alerta.accion}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default InventoryCalculator;
