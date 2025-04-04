import React, { useMemo, memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

// Register chart components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Modern color palette
const theme = {
  primary: '#2E86C1',
  secondary: '#27AE60',
  accent: '#F39C12',
  error: '#E74C3C',
  success: '#2ECC71',
  warning: '#F1C40F',
  text: '#34495E',
  muted: '#7F8C8D',
  light: '#ECF0F1',
  dark: '#2C3E50',
  background: '#F8F9FA',
  surface: '#FFFFFF',
};

/**
 * @component StockProjection
 * @description Visualiza la proyección de stock a lo largo del tiempo con soporte para agregación semanal.
 */
const StockProjection = memo(function StockProjection({ data, punto_reorden, stock_minimo }) {
  const [visualizacion, setVisualizacion] = useState('semanal'); // 'semanal' o 'diaria'
  const [chartVisible, setChartVisible] = useState(false);
  
  useEffect(() => {
    // Log a debug message to see what data we're getting
    console.log('StockProjection data received:', data);
    if (data && data.diario && data.diario.length > 0) {
      console.log('Primer punto de datos diario:', data.diario[0]);
      
      // Mostrar más información detallada sobre los datos
      console.log(`Datos de proyección - Días totales: ${data.diario.length}, ` + 
                  `Datos de consumo disponibles: ${data.diario.filter(d => d.yhat > 0).length}`);
    }
    
    // Mostrar la gráfica con animación
    const timer = setTimeout(() => {
      setChartVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [data]);
  
  // Validar datos de entrada y adaptar a nueva estructura
  const processedData = useMemo(() => {
    // Si es la estructura nueva (objeto con diario/semanal)
    if (data && typeof data === 'object' && (data.diario || data.semanal)) {
      console.log('Using structured data format');
      return data;
    }
    
    // Si es la estructura antigua (array directo)
    if (Array.isArray(data)) {
      console.log('Converting array data to structured format');
      return { diario: data, semanal: [] };
    }
    
    // Datos inválidos
    console.warn('Invalid data format for StockProjection:', data);
    return { diario: [], semanal: [] };
  }, [data]);
  
  // Verificar si hay suficientes datos
  if (!processedData || 
      ((!processedData.diario || processedData.diario.length === 0) && 
       (!processedData.semanal || processedData.semanal.length === 0))) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center shadow-sm transition-all duration-300" role="alert">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-600 font-medium">No hay datos suficientes para generar la proyección.</p>
        <p className="text-gray-500 text-sm mt-2">Intente seleccionar un producto con histórico de consumo.</p>
      </div>
    );
  }

  // Determinar si tenemos datos semanales
  const haySemanal = processedData.semanal && processedData.semanal.length > 0;
  
  // Si no hay datos semanales, forzar visualización diaria
  if (!haySemanal && visualizacion === 'semanal') {
    setVisualizacion('diaria');
  }
  
  // Obtener los datos según la visualización seleccionada
  const datosMostrados = useMemo(() => {
    if (visualizacion === 'semanal' && haySemanal) {
      return processedData.semanal;
    } else {
      return processedData.diario || [];
    }
  }, [visualizacion, processedData, haySemanal]);
  
  // Preparación de datos semanales para el gráfico
  const chartDataSemanal = useMemo(() => {
    if (!haySemanal) return null;
    
    return {
      labels: processedData.semanal.map(point => point.semana),
      datasets: [
        {
          label: 'Consumo Semanal',
          data: processedData.semanal.map(point => point.consumo_total),
          borderColor: theme.accent,
          backgroundColor: `${theme.accent}20`,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Stock Proyectado',
          data: processedData.semanal.map(point => point.stock_proyectado),
          borderColor: theme.primary,
          backgroundColor: `${theme.primary}10`,
          borderWidth: 2.5,
          tension: 0.2,
        },
        // Líneas de referencia
        ...(punto_reorden !== undefined ? [{
          label: 'Punto de Reorden',
          data: Array(processedData.semanal.length).fill(punto_reorden),
          borderColor: theme.warning,
          borderWidth: 2,
          borderDash: [6, 4],
          fill: false,
          pointRadius: 0,
        }] : []),
        ...(stock_minimo !== undefined ? [{
          label: 'Stock Mínimo',
          data: Array(processedData.semanal.length).fill(stock_minimo),
          borderColor: theme.error,
          borderWidth: 2,
          borderDash: [3, 3],
          fill: false,
          pointRadius: 0,
        }] : []),
      ],
    };
  }, [processedData.semanal, punto_reorden, stock_minimo, haySemanal]);

  // Filtrar datos diarios (solo días laborables para claridad)
  const datosFiltrados = useMemo(() => {
    if (!processedData.diario || !Array.isArray(processedData.diario)) {
      console.warn('Datos diarios no disponibles o no son un array');
      return [];
    }
    
    console.log('Procesando datos diarios:', processedData.diario.length, 'registros');
    
    try {
      // Primero validar que cada punto tenga el formato esperado
      const datosValidos = processedData.diario.filter(punto => {
        // Verificar que punto es un objeto válido
        if (!punto || typeof punto !== 'object') {
          console.warn('Punto de datos inválido:', punto);
          return false;
        }
        
        // Intentar determinar si es fin de semana o festivo usando diferentes propiedades
        const esFinSemana = punto.es_fin_semana !== undefined ? punto.es_fin_semana : 
                            punto.weekend !== undefined ? punto.weekend : null;
        
        const esFestivo = punto.es_festivo !== undefined ? punto.es_festivo :
                          punto.holiday !== undefined ? punto.holiday : null;
        
        // Si no podemos determinar, asumimos que no es fin de semana ni festivo
        return esFinSemana !== null ? !esFinSemana : true;
      });
      
      console.log('Filtrado a', datosValidos.length, 'días hábiles válidos');
      return datosValidos;
    } catch (err) {
      console.error('Error filtrando datos diarios:', err);
      return [];
    }
  }, [processedData.diario]);

  // Preparación de datos diarios para el gráfico
  const chartDataDiario = useMemo(() => {
    if (!datosFiltrados || datosFiltrados.length === 0) {
      console.warn('No hay datos filtrados para el gráfico diario');
      return {
        labels: [],
        datasets: []
      };
    }
    
    console.log('Preparando datos para gráfico diario con', datosFiltrados.length, 'puntos');
    
    try {
      // Asegurarse de que todos los puntos tengan las propiedades necesarias
      // y convertir valores a números si son strings
      const validPoints = datosFiltrados.map(point => {
        // Detectar fecha en diferentes formatos
        let fecha = '';
        if (typeof point.ds === 'string') {
          fecha = point.ds;
        } else if (point.fecha && typeof point.fecha === 'string') {
          fecha = point.fecha;
        } else if (point.date && typeof point.date === 'string') {
          fecha = point.date;
        } else {
          fecha = new Date().toISOString().split('T')[0]; // Fecha actual como fallback
        }
        
        // Detectar valores de consumo y stock
        const consumo = parseFloat(point.yhat || point.consumo || point.valor || 0);
        const stockProyectado = parseFloat(point.stock_proyectado || point.stock || 0);
        
        return {
          ds: fecha,
          yhat: isNaN(consumo) ? 0 : consumo,
          stock_proyectado: isNaN(stockProyectado) ? 0 : stockProyectado
        };
      });
      
      // Ordenar puntos por fecha si es posible
      validPoints.sort((a, b) => {
        try {
          return new Date(a.ds) - new Date(b.ds);
        } catch (e) {
          return 0;
        }
      });
      
      console.log('Puntos válidos para el gráfico:', validPoints.length);
      
      return {
        labels: validPoints.map(point => {
          try {
            // Formatear fecha como MM-DD
            const fecha = new Date(point.ds);
            return `${(fecha.getMonth() + 1).toString().padStart(2, '0')}-${fecha.getDate().toString().padStart(2, '0')}`;
          } catch (e) {
            // Si la fecha no es válida, usar el valor original
            return typeof point.ds === 'string' ? point.ds.substring(5) : '';
          }
        }),
        datasets: [
          {
            label: 'Consumo Diario',
            data: validPoints.map(point => point.yhat),
            borderColor: theme.accent,
            backgroundColor: `${theme.accent}20`,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Stock Proyectado',
            data: validPoints.map(point => point.stock_proyectado),
            borderColor: theme.primary,
            borderWidth: 2.5,
            tension: 0.2,
          },
          ...(punto_reorden !== undefined ? [{
            label: 'Punto de Reorden',
            data: Array(validPoints.length).fill(punto_reorden),
            borderColor: theme.warning,
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
          }] : []),
          ...(stock_minimo !== undefined ? [{
            label: 'Stock Mínimo',
            data: Array(validPoints.length).fill(stock_minimo),
            borderColor: theme.error,
            borderWidth: 2,
            borderDash: [3, 3],
            pointRadius: 0,
          }] : []),
        ],
      };
    } catch (err) {
      console.error('Error creando datos del gráfico diario:', err);
      return {
        labels: [],
        datasets: []
      };
    }
  }, [datosFiltrados, punto_reorden, stock_minimo, theme]);

  // Seleccionar los datos adecuados según la visualización
  const chartData = visualizacion === 'semanal' && haySemanal ? chartDataSemanal : chartDataDiario;

  // Opciones del gráfico
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1200,
      easing: 'easeOutQuart'
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y?.toFixed(2) || '0';
            return `${label}: ${value} unidades`;
          }
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: theme.dark,
        bodyColor: theme.text,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        displayColors: true,
        boxPadding: 6,
      },
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 20,
          font: {
            size: 12,
            family: "'Inter', sans-serif"
          }
        }
      },
      title: {
        display: true,
        text: visualizacion === 'semanal' ? 'Proyección de Stock Semanal' : 'Proyección de Stock Diaria (Solo Días Laborables)',
        font: {
          size: 16,
          weight: 'bold',
          family: "'Inter', sans-serif"
        },
        padding: {
          top: 10,
          bottom: 30
        },
        color: theme.dark
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Unidades',
          font: { 
            weight: 'bold',
            family: "'Inter', sans-serif",
            size: 12
          },
          color: theme.text
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.04)',
          drawBorder: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
          color: theme.muted,
          padding: 8
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: { 
            size: 11,
            family: "'Inter', sans-serif"
          },
          color: theme.muted,
          autoSkip: true,
          maxTicksLimit: visualizacion === 'semanal' ? 20 : 15
        },
        grid: {
          display: false,
          drawBorder: false
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    elements: {
      point: {
        hoverRadius: 8,
        radius: 4,
        hoverBorderWidth: 2
      },
      line: {
        borderWidth: 2
      }
    },
    layout: {
      padding: {
        left: 5, 
        right: 15,
        top: 5,
        bottom: 5
      }
    }
  }), [visualizacion, haySemanal]);

  return (
    <div className="stock-projection-container bg-white rounded-xl p-6 transition-all duration-300 transform">
      {haySemanal && (
        <div className="flex justify-end mb-6">
          <div className="inline-flex rounded-lg shadow-sm bg-gray-100 p-1">
            <button
              type="button"
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                visualizacion === 'semanal'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'bg-transparent text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setVisualizacion('semanal')}
              aria-pressed={visualizacion === 'semanal'}
            >
              Semanal
            </button>
            <button
              type="button"
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                visualizacion === 'diaria'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'bg-transparent text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setVisualizacion('diaria')}
              aria-pressed={visualizacion === 'diaria'}
            >
              Diaria
            </button>
          </div>
        </div>
      )}

      <div 
        className={`chart-wrapper h-80 md:h-96 overflow-hidden transition-all duration-700 ease-out ${
          chartVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <Line data={chartData} options={chartOptions} />
      </div>
      
      <div className="text-xs text-gray-500 mt-4 bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {visualizacion === 'semanal' ? 
            <span>La proyección muestra el consumo total y stock final por semana.</span> : 
            <span>La proyección muestra el consumo diario en días laborables (excluye fines de semana y festivos).</span>
          }
        </div>
      </div>
    </div>
  );
});

StockProjection.propTypes = {
  data: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.shape({
      diario: PropTypes.array,
      semanal: PropTypes.array
    })
  ]),
  punto_reorden: PropTypes.number,
  stock_minimo: PropTypes.number
};

StockProjection.defaultProps = {
  data: { diario: [], semanal: [] },
  punto_reorden: undefined,
  stock_minimo: undefined
};

export default StockProjection;
