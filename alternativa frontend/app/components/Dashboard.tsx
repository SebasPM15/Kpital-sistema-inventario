"use client";

import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
    FaChevronLeft, FaChevronRight, FaInfoCircle, FaBoxOpen, FaTimes, FaCube,
    FaFileExcel, FaUpload, FaPrint, FaChartLine, FaHistory, FaCalculator,
    FaCalendarAlt, FaExclamationTriangle, FaTruck, FaPlus, FaBox, FaCheckCircle,
    FaFileUpload, FaHome, FaWarehouse, FaClipboardList, FaChartBar, FaCog,
    FaUser, FaSignOutAlt
} from 'react-icons/fa';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { GiReceiveMoney } from 'react-icons/gi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interfaces
interface Proyeccion {
    mes: string;
    stock_proyectado: number;
    consumo_mensual: number;
    consumo_diario: number;
    stock_seguridad: number;
    stock_minimo: number;
    punto_reorden: number;
    deficit: number;
    cajas_a_pedir: number;
    unidades_a_pedir: number;
    alerta_stock: boolean;
    fecha_reposicion: string;
    tiempo_cobertura: number;
    frecuencia_reposicion: number;
}

interface ProductoData {
    CODIGO: string;
    DESCRIPCION: string;
    UNIDADES_POR_CAJA: number;
    STOCK_FISICO: number;
    UNIDADES_TRANSITO_DISPONIBLES: number;
    STOCK_TOTAL: number;
    CONSUMO_PROMEDIO: number;
    CONSUMO_PROYECTADO: number;
    CONSUMO_TOTAL: number;
    CONSUMO_DIARIO: number;
    STOCK_SEGURIDAD: number;
    STOCK_MINIMO: number;
    PUNTO_REORDEN: number;
    DEFICIT: number;
    CAJAS_A_PEDIR: number;
    UNIDADES_A_PEDIR: number;
    FECHA_REPOSICION: string;
    DIAS_COBERTURA: number;
    HISTORICO_CONSUMOS: Record<string, number>;
    PROYECCIONES: Proyeccion[];
    CONFIGURACION: {
        DIAS_STOCK_SEGURIDAD: number;
        DIAS_PUNTO_REORDEN: number;
        LEAD_TIME_REPOSICION: number;
        DIAS_MAX_REPOSICION: number;
        DIAS_LABORALES_MES: number;
    };
}

interface PredictionData {
    success: boolean;
    data: ProductoData;
}

interface DetailModalProps {
    onClose: () => void;
    selectedPrediction: PredictionData | null;
    refreshPredictions: () => Promise<void>;
}

// Constantes
const ITEMS_PER_PAGE = 12;

const Dashboard = () => {
    // Estados
    const [allPredictions, setAllPredictions] = useState<ProductoData[]>([]);
    const [selectedPrediction, setSelectedPrediction] = useState<PredictionData | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [currentExcel, setCurrentExcel] = useState('PRUEBA PASANTIAS EPN.xlsx');
    const [excelSubido, setExcelSubido] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [weeklyData, setWeeklyData] = useState<any[]>([]);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('general');
    const [chartView, setChartView] = useState<'semanal' | 'mensual'>('semanal');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Refs
    const chartRef = useRef<HTMLDivElement>(null);

    // Efectos
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await axios.get('http://localhost:3500/api/predictions');
                
                if (response.data?.success) {
                    setAllPredictions(Array.isArray(response.data.data) ? response.data.data : []);
                } else {
                    setAllPredictions([]);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                setAllPredictions([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Funciones de utilidad
    const calcularFechaReposicion = (diasCobertura: number, fechaInicio: Date = new Date()) => {
        const fechaReposicion = new Date(fechaInicio);
        fechaReposicion.setDate(fechaReposicion.getDate() + diasCobertura);
        return fechaReposicion.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const generateChartData = (proyecciones: Proyeccion[]) => {
        const weekly: any[] = [];
        const monthly: any[] = [];
        
        proyecciones.forEach((proyeccion) => {
            monthly.push({
                periodo: proyeccion.mes,
                stock: proyeccion.stock_proyectado,
                min: proyeccion.punto_reorden,
                seguridad: proyeccion.stock_seguridad,
                consumo: proyeccion.consumo_mensual,
                fecha_reposicion: proyeccion.fecha_reposicion
            });

            const stockInicial = proyeccion.stock_proyectado;
            const consumoDiario = proyeccion.consumo_diario;

            for (let semana = 1; semana <= 4; semana++) {
                const dias = 7;
                const consumo = consumoDiario * dias;
                const stock = semana === 1 
                    ? stockInicial 
                    : weekly[weekly.length - 1].stock - consumo;

                weekly.push({
                    semana: `Sem ${semana} ${proyeccion.mes}`,
                    stock: Math.max(stock, 0),
                    consumo: consumo,
                    min: proyeccion.punto_reorden
                });
            }
        });
        
        return { weekly, monthly };
    };

    const handleDownloadPDF = async () => {
        if (!selectedPrediction) return;
    
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.setFont('helvetica');
        
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 139);
        pdf.text(`INFORME TÉCNICO DE INVENTARIO`, 105, 15, {align: 'center'});
        
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Producto: ${selectedPrediction.data.CODIGO} - ${selectedPrediction.data.DESCRIPCION}`, 15, 30);
        pdf.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 15, 30);
        
        // Sección 1: Resumen Ejecutivo
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 139);
        pdf.text('1. RESUMEN EJECUTIVO', 15, 40);
        pdf.setFontSize(10);
        
        const status = getStockStatus(
            selectedPrediction.data.STOCK_TOTAL,
            selectedPrediction.data.STOCK_SEGURIDAD,
            selectedPrediction.data.PUNTO_REORDEN
        );
        
        let statusMessage = '';
        let statusColor = [0, 0, 0];
        if (status === 'danger') {
            statusMessage = 'NIVEL CRÍTICO - REQUIERE ORDEN URGENTE';
            statusColor = [255, 0, 0];
        } else if (status === 'warning') {
            statusMessage = 'NIVEL BAJO - MONITOREAR CONSTANTEMENTE';
            statusColor = [255, 165, 0];
        } else {
            statusMessage = 'NIVEL ADECUADO';
            statusColor = [0, 100, 0];
        }
        
        pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.text(`Estado actual del inventario: ${statusMessage}`, 15, 50);
        pdf.setTextColor(0, 0, 0);
        
        const porcentajeSS = Math.round(selectedPrediction.data.STOCK_SEGURIDAD / selectedPrediction.data.CONSUMO_PROMEDIO * 100);
        
        const keyData = [
            {label: 'Consumo Diario (DIARIO)', value: `${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} unidades/día`},
            {label: 'Stock de Seguridad (SS)', value: `${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} unidades (${porcentajeSS}% del consumo mensual)`},
            {label: 'Punto de Reorden (44 días)', value: `${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)} unidades`},
            {label: 'Stock Actual', value: `${selectedPrediction.data.STOCK_TOTAL.toFixed(0)} unidades (${selectedPrediction.data.DIAS_COBERTURA} días de cobertura)`},
            {label: 'Fecha estimada de reposición', value: selectedPrediction.data.FECHA_REPOSICION},
            {label: 'Consumo Promedio Mensual', value: `${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)} unidades`},
            {label: 'Déficit Actual', value: `${selectedPrediction.data.DEFICIT.toFixed(0)} unidades`},
            {label: 'Cajas a Pedir', value: `${selectedPrediction.data.CAJAS_A_PEDIR} cajas (${selectedPrediction.data.UNIDADES_A_PEDIR} unidades)`}
        ];
        
        let y = 60;
        keyData.forEach(item => {
            pdf.text(`${item.label}:`, 20, y);
            pdf.text(item.value, 70, y);
            y += 7;
        });
        
        // Sección 2: Análisis Detallado
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 139);
        pdf.text('2. ANÁLISIS DETALLADO', 15, y + 10);
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        y += 20;
        pdf.text('Este informe detalla la situación actual del inventario y las proyecciones para los próximos meses.', 15, y);
        y += 7;
        pdf.text(`El consumo histórico promedio es de ${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)} unidades mensuales (${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} unidades/día).`, 15, y);
        y += 7;
        pdf.text(`El stock de seguridad calculado es de ${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} unidades, lo que representa ${porcentajeSS}% del consumo mensual promedio.`, 15, y);
        y += 7;
        pdf.text(`El punto de reorden (stock mínimo requerido) se calcula como:`, 15, y);
        y += 7;
        pdf.text(`Stock Mínimo = Consumo Promedio Mensual + Stock de Seguridad = ${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)} + ${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} = ${selectedPrediction.data.STOCK_MINIMO.toFixed(0)} unidades`, 20, y);
        y += 7;
        pdf.text(`Punto de Reorden (44 días) = Consumo Diario * 44 = ${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} * 44 = ${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)} unidades`, 20, y);
        y += 7;
        
        // Sección 3: Recomendaciones
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 139);
        pdf.text('3. RECOMENDACIONES', 15, y + 10);
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        y += 20;
        pdf.text('1. Ordenar inmediatamente:', 15, y);
        y += 7;
        pdf.text(`   - Cantidad: ${selectedPrediction.data.CAJAS_A_PEDIR} cajas (${selectedPrediction.data.UNIDADES_A_PEDIR} unidades)`, 20, y);
        y += 7;
        pdf.text(`   - Fecha sugerida de pedido: ${new Date().toLocaleDateString()}`, 20, y);
        y += 7;
        pdf.text(`   - Fecha estimada de próxima reposición: ${selectedPrediction.data.FECHA_REPOSICION}`, 20, y);
        y += 7;
        pdf.text(`   - Justificación: El stock actual (${selectedPrediction.data.STOCK_TOTAL.toFixed(0)} unidades) está por debajo del punto de reorden (${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)} unidades)`, 20, y);
        y += 7;
        pdf.text(`2. Tiempo estimado de cobertura actual: ${selectedPrediction.data.DIAS_COBERTURA} días`, 15, y);
        y += 7;
        pdf.text(`3. Frecuencia sugerida de reposición: Cada ${selectedPrediction.data.PROYECCIONES[0]?.frecuencia_reposicion || 30} días`, 15, y);
        y += 7;
        
        // Sección 4: Proyección Mensual
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 139);
        pdf.text('4. PROYECCIÓN MENSUAL', 15, y + 10);
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        y += 20;
        
        const proyeccionData = selectedPrediction.data.PROYECCIONES.map(proyeccion => {
            return [
                proyeccion.mes,
                `${proyeccion.stock_proyectado.toFixed(0)} unidades`,
                `${proyeccion.stock_seguridad.toFixed(0)} unidades`,
                `${proyeccion.punto_reorden.toFixed(0)} unidades`,
                proyeccion.cajas_a_pedir > 0 ? `${proyeccion.cajas_a_pedir} cajas` : '-',
                proyeccion.fecha_reposicion,
                proyeccion.alerta_stock ? 'ALERTA' : 'OK'
            ];
        });
        
        autoTable(pdf, {
            startY: y,
            head: [['Mes', 'Stock Proyectado', 'Stock Seguridad', 'Pto. Reorden', 'Cajas a Pedir', 'Fecha Reposición', 'Estado']],
            body: proyeccionData,
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            didDrawCell: (data) => {
                if (data.column.index === 6 && data.cell.raw === 'ALERTA') {
                    pdf.setTextColor(255, 0, 0);
                }
            }
        });
        
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Generado automáticamente por el Sistema de Gestión de Inventarios', 15, 290);
        pdf.text('EPN - Departamento de Logística', 160, 290, {align: 'right'});
        
        pdf.save(`informe-detallado-${selectedPrediction.data.CODIGO}.pdf`);
    };

    const handleProcessFile = async () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('excel', selectedFile);

        try {
            setProcessing(true);
            setError(null);

            const response = await axios.post('http://localhost:3500/api/predictions/refresh', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 30000
            });

            if (!response.data.success) {
                throw new Error(response.data.error || 'Error al procesar el archivo');
            }

            setCurrentExcel(selectedFile.name);
            setSelectedFile(null);
            setExcelSubido(true);

            const predictionsResponse = await axios.get('http://localhost:3500/api/predictions');
            setAllPredictions(predictionsResponse.data.data || []);

        } catch (error: any) {
            console.error('Error:', error);
            let errorMessage = 'Error al procesar el archivo';
            if (error.response) {
                errorMessage = error.response.data?.error || error.message;
            } else if (error.request) {
                errorMessage = 'No se recibió respuesta del servidor';
            }
            setError(errorMessage);
        } finally {
            setProcessing(false);
        }
    };

    const handlePredict = async (codigo: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get<PredictionData>(`http://localhost:3500/api/predictions/${codigo}`);
            
            if (!response.data?.data) {
                throw new Error('Datos incompletos recibidos del servidor');
            }

            setSelectedPrediction(response.data);
            const { weekly, monthly } = generateChartData(response.data.data.PROYECCIONES);
            setWeeklyData(weekly);
            setMonthlyData(monthly);

        } catch (err: any) {
            console.error('Error detallado:', err);
            setError(err.response?.data?.error || err.message || 'Error al obtener la predicción');
        } finally {
            setLoading(false);
        }
    };

    const refreshPredictions = async () => {
        try {
            const response = await axios.get('http://localhost:3500/api/predictions');
            if (response.data?.success) {
                setAllPredictions(response.data.data || []);
            }
        } catch (error) {
            console.error('Error al actualizar predicciones:', error);
            setError('Error al actualizar los datos');
        }
    };

    const handleCloseModal = () => {
        setSelectedPrediction(null);
        refreshPredictions();
    };

    // Funciones auxiliares
    const totalPages = Math.ceil((allPredictions?.length || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentPredictions = (allPredictions || []).slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const formatMes = (mes: string) => mes.replace('-', ' ').toUpperCase();

    const getStockStatus = (stockActual: number, stockSeguridad: number, puntoReorden: number) => {
        if (stockActual < stockSeguridad) return 'danger';
        if (stockActual < puntoReorden) return 'warning';
        return 'safe';
    };

    const renderStatusIcon = (status: string) => {
        switch (status) {
            case 'danger':
                return <FiAlertTriangle className="text-red-500 animate-pulse" />;
            case 'warning':
                return <FiAlertTriangle className="text-amber-500" />;
            default:
                return <FiCheckCircle className="text-emerald-500" />;
        }
    };

    const renderStatusMessage = (status: string) => {
        switch (status) {
            case 'danger':
                return 'Stock crítico - ¡Acción inmediata requerida!';
            case 'warning':
                return 'Stock bajo - Monitorear continuamente';
            default:
                return 'Stock dentro de niveles seguros';
        }
    };

    const calculateDaysOfCoverage = (stock: number, dailyConsumption: number) => {
        return Math.round(stock / dailyConsumption);
    };

    const formatNumber = (value: number | undefined, decimals: number = 0) => {
        if (typeof value !== 'number' || isNaN(value)) return '-';
        return value.toFixed(decimals);
    };

    // Componentes
    const PaginationControls = () => (
        <div className="flex items-center gap-2">
            <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 disabled:bg-slate-100 disabled:text-slate-400 transition-colors shadow-sm"
            >
                <FaChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 bg-sky-50 px-4 py-2 rounded-full">
                <span className="text-sm font-medium text-sky-700">
                    Página <span className="text-sky-800 font-bold">{currentPage}</span> de {totalPages}
                </span>
            </div>

            <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 disabled:bg-slate-100 disabled:text-slate-400 transition-colors shadow-sm"
            >
                <FaChevronRight className="w-4 h-4" />
            </button>
        </div>
    );

    const FileUploader = () => (
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-4">
                    Bienvenido a nuestro Sistema de Inventario
                </h1>
                <p className="text-lg text-slate-600">
                    Por favor, ingrese el Excel a analizar
                </p>
            </div>

            <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-100">
                <h2 className="text-xl font-semibold text-blue-700 mb-4">
                    Requisitos del Archivo Excel
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-slate-700">
                    <li>
                        <span className="font-medium">CODIGO:</span> Identificador único del producto (texto)
                    </li>
                    <li>
                        <span className="font-medium">DESCRIPCION:</span> Nombre o descripción del producto (texto)
                    </li>
                    <li>
                        <span className="font-medium">UNIDADES_POR_CAJA:</span> Cantidad de unidades por caja (número)
                    </li>
                    <li>
                        <span className="font-medium">STOCK_TOTAL:</span> Cantidad total en inventario (número)
                    </li>
                    <li>
                        <span className="font-medium">HISTORICO_CONSUMOS:</span> Consumos mensuales en formato {'{ "MES-AÑO": cantidad }'}
                    </li>
                </ul>
            </div>

            <div className="flex flex-col items-center">
                <div className="w-full max-w-md mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Seleccionar archivo Excel:
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            id="excel-upload"
                            accept=".xlsx, .xls"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setSelectedFile(e.target.files[0]);
                                }
                            }}
                            className="hidden"
                        />
                        <label
                            htmlFor="excel-upload"
                            className="flex-1 px-4 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                            <FaFileExcel className="text-lg" />
                            Seleccionar Excel
                        </label>
                    </div>
                    {selectedFile && (
                        <div className="mt-2 text-sm text-slate-600 flex items-center gap-2">
                            <FaCheckCircle className="text-green-500" />
                            {selectedFile.name}
                        </div>
                    )}
                </div>

                {selectedFile && (
                    <button
                        onClick={handleProcessFile}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        disabled={processing}
                    >
                        {processing ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <FaUpload className="text-lg" />
                                Analizar Archivo
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );

    const InventoryChart = () => (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                    <FaChartLine className="text-gray-900" />
                    Proyección de Stock - {chartView === 'semanal' ? 'Semanal' : 'Mensual'}
                </h4>
                <select 
                    value={chartView}
                    onChange={(e) => setChartView(e.target.value as 'semanal' | 'mensual')}
                    className="px-3 py-1 border rounded-lg text-sm bg-white text-gray-900 border-gray-300"
                >
                    <option value="semanal">Vista Semanal</option>
                    <option value="mensual">Vista Mensual</option>
                </select>
            </div>
            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartView === 'semanal' ? weeklyData : monthlyData}
                        margin={{ top: 10, right: 30, left: 20, bottom: 80 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                            dataKey={chartView === 'semanal' ? 'semana' : 'periodo'} 
                            angle={-45} 
                            textAnchor="end"
                            tick={{ fontSize: 12, fill: "#4b5563" }}
                            tickMargin={20}
                            interval={0}
                        />
                        <YAxis 
                            tick={{ fill: "#4b5563" }}
                            label={{
                                value: 'Unidades',
                                angle: -90,
                                position: 'insideLeft',
                                fill: "#4b5563",
                                style: { fontSize: 12 }
                            }}
                        />
                        <Tooltip 
                            formatter={(value: number, name: string) => {
                                return [`${value.toFixed(0)} unidades`, 
                                    name === 'Stock Proyectado' ? 'Stock Proyectado' :
                                    name === 'Punto de Reorden' ? 'Punto de Reorden' :
                                    name === 'Stock de Seguridad' ? 'Stock de Seguridad' :
                                    'Consumo Semanal'];
                            }}
                            labelFormatter={(label) => `Período: ${label}`}
                            contentStyle={{ 
                                backgroundColor: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                color: '#111827'
                            }}
                        />
                        <Legend 
                            wrapperStyle={{
                                paddingTop: 20,
                                paddingBottom: 10,
                                color: '#374151'
                            }}
                            verticalAlign="top"
                        />
                        <Line 
                            type="monotone" 
                            dataKey="stock" 
                            stroke="#1d4ed8"
                            strokeWidth={2}
                            name="Stock Proyectado"
                            dot={{ fill: '#1d4ed8', strokeWidth: 1 }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="min" 
                            stroke="#dc2626"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Punto de Reorden"
                        />
                        {chartView === 'mensual' && (
                            <Line 
                                type="monotone" 
                                dataKey="seguridad" 
                                stroke="#8B008B"
                                strokeWidth={2}
                                name="Stock de Seguridad"
                                dot={{ fill: '#8B008B', strokeWidth: 1 }}
                            />
                        )}
                        {chartView === 'semanal' && (
                            <Line 
                                type="monotone" 
                                dataKey="consumo" 
                                stroke="#16a34a"
                                strokeWidth={2}
                                name="Consumo Semanal"
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );

    const TransitUnitsControl = ({ codigo }: { codigo: string }) => {
        const [transitUnits, setTransitUnits] = useState<number | ''>('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [success, setSuccess] = useState(false);
        const inputRef = useRef<HTMLInputElement>(null);
    
        const handleAddTransitUnits = async () => {
            if (transitUnits === '' || Number(transitUnits) <= 0) {
                setError('Debe ingresar un número válido mayor a 0');
                inputRef.current?.focus();
                return;
            }
    
            try {
                setLoading(true);
                setError(null);
                setSuccess(false);
    
                const response = await axios.post(
                    `http://localhost:3500/api/predictions/${codigo}/transit`,
                    { units: Number(transitUnits) }
                );
    
                if (response.data.success) {
                    setSuccess(true);
                    setTransitUnits('');
                    
                    const updatedResponse = await axios.get<PredictionData>(`http://localhost:3500/api/predictions/${codigo}`);
                    setSelectedPrediction(updatedResponse.data);
                    
                    setAllPredictions(prev => prev.map(item => 
                        item.CODIGO === codigo ? updatedResponse.data.data : item
                    ));
                } else {
                    throw new Error(response.data.error || 'Error al agregar unidades');
                }
            } catch (err: any) {
                console.error('Error:', err);
                setError(err.response?.data?.error || err.message || 'Error al agregar unidades');
            } finally {
                setLoading(false);
            }
        };
    
        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleAddTransitUnits();
            }
        };
    
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    <FaTruck className="text-blue-600" />
                    Gestión de Unidades en Tránsito
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                        <div className="text-xs text-blue-600 mb-1">Unidades en Tránsito Actuales</div>
                        <div className="text-xl font-bold text-blue-800">
                            {selectedPrediction?.data.UNIDADES_TRANSITO_DISPONIBLES || 0} unidades
                        </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <label htmlFor="transit-units-input" className="block text-xs text-blue-600 mb-1">Agregar Unidades en Tránsito</label>
                        <input
                            id="transit-units-input"
                            ref={inputRef}
                            type="number"
                            min="1"
                            value={transitUnits}
                            onChange={(e) => {
                                const value = e.target.value;
                                setTransitUnits(value === '' ? '' : Number(value));
                                setError(null);
                            }}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" 
                            placeholder="Cantidad de unidades"
                            disabled={loading}
                        />
                    </div>
                    
                    <div className="flex items-end">
                        <button
                            onClick={handleAddTransitUnits}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors"
                        >
                            {loading ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    <FaPlus className="w-4 h-4" />
                                    Agregar
                                </>
                            )}
                        </button>
                    </div>
                </div>
                
                {error && (
                    <div className="mt-2 text-red-500 text-sm flex items-center gap-1">
                        <FaExclamationTriangle />
                        {error}
                    </div>
                )}
                
                {success && (
                    <div className="mt-2 text-green-600 text-sm flex items-center gap-1">
                        <FiCheckCircle />
                        Unidades agregadas correctamente
                    </div>
                )}
            </div>
        );
    };

    const Sidebar = () => (
        <div className={`fixed inset-y-0 left-0 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-in-out z-40 w-64`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                    <GiReceiveMoney className="text-blue-600 text-2xl" />
                    <span className="text-xl font-bold text-gray-800">Inventario EPN</span>
                </div>
                <button 
                    onClick={() => setSidebarOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                >
                    <FaChevronLeft className="w-4 h-4" />
                </button>
            </div>
            
            <nav className="p-4">
                <div className="space-y-1">
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg bg-blue-50 text-blue-700">
                        <FaHome className="text-blue-600" />
                        <span>Dashboard</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 hover:bg-gray-100">
                        <FaWarehouse className="text-gray-600" />
                        <span>Inventario</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 hover:bg-gray-100">
                        <FaClipboardList className="text-gray-600" />
                        <span>Órdenes</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 hover:bg-gray-100">
                        <FaChartBar className="text-gray-600" />
                        <span>Reportes</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 hover:bg-gray-100">
                        <FaUser className="text-gray-600" />
                        <span>Usuarios</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 hover:bg-gray-100">
                        <FaCog className="text-gray-600" />
                        <span>Configuración</span>
                    </a>
                </div>
                
                <div className="mt-8 pt-4 border-t border-gray-200">
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 hover:bg-gray-100">
                        <FaSignOutAlt className="text-gray-600" />
                        <span>Cerrar Sesión</span>
                    </a>
                </div>
            </nav>
        </div>
    );

    const DetailModal = ({ onClose, selectedPrediction, refreshPredictions }: DetailModalProps) => {
        if (!selectedPrediction) return null;
        
        const producto = selectedPrediction.data;
        const stockActual = producto.STOCK_TOTAL;
        const stockSeguridad = producto.STOCK_SEGURIDAD;
        const puntoReorden = producto.PUNTO_REORDEN;
        const status = getStockStatus(stockActual, stockSeguridad, puntoReorden);
        const diasCobertura = calculateDaysOfCoverage(stockActual, producto.CONSUMO_DIARIO);
        const consumoPromedio = producto.CONSUMO_PROMEDIO;
        const porcentajeSS = Math.round(stockSeguridad / consumoPromedio * 100);
        const fechaReposicion = calcularFechaReposicion(diasCobertura);
        const frecuenciaReposicion = Math.round(producto.UNIDADES_POR_CAJA * producto.CAJAS_A_PEDIR / producto.CONSUMO_DIARIO);
        
        const statusClass = {
            danger: 'bg-red-50 border-red-200',
            warning: 'bg-amber-50 border-amber-200',
            safe: 'bg-emerald-50 border-emerald-200'
        }[status];

        const statusColor = {
            danger: 'text-red-700',
            warning: 'text-amber-700',
            safe: 'text-emerald-700'
        }[status];

        const handleClose = async () => {
            await refreshPredictions();
            onClose();
        };    

        return (
            <div className="fixed inset-0 bg-slate-500/30 backdrop-blur-sm flex items-start py-10 justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white rounded-xl p-6 w-full max-w-6xl shadow-2xl border border-slate-200 my-8" ref={chartRef}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <FaCube className="text-sky-600" />
                                {producto.CODIGO} - {producto.DESCRIPCION}
                            </h3>
                            <button
                                onClick={handleDownloadPDF}
                                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center gap-2 text-sm shadow-sm"
                            >
                                <FaPrint className="w-4 h-4" />
                                Exportar PDF
                            </button>
                        </div>
                        <button
                            onClick={() => setSelectedPrediction(null)}
                            className="text-slate-500 hover:text-slate-700 text-lg p-1 rounded-full hover:bg-slate-100"
                        >
                            <FaTimes className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex gap-2 mb-6 border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`px-4 py-2 rounded-t-lg flex items-center gap-2 ${
                                activeTab === 'general' 
                                ? 'bg-sky-100 text-sky-700 border-b-2 border-sky-500' 
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <FaInfoCircle />
                            Información General
                        </button>
                        <button
                            onClick={() => setActiveTab('grafico')}
                            className={`px-4 py-2 rounded-t-lg flex items-center gap-2 ${
                                activeTab === 'grafico' 
                                ? 'bg-sky-100 text-sky-700 border-b-2 border-sky-500' 
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <FaChartLine />
                            Gráfico Interactivo
                        </button>
                        <button
                            onClick={() => setActiveTab('historico')}
                            className={`px-4 py-2 rounded-t-lg flex items-center gap-2 ${
                                activeTab === 'historico' 
                                ? 'bg-sky-100 text-sky-700 border-b-2 border-sky-500' 
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <FaHistory />
                            Histórico de Consumos
                        </button>
                    </div>

                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div className={`p-4 rounded-lg border ${statusClass} shadow-sm`}>
                                <div className="flex items-center gap-3 mb-2">
                                    {renderStatusIcon(status)}
                                    <div>
                                        <div className="text-sm font-semibold text-slate-700">
                                            Estado Actual del Stock
                                        </div>
                                        <div className={`text-xs ${statusColor}`}>
                                            {renderStatusMessage(status)}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    <div>
                                        <div className="text-xs text-slate-600">Stock Total</div>
                                        <div className="text-lg font-bold text-slate-800">
                                            {formatNumber(stockActual)} unidades
                                        </div>
                                        <div className="text-xs text-slate-500 flex flex-col">
                                            <span>Físico: {formatNumber(producto.STOCK_FISICO)}</span>
                                            {producto.UNIDADES_TRANSITO_DISPONIBLES > 0 && (
                                                <span className="text-blue-600">Tránsito: {formatNumber(producto.UNIDADES_TRANSITO_DISPONIBLES)}</span>
                                            )}
                                            <span>{diasCobertura} días de cobertura</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-600">Stock de Seguridad</div>
                                        <div className="text-lg font-bold text-slate-800">
                                            {formatNumber(stockSeguridad)} unidades
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {porcentajeSS}% del consumo mensual
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-600">Punto de Reorden</div>
                                        <div className="text-lg font-bold text-slate-800">
                                            {formatNumber(puntoReorden)} unidades
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            44 días de consumo
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <TransitUnitsControl codigo={producto.CODIGO} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Umbrales Clave</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-xs text-gray-500">Consumo Diario (DIARIO)</div>
                                            <div className="text-lg font-bold text-gray-800">
                                                {formatNumber(producto.CONSUMO_DIARIO, 2)} unidades/día
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Stock de Seguridad (SS)</div>
                                            <div className="text-lg font-bold text-gray-800">
                                                {formatNumber(stockSeguridad)} unidades
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {porcentajeSS}% del consumo mensual
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Stock Mínimo (Prom + SS)</div>
                                            <div className="text-lg font-bold text-gray-800">
                                                {formatNumber(producto.STOCK_MINIMO)} unidades
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Pedido Sugerido</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-xs text-gray-500">Déficit Actual</div>
                                            <div className="text-lg font-bold text-gray-800">
                                                {formatNumber(producto.DEFICIT)} unidades
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Cajas Necesarias</div>
                                            <div className="text-lg font-bold text-gray-800">
                                                {formatNumber(producto.CAJAS_A_PEDIR, 1)} cajas
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Cajas a Pedir (redondeo)</div>
                                            <div className="text-lg font-bold text-blue-600">
                                                {producto.CAJAS_A_PEDIR} cajas
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Unidades a Pedir</div>
                                            <div className="text-lg font-bold text-blue-600">
                                                {producto.UNIDADES_A_PEDIR} unidades
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-sky-50 rounded-lg border border-sky-100 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-semibold text-sky-700 mb-2">Unidades por Caja</div>
                                            <div className="text-2xl font-bold text-slate-800">
                                                {formatNumber(producto.UNIDADES_POR_CAJA)} unidades
                                            </div>
                                        </div>
                                        <FaCube className="text-sky-600 text-2xl" />
                                    </div>
                                </div>

                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-semibold text-purple-700 mb-2">Consumo Promedio</div>
                                            <div className="text-2xl font-bold text-slate-800">
                                                {formatNumber(producto.CONSUMO_PROMEDIO)} unidades/mes
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {formatNumber(producto.CONSUMO_DIARIO, 2)} unidades/día
                                            </div>
                                        </div>
                                        <FaCalendarAlt className="text-purple-600 text-2xl" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                                <h4 className="text-lg font-semibold p-4 border-b border-slate-200 text-slate-700">
                                    Proyección Mensual Detallada
                                </h4>
                                <div className="p-4 overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr>
                                                <th className="text-left text-sm text-slate-600">Mes</th>
                                                <th className="text-center text-sm text-slate-600">Stock Proyectado</th>
                                                <th className="text-center text-sm text-slate-600">Stock Seguridad</th>
                                                <th className="text-center text-sm text-slate-600">Punto Reorden</th>
                                                <th className="text-center text-sm text-slate-600">Consumo Previsto</th>
                                                <th className="text-center text-sm text-slate-600">Cajas a Pedir</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedPrediction.data.PROYECCIONES.map((proyeccion, index) => (
                                                <tr key={index} className="border-t border-slate-100">
                                                    <td className="py-2 text-sm text-slate-800">{formatMes(proyeccion.mes)}</td>
                                                    <td className="py-2 text-center text-sm text-slate-800">
                                                        {formatNumber(proyeccion.stock_proyectado)} unidades
                                                    </td>
                                                    <td className="py-2 text-center text-sm text-slate-800">
                                                        {formatNumber(proyeccion.stock_minimo - proyeccion.consumo_mensual)} unidades
                                                    </td>
                                                    <td className="py-2 text-center text-sm text-slate-800">
                                                        {formatNumber(proyeccion.punto_reorden)} unidades
                                                    </td>
                                                    <td className="py-2 text-center text-sm text-slate-800">
                                                        {formatNumber(proyeccion.consumo_mensual)} unidades
                                                    </td>
                                                    <td className="py-2 text-center text-sm text-slate-800">
                                                        {proyeccion.cajas_a_pedir > 0 ? (
                                                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
                                                                {proyeccion.cajas_a_pedir} cajas
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {selectedPrediction.data.PROYECCIONES.some(p => p.alerta_stock) && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3 text-red-700">
                                        <FiAlertTriangle className="flex-shrink-0" />
                                        <h4 className="font-semibold">Alertas Activas</h4>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedPrediction.data.PROYECCIONES
                                            .filter(p => p.alerta_stock)
                                            .map((proyeccion, index) => {
                                                const diasCoberturaProy = calculateDaysOfCoverage(
                                                    proyeccion.stock_proyectado, 
                                                    producto.CONSUMO_DIARIO
                                                );
                                                
                                                return (
                                                    <div key={index} className="flex items-center gap-3 p-2 bg-white rounded border border-red-100">
                                                        <div className="text-red-500">
                                                            <FiAlertTriangle />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-slate-800">
                                                                {formatMes(proyeccion.mes)}
                                                            </div>
                                                            <div className="text-xs text-slate-600">
                                                                Stock proyectado: {formatNumber(proyeccion.stock_proyectado)} unidades
                                                            </div>
                                                            <div className="text-xs text-slate-600">
                                                                Mínimo requerido: {formatNumber(proyeccion.punto_reorden)} unidades
                                                            </div>
                                                            <div className="text-xs text-slate-600">
                                                                Cobertura: {diasCoberturaProy} días
                                                            </div>
                                                        </div>
                                                        <div className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
                                                            Pedir {proyeccion.cajas_a_pedir} cajas
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 shadow-sm">
                                <h4 className="text-sm font-semibold text-sky-700 mb-3 flex items-center gap-2">
                                    <FaCalculator />
                                    Cálculo Detallado de Cajas a Pedir
                                </h4>
                                <div className="text-sm text-slate-700 space-y-2">
                                    <p>
                                        <span className="font-medium">1. Déficit actual:</span> {formatNumber(producto.DEFICIT)} unidades
                                    </p>
                                    <p>
                                        <span className="font-medium">2. Unidades por caja:</span> {formatNumber(producto.UNIDADES_POR_CAJA)} unidades/caja
                                    </p>
                                    <p>
                                        <span className="font-medium">3. Cajas requeridas:</span> {formatNumber(producto.DEFICIT)} / {formatNumber(producto.UNIDADES_POR_CAJA)} = {formatNumber(producto.CAJAS_A_PEDIR, 2)} cajas
                                    </p>
                                    <p>
                                        <span className="font-medium">4. Redondeo:</span> {formatNumber(producto.CAJAS_A_PEDIR, 2)} → {producto.CAJAS_A_PEDIR} cajas
                                    </p>
                                    <p className="font-medium">
                                        Total a pedir: {producto.CAJAS_A_PEDIR} cajas ({producto.UNIDADES_A_PEDIR} unidades)
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'grafico' && <InventoryChart />}

                    {activeTab === 'historico' && (
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                            <h4 className="text-lg font-semibold p-4 border-b border-slate-200 text-slate-700 flex items-center gap-2">
                                <FaHistory className="text-sky-600" />
                                Histórico de Consumos Mensuales
                            </h4>
                            <div className="p-4 overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th className="text-left text-sm text-slate-600 font-medium">Mes</th>
                                            <th className="text-right text-sm text-slate-600 font-medium">Consumo (unidades)</th>
                                            <th className="text-right text-sm text-slate-600 font-medium">Variación</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(producto.HISTORICO_CONSUMOS || {})
                                            .sort(([mesA], [mesB]) => {
                                                const [monthA, yearA] = mesA.split('-').map(Number);
                                                const [monthB, yearB] = mesB.split('-').map(Number);
                                                return new Date(yearB, monthB - 1).getTime() - new Date(yearA, monthA - 1).getTime();
                                            })
                                            .map(([mes, valor], index, array) => {
                                                const prevValue = index < array.length - 1 ? array[index + 1][1] : null;
                                                const variation = prevValue !== null ? ((valor - prevValue) / prevValue) * 100 : null;
                                                
                                                return (
                                                    <tr key={mes} className="border-t border-slate-100">
                                                        <td className="py-2 text-sm text-slate-800">{formatMes(mes)}</td>
                                                        <td className="py-2 text-right text-sm text-slate-800">
                                                            {formatNumber(valor)}
                                                        </td>
                                                        <td className="py-2 text-right text-sm text-slate-800">
                                                            {variation !== null ? (
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                    variation > 0 ? 'bg-green-100 text-green-800' : 
                                                                    variation < 0 ? 'bg-red-100 text-red-800' : 
                                                                    'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                    {variation > 0 ? '+' : ''}{formatNumber(variation, 1)}%
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t border-slate-200 text-sm text-slate-600">
                                <p className="font-medium">Consumo promedio: {formatNumber(producto.CONSUMO_PROMEDIO)} unidades/mes</p>
                                <p>Stock de seguridad: {formatNumber(producto.STOCK_SEGURIDAD)} unidades</p>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 mt-4 border-t border-slate-200">
                        <button
                            onClick={handleClose}
                            className="w-full px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium shadow-sm"
                        >
                            <FaTimes className="w-4 h-4" />
                            Cerrar Detalles
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render principal
    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            
            <div className={`flex-1 flex flex-col overflow-hidden ${sidebarOpen ? 'ml-64' : 'ml-0'} transition-all duration-200`}>
                {!sidebarOpen && (
                    <button 
                        onClick={() => setSidebarOpen(true)}
                        className="fixed left-0 top-4 z-30 p-2 bg-white rounded-r-lg shadow-md text-gray-600 hover:text-gray-900"
                    >
                        <FaChevronRight className="w-4 h-4" />
                    </button>
                )}
                
                <main className="flex-1 overflow-y-auto p-6">
                    {!excelSubido || allPredictions.length === 0 ? (
                        <FileUploader />
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                        <GiReceiveMoney className="text-sky-600 w-8 h-8" />
                                        <span className="bg-gradient-to-r from-sky-600 to-blue-500 bg-clip-text text-transparent">
                                            Análisis de Inventario
                                        </span>
                                    </h1>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Gestión inteligente de stock y proyecciones de inventario
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setAllPredictions([]);
                                        setExcelSubido(false);
                                    }}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg flex items-center gap-2 shadow-sm"
                                >
                                    <FaFileUpload />
                                    Cargar Nuevo Archivo
                                </button>
                            </div>

                            {error && (
                                <div className="mb-4 p-4 bg-rose-100 text-rose-700 rounded-lg flex items-center gap-2 shadow-sm">
                                    <FiAlertTriangle className="flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            {selectedPrediction && <DetailModal 
                                onClose={handleCloseModal}
                                selectedPrediction={selectedPrediction}
                                refreshPredictions={refreshPredictions}
                            />}

                            <div className="bg-white rounded-xl shadow-lg border border-slate-200">
                                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                    <h2 className="text-xl font-semibold text-slate-700 flex items-center gap-2">
                                        <FaBoxOpen className="text-sky-600" />
                                        Productos Analizados ({allPredictions.length})
                                        <span className="text-sm font-normal text-slate-500 ml-2">
                                            Archivo: {currentExcel}
                                        </span>
                                    </h2>
                                    <PaginationControls />
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-sm text-slate-600 font-medium">Código</th>
                                                <th className="px-4 py-3 text-left text-sm text-slate-600 font-medium">Descripción</th>
                                                <th className="px-4 py-3 text-center text-sm text-slate-600 font-medium">Unidad/Caja</th>
                                                <th className="px-4 py-3 text-center text-sm text-slate-600 font-medium">Stock Total</th>
                                                <th className="px-4 py-3 text-center text-sm text-slate-600 font-medium">Cons. Prom.</th>
                                                <th className="px-4 py-3 text-center text-sm text-slate-600 font-medium">Pto. Reorden</th>
                                                <th className="px-4 py-3 text-center text-sm text-slate-600 font-medium">A Pedir</th>
                                                <th className="px-4 py-3 text-center text-sm text-slate-600 font-medium">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentPredictions.map((producto) => {
                                                const stockTotal = producto.STOCK_FISICO + (producto.UNIDADES_TRANSITO_DISPONIBLES || 0);
                                                const status = getStockStatus(
                                                    stockTotal,
                                                    producto.STOCK_SEGURIDAD,
                                                    producto.PUNTO_REORDEN
                                                );
                                                const diasCobertura = calculateDaysOfCoverage(
                                                    stockTotal, 
                                                    producto.CONSUMO_DIARIO
                                                );
                                                
                                                return (
                                                    <tr key={producto.CODIGO} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-slate-800">
                                                            {producto.CODIGO}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                                                            {producto.DESCRIPCION}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full text-sm inline-flex items-center gap-1 shadow-sm">
                                                                <FaCube className="w-3.5 h-3.5" />
                                                                {formatNumber(producto.UNIDADES_POR_CAJA)} unid.
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                                    status === 'danger' ? 'bg-red-100 text-red-700' :
                                                                    status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-emerald-100 text-emerald-700'
                                                                } shadow-sm`}>
                                                                    {formatNumber(stockTotal)} unid.
                                                                </span>
                                                                <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                                                    <span className="flex items-center">
                                                                        <FaBox className="mr-1" /> 
                                                                        {formatNumber(producto.STOCK_FISICO)}
                                                                    </span>
                                                                    {producto.UNIDADES_TRANSITO_DISPONIBLES > 0 && (
                                                                        <span className="flex items-center text-blue-600">
                                                                            <FaTruck className="mr-1" />
                                                                            +{formatNumber(producto.UNIDADES_TRANSITO_DISPONIBLES)}
                                                                        </span>
                                                                    )}
                                                                    <span>| {diasCobertura} días</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                                                            {formatNumber(producto.CONSUMO_PROMEDIO)}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs shadow-sm">
                                                                    {formatNumber(producto.PUNTO_REORDEN)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {producto.CAJAS_A_PEDIR > 0 ? (
                                                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium shadow-sm">
                                                                    {producto.CAJAS_A_PEDIR} cajas
                                                                </span>
                                                            ) : (
                                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs shadow-sm">
                                                                    OK
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={() => handlePredict(producto.CODIGO)}
                                                                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
                                                                disabled={loading}
                                                            >
                                                                {loading && selectedPrediction?.data.CODIGO === producto.CODIGO ? (
                                                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                                                ) : (
                                                                    <FiAlertTriangle className="w-4 h-4" />
                                                                )}
                                                                Ver Análisis
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Dashboard;