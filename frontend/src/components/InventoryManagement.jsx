import React, { useState, memo, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import ErrorBoundary from './ErrorBoundary';

// Carga directa para mayor estabilidad
import InventoryForm from './InventoryForm';
import Simulator from './Simulator';
import Dashboard from './Dashboard';

/**
 * Componente de carga para mostrar mientras se cargan los componentes
 */
const LoadingFallback = memo(function LoadingFallback() {
  return (
    <div className="p-8 flex justify-center items-center" aria-live="polite">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-14 w-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-gray-600 font-medium">Cargando módulo...</p>
      </div>
    </div>
  );
});

/**
 * @component TabButton
 * @description Botón de navegación de pestañas accesible y reutilizable
 */
const TabButton = memo(function TabButton({ id, label, icon, isActive, onClick, ariaLabel }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`tab-button flex items-center justify-center flex-1 py-4 px-2 transition-all duration-300 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset 
        ${isActive 
          ? 'bg-white border-b-2 border-blue-600 font-medium text-blue-700' 
          : 'hover:bg-gray-100 text-gray-600'
        }`}
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      aria-label={ariaLabel || label}
    >
      {icon && <span className="text-xl mr-2" aria-hidden="true">{icon}</span>}
      <span>{label}</span>
    </button>
  );
});

TabButton.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.string,
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string
};

/**
 * @component InventoryManagement
 * @description Componente principal que gestiona las diferentes secciones de la aplicación
 */
const InventoryManagement = memo(function InventoryManagement() {
  // Recuperar la última pestaña activa del localStorage
  const getInitialTab = () => {
    try {
      return localStorage.getItem('inventory-active-tab') || 'calculator';
    } catch (e) {
      return 'calculator';
    }
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Persistir pestaña activa en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('inventory-active-tab', activeTab);
    } catch (e) {
      console.error('Error guardando pestaña activa:', e);
    }
  }, [activeTab]);

  // Definición de pestañas con metadatos
  const tabs = useMemo(() => [
    { 
      id: 'calculator', 
      label: 'Calculadora', 
      icon: '📊',
      ariaLabel: 'Ir a calculadora de inventario',
      description: 'Calcule los parámetros óptimos de su inventario'
    },
    { 
      id: 'simulator', 
      label: 'Simulador', 
      icon: '🔮',
      ariaLabel: 'Ir a simulador de escenarios',
      description: 'Simule diferentes escenarios de demanda'
    },
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: '📈',
      ariaLabel: 'Ir a dashboard de análisis',
      description: 'Visualice métricas clave de su inventario'
    }
  ], []);
  
  // Usar useCallback para optimizar el cambio de pestañas
  const handleTabChange = useCallback((tabId) => {
    if (tabId !== activeTab) {
      setIsTransitioning(true);
      setActiveTab(tabId);
      
      // Pequeña animación para transición
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150);
    }
  }, [activeTab]);

  // Determinar qué componente mostrar con manejo de errores mejorado
  const renderActiveComponent = useCallback(() => {
    try {
      if (isTransitioning) {
        return <LoadingFallback />;
      }
      
      switch(activeTab) {
        case 'calculator':
          return <InventoryForm />;
        case 'simulator':
          return <Simulator />;
        case 'dashboard':
          return <Dashboard />;
        default:
          console.warn(`Pestaña desconocida: ${activeTab}, mostrando calculadora`);
          return <InventoryForm />;
      }
    } catch (error) {
      console.error(`Error al renderizar el componente ${activeTab}:`, error);
      return (
        <div className="p-5 bg-red-50 border border-red-200 rounded-lg text-center">
          <p className="text-red-600 mb-3">Error al cargar el módulo: {error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Recargar aplicación
          </button>
        </div>
      );
    }
  }, [activeTab, isTransitioning]);

  // Encontrar el tab activo para mostrar su descripción
  const activeTabInfo = useMemo(() => {
    return tabs.find(tab => tab.id === activeTab) || tabs[0];
  }, [tabs, activeTab]);

  return (
    <div className="app-container max-w-6xl mx-auto px-4">
      <div className="shadow-xl rounded-xl overflow-hidden bg-white">
        {/* Navegación de pestañas mejorada para accesibilidad */}
        <nav 
          className="tab-navigation flex border-b border-gray-200" 
          role="tablist" 
          aria-label="Secciones de la aplicación"
        >
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={handleTabChange}
              ariaLabel={tab.ariaLabel}
            />
          ))}
        </nav>

        {/* Descripción de la pestaña activa */}
        <div className="bg-gray-50 p-3 text-sm text-gray-600 border-b border-gray-200">
          {activeTabInfo.description}
        </div>

        {/* Área de contenido con transiciones sutiles */}
        <div 
          className={`transition-opacity duration-150 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
          role="tabpanel" 
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          <ErrorBoundary 
            componentName={activeTab} 
            showDetails={true}
            fallback={
              <div className="p-5 bg-red-50 border border-red-200 rounded-lg m-6 text-center">
                <p className="text-red-600 mb-3">Ha ocurrido un error en este módulo.</p>
                <div className="flex justify-center space-x-3">
                  <button 
                    onClick={() => handleTabChange('calculator')}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Ir a Calculadora
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Recargar aplicación
                  </button>
                </div>
              </div>
            }
          >
            <div className="p-6 bg-gray-50">
              {renderActiveComponent()}
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
});

InventoryManagement.propTypes = {};
InventoryManagement.displayName = 'InventoryManagement';

export default InventoryManagement;
