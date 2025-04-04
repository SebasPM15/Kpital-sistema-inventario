import React from 'react';
import PropTypes from 'prop-types';

/**
 * @component ErrorBoundary
 * @description Componente que captura errores en sus componentes hijos
 * y muestra una interfaz de fallback para recuperación
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTimestamp: Date.now()
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, lastErrorTimestamp: Date.now() };
  }

  componentDidCatch(error, errorInfo) {
    // Incrementar contador de errores y registrar timestamp
    this.setState(prevState => ({ 
      errorInfo, 
      errorCount: prevState.errorCount + 1
    }));
    
    // Generar ID único para este error para seguimiento
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Información detallada para diagnóstico
    console.error("=== ERROR CAPTURADO POR ERROR BOUNDARY ===");
    console.error(`ID de Error: ${errorId}`);
    console.error(`Componente: ${this.props.componentName || 'Desconocido'}`);
    console.error(`Usuario: ${this.getUserContext()}`);
    console.error("Mensaje:", error.message);
    console.error("Stack:", error.stack);
    console.error("Información:", errorInfo.componentStack);
    console.error("Tiempo:", new Date().toISOString());
    console.error("Navegador:", navigator.userAgent);
    console.error("URL:", window.location.href);
    console.error("=======================================");
    
    // Opcionalmente enviar a un servicio de monitoreo
    this.reportErrorToMonitoring(error, errorInfo, errorId);
  }

  /**
   * Obtiene información contextual del usuario para diagnóstico
   * @returns {string} Información del contexto del usuario
   */
  getUserContext() {
    try {
      // Aquí podrías obtener información del usuario logueado
      return 'Anónimo'; // Retorna siempre anónimo por ahora
    } catch (e) {
      return 'Desconocido';
    }
  }

  /**
   * Envía el error a un servicio de monitoreo
   * @param {Error} error - El error capturado
   * @param {Object} errorInfo - Información adicional del error
   * @param {string} errorId - Identificador único del error
   */
  reportErrorToMonitoring(error, errorInfo, errorId) {
    // Implementación de envío a servicio de monitoreo
    // Ejemplo: Sentry, LogRocket, etc.
    
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[Desarrollo] Error ${errorId} sería reportado en producción.`);
      return;
    }

    // Aquí se implementaría el envío real de datos
    // Ejemplo con Sentry:
    /*
    if (window.Sentry) {
      window.Sentry.withScope((scope) => {
        scope.setExtra('componentStack', errorInfo.componentStack);
        scope.setExtra('componentName', this.props.componentName);
        scope.setExtra('errorId', errorId);
        window.Sentry.captureException(error);
      });
    }
    */
  }

  /**
   * Reinicia el estado del componente para intentar recuperación
   */
  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    
    // Opcionalmente refrescar datos después de reset
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  /**
   * Refresca la página como último recurso
   */
  handleRefresh = () => {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      // Si se proporciona un componente fallback personalizado, lo usamos
      if (this.props.fallback) {
        return React.isValidElement(this.props.fallback) 
          ? this.props.fallback 
          : this.props.fallback(this.state.error, this.handleReset);
      }
      
      // UI de error por defecto
      return (
        <div className="error-boundary-container p-4 my-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-red-700 mb-2">
            Ha ocurrido un error inesperado
          </h2>
          <p className="text-red-600 mb-3">
            {this.state.error?.message || "Error en la aplicación"}
          </p>
          
          {this.props.showDetails && (
            <details className="mb-3 text-sm text-gray-700">
              <summary className="cursor-pointer text-red-600 font-medium py-1">Detalles técnicos</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded-md overflow-auto text-xs max-h-32">
                {this.state.error?.stack || "No hay detalles disponibles"}
              </pre>
            </details>
          )}
          
          <div className="flex space-x-3 mt-4">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Intentar recuperación del error"
            >
              Intentar recuperar
            </button>
            
            <button
              onClick={this.handleRefresh}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Refrescar la página"
            >
              Refrescar página
            </button>
          </div>
          
          {this.state.errorCount > 2 && (
            <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-800">
              <p className="font-medium">Se han detectado errores múltiples ({this.state.errorCount})</p>
              <p className="mt-1">
                Si el problema persiste, por favor contacte al soporte técnico y mencione el ID: 
                <span className="font-mono bg-yellow-100 px-1 py-0.5 rounded ml-1">
                  {errorId || `ERR-${Date.now().toString(36)}`}
                </span>
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.func
  ]),
  componentName: PropTypes.string,
  showDetails: PropTypes.bool,
  onReset: PropTypes.func
};

ErrorBoundary.defaultProps = {
  componentName: 'Componente sin nombre',
  showDetails: process.env.NODE_ENV !== 'production'
};

export default ErrorBoundary;
