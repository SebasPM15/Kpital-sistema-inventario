import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';

/**
 * @component LoadingState
 * @description Componente para mostrar estado de carga
 */
const LoadingState = ({ message = 'Cargando Dashboard...' }) => (
  <div className="p-6 flex justify-center items-center">
    <div className="animate-pulse flex flex-col items-center">
      <div className="h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
      <p className="mt-2 text-gray-600">{message}</p>
    </div>
  </div>
);

LoadingState.propTypes = {
  message: PropTypes.string
};

/**
 * @component ErrorState
 * @description Componente para mostrar estado de error
 */
const ErrorState = ({ error, onRetry }) => (
  <div className="p-6 text-center bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-600 mb-4">{error}</p>
    {onRetry && (
      <button 
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Reintentar carga
      </button>
    )}
  </div>
);

ErrorState.propTypes = {
  error: PropTypes.string.isRequired,
  onRetry: PropTypes.func
};

/**
 * @component MetricCard
 * @description Tarjeta para mostrar una métrica individual
 */
const MetricCard = ({ title, value, color = 'blue', units = '', icon = null }) => {
  const bgColor = `bg-${color}-50`;
  const textColor = `text-${color}-600`;
  const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;

  return (
    <div className={`p-4 rounded-lg transition-transform hover:scale-105 ${bgColor}`}>
      <div className="flex justify-between items-start">
        <p className="font-medium text-gray-700">{title}</p>
        {icon && <span className="text-xl" aria-hidden="true">{icon}</span>}
      </div>
      <p className={`text-xl ${textColor} font-bold mt-2`}>
        {formattedValue}
        {units && <span className="text-sm ml-1 font-normal">{units}</span>}
      </p>
    </div>
  );
};

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  color: PropTypes.string,
  units: PropTypes.string,
  icon: PropTypes.node
};

/**
 * @component Dashboard
 * @description Versión mejorada del Dashboard para visualización y análisis
 */
function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Función para cargar datos
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Prueba simple para ver si podemos obtener datos
      const response = await axios.post('http://localhost:5000/api/calculate', {
        historico: [200, 250, 300, 280, 220],
        stock_actual: 500,
        unidades_por_caja: 24,
      });
      
      setData(response.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.response?.data?.error || 
               err.message || 
               'No se pudieron cargar los datos. Por favor intente de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchData();
    
    // Opcional: configurar refresco automático
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // Cada 5 minutos
    
    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  // Memoizar cálculos derivados
  const metrics = useMemo(() => {
    if (!data) return [];
    
    const formatNumber = (num) => {
      return new Intl.NumberFormat('es-ES', { 
        maximumFractionDigits: 2, 
        minimumFractionDigits: 2 
      }).format(num);
    };
    
    // Usar los valores de consumo diario calculados por el backend
    const consumoDiario = data.consumo_diario || 0;
    const consumoDiarioProyectado = data.consumo_diario_proyectado || 0;
    
    return [
      { 
        id: 'consumo', 
        title: 'Consumo Promedio', 
        value: data.consumo_promedio,
        formattedValue: formatNumber(data.consumo_promedio),
        units: 'unidades/mes',
        color: 'blue',
        icon: '📊'
      },
      { 
        id: 'reorden', 
        title: 'Punto de Reorden', 
        value: data.punto_reorden,
        formattedValue: formatNumber(data.punto_reorden),
        units: 'unidades',
        color: 'green',
        icon: '⚡'
      },
      { 
        id: 'minimo', 
        title: 'Stock Mínimo', 
        value: data.stock_minimo,
        formattedValue: formatNumber(data.stock_minimo),
        units: 'unidades',
        color: 'purple',
        icon: '🛡️'
      },
      { 
        id: 'proyectado', 
        title: 'Stock Proyectado', 
        value: data.stock_proyectado || 0,
        formattedValue: formatNumber(data.stock_proyectado || 0),
        units: 'unidades',
        color: data.stock_proyectado < 0 ? 'red' : 'indigo',
        icon: data.stock_proyectado < 0 ? '⚠️' : '📈'
      },
      {
        id: 'consumo_diario',
        title: 'Consumo Diario Actual',
        value: consumoDiario,
        formattedValue: formatNumber(consumoDiario),
        units: 'u/día',
        color: 'amber',
        icon: '📆'
      },
      {
        id: 'consumo_proyectado',
        title: 'Consumo Diario Proyectado',
        value: consumoDiarioProyectado,
        formattedValue: formatNumber(consumoDiarioProyectado),
        units: 'u/día',
        color: 'cyan',
        icon: '🔮'
      }
    ];
  }, [data]);

  if (loading && !data) {
    return <LoadingState />;
  }

  if (error && !data) {
    return <ErrorState error={error} onRetry={fetchData} />;
  }

  return (
    <div className="dashboard-container animate-fadeIn">
      <div className="flex justify-between items-center mb-6 border-b pb-2">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <div className="flex items-center">
          {loading && (
            <span className="inline-block w-4 h-4 mr-2 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></span>
          )}
          <button 
            onClick={fetchData}
            disabled={loading}
            className="text-sm px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            aria-label="Refrescar datos"
          >
            Refrescar
          </button>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Métricas Clave</h3>
          {lastUpdated && (
            <p className="text-xs text-gray-500">
              Actualizado: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map(metric => (
            <MetricCard 
              key={metric.id}
              title={metric.title}
              value={metric.formattedValue}
              units={metric.units}
              color={metric.color}
              icon={metric.icon}
            />
          ))}
        </div>

        {data && data.alerta && (
          <div className={`mt-6 p-4 rounded-lg ${
            data.alerta.nivel?.toLowerCase() === 'crítica' 
              ? 'bg-red-100 border-l-4 border-red-500' 
              : data.alerta.nivel?.toLowerCase() === 'moderada'
                ? 'bg-yellow-100 border-l-4 border-yellow-500'
                : 'bg-green-100 border-l-4 border-green-500'
          }`}>
            <h4 className="text-lg font-bold">{data.alerta.nivel}</h4>
            <p className="my-2">{data.alerta.accion}</p>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Información del Sistema</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="mb-2">
              <span className="font-medium">Estado:</span> {" "}
              <span className="text-green-600">Operativo</span>
            </p>
            <p className="mb-2">
              <span className="font-medium">Versión:</span> {" "}
              <span>1.0.0</span>
            </p>
            <p>
              <span className="font-medium">Ambiente:</span> {" "}
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">
                {process.env.NODE_ENV === 'production' ? 'Producción' : 'Desarrollo'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
