import React, { useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * @component ProductSearch
 * @description Componente para buscar productos en los datos cargados desde Excel
 */
const ProductSearch = ({ data, mappings, onSelectProduct }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Calcular el total de productos y las columnas históricas disponibles
  const { totalProducts, historicColumns } = useMemo(() => {
    return {
      totalProducts: data?.length || 0,
      historicColumns: mappings?.historico || []
    };
  }, [data, mappings]);

  // Actualizar resultados cuando cambia la consulta
  useEffect(() => {
    if (!query || query.length < 2 || !data || !mappings) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const queryLower = query.toLowerCase();
    
    // Buscar productos que coincidan con la consulta
    const filtered = data.filter(item => {
      // Asegurarse de que los campos existan
      const codigo = item[mappings.codigo]?.toString().toLowerCase() || '';
      const nombre = item[mappings.nombre]?.toString().toLowerCase() || '';
      
      return codigo.includes(queryLower) || nombre.includes(queryLower);
    }).slice(0, 5); // Limitar a 5 resultados
    
    setResults(filtered);
    setShowDropdown(filtered.length > 0);
    setFocusedIndex(-1); // Reset focus when results change
  }, [query, data, mappings]);

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejar navegación con teclado en el dropdown
  const handleKeyDown = (e) => {
    if (!showDropdown) return;
    
    // Navegar hacia abajo
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    }
    // Navegar hacia arriba
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
    }
    // Seleccionar elemento con Enter
    else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      handleSelectProduct(results[focusedIndex]);
    }
    // Cerrar dropdown con Escape
    else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
    }
  };

  // Manejar la selección de un producto
  const handleSelectProduct = (product) => {
    // Asegurarse de que todos los campos estén presentes
    const completeProduct = { ...product };
    
    // Si falta algún campo, asignar valor por defecto
    if (!mappings.codigo || !(mappings.codigo in product)) {
      completeProduct[mappings.codigo] = "Sin código";
    }
    
    if (!mappings.nombre || !(mappings.nombre in product)) {
      completeProduct[mappings.nombre] = "Sin nombre";
    }
    
    // Asegurar la existencia del campo stock_actual
    if (!mappings.stock_actual || !(mappings.stock_actual in product)) {
      completeProduct[mappings.stock_actual] = 0;
    }
    
    // Asegurar la existencia del campo unidades_por_caja con valor mínimo 1
    if (!mappings.unidades_por_caja || !(mappings.unidades_por_caja in product)) {
      completeProduct[mappings.unidades_por_caja] = 1;
    }
    
    // Asegurar que todos los campos históricos existan
    if (mappings.historico && Array.isArray(mappings.historico)) {
      mappings.historico.forEach(col => {
        if (!(col in completeProduct)) {
          completeProduct[col] = 0;
        }
      });
    }
    
    // Limpiar la consulta y cerrar el dropdown
    setQuery('');
    setShowDropdown(false);
    
    onSelectProduct(completeProduct);
  };

  return (
    <div className="product-search bg-white p-6 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Buscar Producto
      </h3>
      
      <div className="mb-5 p-3 bg-blue-50 rounded-lg border border-blue-100 scale">
        <div className="flex items-center justify-between">
          <span className="text-xs text-blue-700 font-medium">Total de productos</span>
          <span className="text-sm font-bold text-blue-800">{totalProducts}</span>
        </div>
        
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-blue-700 font-medium">Meses de histórico</span>
          <span className="text-sm font-bold text-blue-800">{historicColumns.length}</span>
        </div>
        
        {historicColumns.length > 0 && (
          <div className="mt-3 pt-2 border-t border-blue-100">
            <div className="text-xs text-blue-700 font-medium mb-1.5">Columnas de histórico:</div>
            <div className="flex flex-wrap gap-1.5">
              {historicColumns.slice(0, 3).map((col, idx) => (
                <span key={idx} className="inline-block px-2 py-1 text-xs bg-white text-blue-700 rounded border border-blue-200 hover-scale">
                  {col.length > 12 ? col.substring(0, 10) + '...' : col}
                </span>
              ))}
              {historicColumns.length > 3 && (
                <span className="inline-block px-2 py-1 text-xs bg-white text-blue-700 rounded border border-blue-200 hover-scale">
                  +{historicColumns.length - 3} más
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="relative">
        <div className={`relative transition-all duration-300 ${isInputFocused ? 'transform scale-105' : ''}`}>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="Buscar por código o nombre"
            className={`w-full p-3 pl-10 bg-gray-50 border ${isInputFocused ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'} rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all duration-200`}
            aria-label="Buscar producto"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className={`w-5 h-5 ${isInputFocused ? 'text-blue-500' : 'text-gray-400'} transition-colors duration-200`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {query && (
            <button 
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              onClick={() => setQuery('')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="sr-only">Limpiar búsqueda</span>
            </button>
          )}
        </div>
        
        {query.length < 2 && (
          <p className="text-xs text-gray-500 mt-2 pl-2 flex items-center slide-up">
            <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ingrese al menos 2 caracteres para buscar
          </p>
        )}
        
        {showDropdown && (
          <div 
            ref={dropdownRef}
            className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto scale"
            style={{animation: 'scale 0.3s cubic-bezier(0.16, 1, 0.3, 1)'}}
          >
            {results.map((product, idx) => (
              <div 
                key={idx}
                className={`p-4 transition-colors duration-150 border-b border-gray-100 last:border-0 cursor-pointer ${
                  idx === focusedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelectProduct(product)}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-800">
                    {product[mappings.codigo]}
                  </p>
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                    Stock: {product[mappings.stock_actual]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {product[mappings.nombre]}
                </p>
                <div className="mt-2 text-xs text-gray-500 flex items-center">
                  <svg className="w-4 h-4 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Unid/Caja: {product[mappings.unidades_por_caja]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

ProductSearch.propTypes = {
  data: PropTypes.array.isRequired,
  mappings: PropTypes.object.isRequired,
  onSelectProduct: PropTypes.func.isRequired
};

export default ProductSearch;
