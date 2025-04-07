"use client";

import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
    FaChevronLeft, FaChevronRight, FaInfoCircle, FaBoxOpen, FaTimes, FaCube,
    FaFileExcel, FaUpload, FaPrint, FaChartLine, FaHistory, FaCalculator,
    FaCalendarAlt, FaExclamationTriangle, FaTruck, FaPlus, FaBox, FaCheckCircle,
    FaFileUpload, FaHome, FaWarehouse, FaClipboardList, FaChartBar, FaCog,
    FaUser, FaSignOutAlt, FaFileAlt, FaChartPie, FaExchangeAlt,
    FaShieldAlt,
    FaTable,
    FaFileExport
} from 'react-icons/fa';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { GiReceiveMoney } from 'react-icons/gi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'framer-motion';

declare module 'jspdf' {
    interface jsPDF {
        lastAutoTable?: {
            finalY: number;
            // Puedes añadir otras propiedades que uses de lastAutoTable si es necesario
        };
    }
}

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

        const pdf = new jsPDF('p', 'mm', 'a4') as jsPDF & { lastAutoTable?: { finalY: number } };

        // Configuración de márgenes y espacios
        const margin = {
            left: 15,
            right: 15,
            top: 20,
            bottom: 20
        };
        const pageWidth = 210; // Ancho A4 en mm
        const contentWidth = pageWidth - margin.left - margin.right;
        let currentY = margin.top;

        // Configuración de fuentes y colores
        pdf.setFont('helvetica');
        const primaryColor: [number, number, number] = [45, 207, 245];
        const darkColor: [number, number, number] = [13, 27, 42];

        // --- ENCABEZADO CON LOGO ---
        try {
            const logoData = await getBase64ImageFromURL('/kpitalink_logistics_cover.jpeg') as string;

            // Dimensiones y posición del logo
            const logoWidth = 50;
            const logoHeight = 15; // Reducido para mejor ajuste
            const logoX = margin.left;
            const logoY = margin.top;

            pdf.addImage(logoData, 'JPEG', logoX, logoY, logoWidth, logoHeight);

            // Título principal (alineado a la derecha del logo)
            pdf.setFontSize(14); // Tamaño reducido para mejor ajuste
            pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            pdf.text('INFORME DE GESTIÓN DE INVENTARIOS', logoX + logoWidth + 10, logoY + logoHeight / 2 + 2, { align: 'left' });

            // Línea decorativa con color primario
            pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            pdf.setLineWidth(0.5); // Grosor reducido
            currentY = logoY + logoHeight + 5;
            pdf.line(margin.left, currentY, pageWidth - margin.right, currentY);

            currentY += 10;

            // --- INFORMACIÓN DEL PRODUCTO ---
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);

            // Dividir la descripción si es muy larga
            const descripcion = pdf.splitTextToSize(selectedPrediction.data.DESCRIPCION, contentWidth - 40);

            pdf.text(`Código: ${selectedPrediction.data.CODIGO}`, margin.left, currentY);
            pdf.text(`Producto:`, margin.left, currentY + 6);
            pdf.text(descripcion, margin.left + 20, currentY + 6);

            pdf.text(`Generado el: ${new Date().toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}`, pageWidth - margin.right, currentY, { align: 'right' });

            currentY += 6 + (descripcion.length * 5); // Ajuste dinámico según longitud de descripción

            // Función para agregar nueva página si es necesario
            const checkPageBreak = (requiredSpace: number) => {
                if (currentY + requiredSpace > 297 - margin.bottom) { // 297mm es altura A4
                    pdf.addPage();
                    currentY = margin.top;

                    // Opcional: agregar encabezado en páginas siguientes
                    pdf.setFontSize(10);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text(`Continuación informe: ${selectedPrediction.data.CODIGO}`, margin.left, currentY);
                    currentY += 10;
                }
            };

            // --- RESUMEN EJECUTIVO ---
            checkPageBreak(30);
            pdf.setFontSize(12); // Tamaño reducido para mejor jerarquía
            pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            pdf.text('1. RESUMEN EJECUTIVO', margin.left, currentY);

            // Badge de estado
            const status = getStockStatus(
                selectedPrediction.data.STOCK_TOTAL,
                selectedPrediction.data.STOCK_SEGURIDAD,
                selectedPrediction.data.PUNTO_REORDEN
            );

            let statusMessage = '';
            let statusColor: [number, number, number] = primaryColor;

            if (status === 'danger') {
                statusMessage = 'NIVEL CRÍTICO - ACCIÓN REQUERIDA';
                statusColor = [220, 53, 69];
            } else if (status === 'warning') {
                statusMessage = 'NIVEL BAJO - MONITOREAR';
                statusColor = [255, 193, 7];
            } else {
                statusMessage = 'NIVEL ÓPTIMO';
                statusColor = [40, 167, 69];
            }

            pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
            pdf.roundedRect(margin.left, currentY + 5, 50, 6, 3, 3, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9); // Tamaño reducido
            pdf.text(statusMessage, margin.left + 3, currentY + 9);

            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            currentY += 20;

            // --- DATOS CLAVE EN TABLA ---
            checkPageBreak(100);
            const porcentajeSS = Math.round(selectedPrediction.data.STOCK_SEGURIDAD / selectedPrediction.data.CONSUMO_PROMEDIO * 100);

            autoTable(pdf, {
                startY: currentY,
                head: [['Indicador', 'Valor']],
                body: [
                    ['Consumo Diario', `${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} unidades/día`],
                    ['Stock Seguridad', `${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} unidades`],
                    ['Punto Reorden', `${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)} unidades`],
                    ['Stock Actual', `${selectedPrediction.data.STOCK_TOTAL.toFixed(0)} unidades`],
                    ['Días Cobertura', `${selectedPrediction.data.DIAS_COBERTURA} días`],
                    ['Déficit Actual', `${selectedPrediction.data.DEFICIT.toFixed(0)} unidades`],
                    ['Recomendación', `${selectedPrediction.data.CAJAS_A_PEDIR} cajas (${selectedPrediction.data.UNIDADES_A_PEDIR} unidades)`]
                ],
                headStyles: {
                    fillColor: darkColor,
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    textColor: 50,
                    fontSize: 9 // Tamaño reducido
                },
                alternateRowStyles: {
                    fillColor: [240, 240, 240]
                },
                margin: { left: margin.left, right: margin.right },
                styles: {
                    cellPadding: 3, // Padding reducido
                    fontSize: 9,
                    valign: 'middle',
                    lineColor: [200, 200, 200],
                    overflow: 'linebreak'
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 60, textColor: darkColor },
                    1: { cellWidth: 'auto', halign: 'right' }
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            });

            // --- ANÁLISIS DETALLADO ---
            currentY = (pdf.lastAutoTable?.finalY || currentY) + 10;
            checkPageBreak(50);
            pdf.setFontSize(12);
            pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            pdf.text('2. ANÁLISIS DETALLADO', margin.left, currentY);

            pdf.setFontSize(9); // Tamaño reducido para mejor ajuste
            pdf.setTextColor(0, 0, 0);
            currentY += 8;

            const analysisText = [
                `El análisis muestra que el producto ${selectedPrediction.data.CODIGO} tiene un consumo promedio de ${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)} unidades mensuales, equivalente a ${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} unidades por día.`,
                `El stock de seguridad está calculado en ${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} unidades (${porcentajeSS}% del consumo mensual), proporcionando un colchón para fluctuaciones en la demanda.`
            ];

            analysisText.forEach(text => {
                const splitText = pdf.splitTextToSize(text, contentWidth);
                splitText.forEach((line: string | string[]) => {
                    checkPageBreak(5);
                    pdf.text(line, margin.left, currentY);
                    currentY += 5;
                });
            });

            // Fórmulas destacadas
            checkPageBreak(20);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            pdf.text('Cálculos Clave:', margin.left, currentY);

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);
            currentY += 8;

            const formulas = [
                `• Stock Mínimo = Consumo Mensual + Stock Seguridad`,
                `  ${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)} + ${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} = ${selectedPrediction.data.STOCK_MINIMO.toFixed(0)} unidades`,
                `• Punto de Reorden = Consumo Diario × 44 días`,
                `  ${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} × 44 = ${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)} unidades`
            ];

            formulas.forEach(formula => {
                checkPageBreak(5);
                pdf.text(formula, margin.left + (formula.startsWith('•') ? 0 : 10), currentY);
                currentY += 5;
            });

            // --- RECOMENDACIONES ---
            checkPageBreak(30);
            pdf.setFontSize(12);
            pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            pdf.text('3. RECOMENDACIONES', margin.left, currentY);

            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            currentY += 8;

            const recommendations = [
                `Ordenar ${selectedPrediction.data.CAJAS_A_PEDIR} cajas (${selectedPrediction.data.UNIDADES_A_PEDIR} unidades) lo antes posible`,
                `Fecha sugerida de pedido: ${new Date().toLocaleDateString()}`,
                `Fecha estimada de reposición: ${selectedPrediction.data.FECHA_REPOSICION}`,
                `Justificación: Stock actual (${selectedPrediction.data.STOCK_TOTAL.toFixed(0)}u) bajo punto de reorden (${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)}u)`,
                `Tiempo de cobertura actual: ${selectedPrediction.data.DIAS_COBERTURA} días`,
                `Frecuencia sugerida de reposición: Cada ${selectedPrediction.data.PROYECCIONES[0]?.frecuencia_reposicion || 30} días`
            ];

            recommendations.forEach(rec => {
                checkPageBreak(5);
                pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                pdf.circle(margin.left + 3, currentY - 1, 1.2, 'F');
                pdf.text(` ${rec}`, margin.left + 7, currentY);
                currentY += 5;
            });

            // --- PROYECCIÓN MENSUAL ---
            checkPageBreak(30);
            currentY += 5;
            pdf.setFontSize(12);
            pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            pdf.text('4. PROYECCIÓN MENSUAL', margin.left, currentY);

            const proyeccionData = selectedPrediction.data.PROYECCIONES.map(proyeccion => {
                return [
                    proyeccion.mes,
                    proyeccion.stock_proyectado.toFixed(0),
                    proyeccion.stock_seguridad.toFixed(0),
                    proyeccion.punto_reorden.toFixed(0),
                    proyeccion.cajas_a_pedir > 0 ? proyeccion.cajas_a_pedir : '-',
                    proyeccion.fecha_reposicion,
                    proyeccion.alerta_stock ? 'ALERTA' : 'OK'
                ];
            });

            autoTable(pdf, {
                startY: currentY + 5,
                head: [['Mes', 'Stock', 'Seguridad', 'Reorden', 'Pedir', 'Fecha Rep.', 'Estado']],
                body: proyeccionData,
                headStyles: {
                    fillColor: darkColor,
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center',
                    fontSize: 8
                },
                bodyStyles: {
                    textColor: 50,
                    halign: 'center',
                    fontSize: 8
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245]
                },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'left' },
                    1: { cellWidth: 15 },
                    2: { cellWidth: 15 },
                    3: { cellWidth: 15 },
                    4: { cellWidth: 12 },
                    5: { cellWidth: 25, halign: 'left' },
                    6: { cellWidth: 15 }
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    overflow: 'linebreak',
                    lineColor: [200, 200, 200]
                },
                didDrawCell: (data) => {
                    if (data.column.index === 6 && data.cell.raw === 'ALERTA') {
                        pdf.setTextColor(220, 53, 69);
                    }
                }
            });

            // --- PIE DE PÁGINA ---
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text('Documento confidencial - Kpitalink Inventory Management System', margin.left, 290);
            pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            pdf.text('www.kpitalink.com', pageWidth - margin.right, 290, { align: 'right' });

            // Guardar PDF
            const fileName = `KPI-Inventory-${selectedPrediction.data.CODIGO}-${new Date().toISOString().slice(0, 10)}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            // Mostrar notificación al usuario si es necesario
        }
    };

    // Función auxiliar para cargar el logo (debes implementarla según tu entorno)
    async function getBase64ImageFromURL(url: string | URL | Request) {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

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

    const generateVariationChartData = (historicos: Record<string, number>) => {
        const sortedEntries = Object.entries(historicos).sort(([mesA], [mesB]) => {
            const [monthA, yearA] = mesA.split('-').map(Number);
            const [monthB, yearB] = mesB.split('-').map(Number);
            return new Date(yearA, monthA - 1).getTime() - new Date(yearB, monthB - 1).getTime();
        });

        return sortedEntries.map(([mes, valor], index, array) => {
            const prevValue = index > 0 ? array[index - 1][1] : null;
            const variation = prevValue !== null ? ((valor - prevValue) / prevValue) * 100 : null;

            return {
                mes: formatMes(mes),
                consumo: valor,
                variacion: variation,
                color: variation !== null
                    ? variation > 0
                        ? '#10B981' // verde
                        : '#EF4444' // rojo
                    : '#6B7280' // gris
            };
        });
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
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-10 border border-gray-100">
            {/* Encabezado */}
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-[#0d1b2a] mb-3">
                    Bienvenido a nuestro <span className="text-[#2dcff5]">Sistema de Inventario</span>
                </h1>
                <p className="text-lg text-gray-600">
                    Sube tu archivo Excel para comenzar el análisis predictivo
                </p>
            </div>

            {/* Sección de requisitos */}
            <div className="mb-10 p-8 bg-gradient-to-br from-[#f0f9ff] to-white rounded-xl border border-[#2dcff5]/20 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-[#2dcff5]/10 rounded-full">
                        <FaInfoCircle className="text-xl text-[#1b9aaa]" />
                    </div>
                    <h2 className="text-2xl font-semibold text-[#0d1b2a]">
                        Requisitos del Archivo Excel
                    </h2>
                </div>

                <ul className="space-y-3 pl-2">
                    {[
                        { field: "CODIGO", desc: "Identificador único del producto (texto)" },
                        { field: "DESCRIPCION", desc: "Nombre o descripción del producto (texto)" },
                        { field: "UNIDADES_POR_CAJA", desc: "Cantidad de unidades por caja (número)" },
                        { field: "STOCK_TOTAL", desc: "Cantidad total en inventario (número)" },
                        { field: "HISTORICO_CONSUMOS", desc: 'Consumos mensuales en formato { "MES-AÑO": cantidad }' }
                    ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3">
                            <span className="inline-block w-2 h-2 mt-2.5 rounded-full bg-[#2dcff5] flex-shrink-0"></span>
                            <span className="text-gray-700">
                                <span className="font-medium text-[#0d1b2a]">{item.field}:</span> {item.desc}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Área de carga de archivos */}
            <motion.div 
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { 
                    opacity: 1, 
                    y: 0,
                    transition: { duration: 0.5 }
                    }
                }}
                className="flex flex-col items-center"
                >
                <div className="w-full max-w-md mb-6">
                    <motion.label 
                    className="block text-sm font-medium text-gray-700 mb-3"
                    whileHover={{ scale: 1.02 }}
                    >
                    Seleccionar archivo Excel:
                    </motion.label>

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
                    <motion.label
                        htmlFor="excel-upload"
                        whileHover={{ 
                        scale: 1.03,
                        boxShadow: "0 10px 25px -5px rgba(45, 207, 245, 0.4)"
                        }}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 px-4 py-3.5 bg-gradient-to-r from-[#2dcff5] to-[#1b9aaa] text-white rounded-xl flex items-center justify-center gap-3 cursor-pointer transition-all shadow-[0_4px_14px_rgba(45,207,245,0.3)]"
                    >
                        <motion.div
                        whileHover={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5 }}
                        >
                        <FaFileExcel className="text-xl" />
                        </motion.div>
                        <span className="font-medium">Seleccionar Excel</span>
                    </motion.label>
                    </div>

                    {selectedFile && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-3 text-sm text-gray-600 flex items-center gap-2 bg-[#f0f9ff] p-3 rounded-lg border border-[#2dcff5]/30"
                    >
                        <FaCheckCircle className="text-[#28a745] text-lg" />
                        <span className="font-medium">{selectedFile.name}</span>
                    </motion.div>
                    )}
                </div>

                {selectedFile && (
                    <motion.button
                    onClick={handleProcessFile}
                    whileHover={{ 
                        scale: 1.03,
                        boxShadow: "0 10px 25px -5px rgba(45, 207, 245, 0.4)"
                    }}
                    whileTap={{ scale: 0.97 }}
                    disabled={processing}
                    className="px-8 py-3.5 bg-gradient-to-r from-[#2dcff5] to-[#1b9aaa] text-white rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_4px_14px_rgba(45,207,245,0.3)]"
                    >
                    {processing ? (
                        <>
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
                        />
                        <span className="font-medium">Procesando...</span>
                        </>
                    ) : (
                        <>
                        <FaUpload className="text-lg" />
                        <span className="font-medium">Analizar Archivo</span>
                        </>
                    )}
                    </motion.button>
                )}
                </motion.div>
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

    const VariationChart = ({ data }: { data: Array<{ mes: string; variacion: number | null }> }) => (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
                <FaChartPie className="text-gray-900" />
                Variación Mensual de Consumos (%)
            </h4>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 20, bottom: 40 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="mes"
                            angle={-45}
                            textAnchor="end"
                            tick={{ fontSize: 12, fill: "#4b5563" }}
                            tickMargin={10}
                            interval={0}
                        />
                        <YAxis
                            tick={{ fill: "#4b5563" }}
                            label={{
                                value: 'Variación (%)',
                                angle: -90,
                                position: 'insideLeft',
                                fill: "#4b5563",
                                style: { fontSize: 12 }
                            }}
                        />
                        <Tooltip
                            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Variación']}
                            labelFormatter={(label) => `Mes: ${label}`}
                            contentStyle={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                color: '#111827'
                            }}
                        />
                        <Bar
                            dataKey="variacion"
                            name="Variación"
                            fill="#8884d8"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={
                                        entry.variacion !== null
                                            ? entry.variacion > 0
                                                ? '#10B981' // verde
                                                : '#EF4444' // rojo
                                            : '#6B7280' // gris
                                    }
                                />
                            ))}
                        </Bar>
                    </BarChart>
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
                        <FaFileAlt className="text-gray-600" />
                        <span>Documentación</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 hover:bg-gray-100">
                        <FaExchangeAlt className="text-gray-600" />
                        <span>Movimientos</span>
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

        const variationData = generateVariationChartData(producto.HISTORICO_CONSUMOS || {});

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
                            className={`px-4 py-2 rounded-t-lg flex items-center gap-2 ${activeTab === 'general'
                                    ? 'bg-sky-100 text-sky-700 border-b-2 border-sky-500'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <FaInfoCircle />
                            Información General
                        </button>
                        <button
                            onClick={() => setActiveTab('grafico')}
                            className={`px-4 py-2 rounded-t-lg flex items-center gap-2 ${activeTab === 'grafico'
                                    ? 'bg-sky-100 text-sky-700 border-b-2 border-sky-500'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <FaChartLine />
                            Gráfico Interactivo
                        </button>
                        <button
                            onClick={() => setActiveTab('historico')}
                            className={`px-4 py-2 rounded-t-lg flex items-center gap-2 ${activeTab === 'historico'
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
                            {/* Estado Actual del Stock */}
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
                                        <div className="text-xs text-slate-600">Stock Mínimo</div>
                                        <div className="text-lg font-bold text-slate-800">
                                            {formatNumber(producto.STOCK_MINIMO)} unidades
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            (Promedio + Seguridad)
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <TransitUnitsControl codigo={producto.CODIGO} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Contenedor de Umbrales Clave - Diseño Profesional */}
                                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3 text-indigo-700">
                                        <FaChartLine className="text-indigo-600" />
                                        <h4 className="text-sm font-semibold">Umbrales Clave</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-50 shadow-xs">
                                            <div className="bg-indigo-100 p-2 rounded-full">
                                                <FaCalendarAlt className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-indigo-500">Consumo Diario</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {formatNumber(producto.CONSUMO_DIARIO, 2)} <span className="text-sm font-normal text-gray-500">unidades/día</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-50 shadow-xs">
                                            <div className="bg-indigo-100 p-2 rounded-full">
                                                <FaChartBar className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-indigo-500">Consumo Mensual</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {formatNumber(producto.CONSUMO_PROMEDIO)} <span className="text-sm font-normal text-gray-500">unidades/mes</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-50 shadow-xs">
                                            <div className="bg-indigo-100 p-2 rounded-full">
                                                <FaExclamationTriangle className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-indigo-500">Punto de Reorden</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {formatNumber(producto.PUNTO_REORDEN)} <span className="text-sm font-normal text-gray-500">unidades</span>
                                                </div>
                                                <div className="text-xs text-indigo-400">(44 días de cobertura)</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-50 shadow-xs">
                                            <div className="bg-indigo-100 p-2 rounded-full">
                                                <FaCube className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-indigo-500">Unidades por Caja</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {formatNumber(producto.UNIDADES_POR_CAJA)} <span className="text-sm font-normal text-gray-500">unidades</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Contenedor de Pedido Sugerido - Diseño Profesional */}
                                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-emerald-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3 text-emerald-800">
                                        <FaTruck className="text-emerald-700" />
                                        <h4 className="text-sm font-semibold">Pedido Sugerido</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                            <div className="bg-red-100 p-2 rounded-full">
                                                <FaExclamationTriangle className="text-red-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-red-500">Déficit Actual</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {formatNumber(producto.DEFICIT)} <span className="text-sm font-normal text-gray-500">unidades</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                            <div className="bg-amber-100 p-2 rounded-full">
                                                <FaBox className="text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-amber-600">Cajas a Pedir</div>
                                                <div className="text-xl font-bold text-gray-800">
                                                    {producto.CAJAS_A_PEDIR} <span className="text-sm font-normal text-gray-500">cajas</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                            <div className="bg-emerald-100 p-2 rounded-full">
                                                <FaBoxOpen className="text-emerald-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-emerald-600">Unidades a Pedir</div>
                                                <div className="text-xl font-bold text-gray-800">
                                                    {producto.UNIDADES_A_PEDIR} <span className="text-sm font-normal text-gray-500">unidades</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                            <div className="bg-blue-100 p-2 rounded-full">
                                                <FaCalendarAlt className="text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-blue-600">Fecha Estimada Reposición</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {producto.FECHA_REPOSICION}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Proyección Mensual */}
                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                                    <h4 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                        <FaChartLine className="text-sky-600" />
                                        Proyección Mensual Detallada
                                    </h4>
                                </div>
                                <div className="p-4 overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="text-left text-sm text-slate-600 font-medium p-3">Mes</th>
                                                <th className="text-center text-sm text-slate-600 font-medium p-3">Stock Proyectado</th>
                                                <th className="text-center text-sm text-slate-600 font-medium p-3">Stock Seguridad</th>
                                                <th className="text-center text-sm text-slate-600 font-medium p-3">Punto Reorden</th>
                                                <th className="text-center text-sm text-slate-600 font-medium p-3">Consumo Previsto</th>
                                                <th className="text-center text-sm text-slate-600 font-medium p-3">Acción Requerida</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedPrediction.data.PROYECCIONES.map((proyeccion, index) => {
                                                const alerta = proyeccion.alerta_stock;
                                                return (
                                                    <tr key={index} className="border-t border-slate-100 hover:bg-slate-50">
                                                        <td className="p-3 text-sm text-slate-800">
                                                            {formatMes(proyeccion.mes)}
                                                        </td>
                                                        <td className="p-3 text-center text-sm text-slate-800">
                                                            {formatNumber(proyeccion.stock_proyectado)} <span className="text-xs text-slate-500">unid.</span>
                                                        </td>
                                                        <td className="p-3 text-center text-sm text-slate-800">
                                                            {formatNumber(proyeccion.stock_seguridad)} <span className="text-xs text-slate-500">unid.</span>
                                                        </td>
                                                        <td className="p-3 text-center text-sm text-slate-800">
                                                            {formatNumber(proyeccion.punto_reorden)} <span className="text-xs text-slate-500">unid.</span>
                                                        </td>
                                                        <td className="p-3 text-center text-sm text-slate-800">
                                                            {formatNumber(proyeccion.consumo_mensual)} <span className="text-xs text-slate-500">unid.</span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {proyeccion.cajas_a_pedir > 0 ? (
                                                                <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-medium">
                                                                    <FiAlertTriangle className="w-3 h-3" />
                                                                    Pedir {proyeccion.cajas_a_pedir} cajas
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                                                                    <FiCheckCircle className="w-3 h-3" />
                                                                    Stock suficiente
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Cálculo Detallado */}
                            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-3 text-sky-700">
                                    <FaCalculator className="text-sky-600" />
                                    <h4 className="text-sm font-semibold">Cálculo Detallado de Cajas a Pedir</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                                        <div className="text-sm text-slate-700 space-y-3">
                                            <div className="flex items-start gap-2">
                                                <span className="bg-sky-100 text-sky-700 rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">1</span>
                                                <div>
                                                    <span className="font-medium">Déficit actual:</span>
                                                    <div className="text-lg font-bold text-slate-800 mt-1">
                                                        {formatNumber(producto.DEFICIT)} <span className="text-sm font-normal text-slate-500">unidades</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="bg-sky-100 text-sky-700 rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">2</span>
                                                <div>
                                                    <span className="font-medium">Unidades por caja:</span>
                                                    <div className="text-lg font-bold text-slate-800 mt-1">
                                                        {formatNumber(producto.UNIDADES_POR_CAJA)} <span className="text-sm font-normal text-slate-500">unidades/caja</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                                        <div className="text-sm text-slate-700 space-y-3">
                                            <div className="flex items-start gap-2">
                                                <span className="bg-sky-100 text-sky-700 rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">3</span>
                                                <div>
                                                    <span className="font-medium">Cajas requeridas:</span>
                                                    <div className="text-lg font-bold text-slate-800 mt-1">
                                                        <span className="text-emerald-600">{producto.CAJAS_A_PEDIR} cajas</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-100 p-2 rounded-full">
                                            <FaTruck className="text-emerald-600" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-emerald-600">Recomendación final</div>
                                            <div className="text-lg font-bold text-emerald-800">
                                                Pedir {producto.CAJAS_A_PEDIR} cajas ({producto.UNIDADES_A_PEDIR} unidades)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'grafico' && <InventoryChart />}

                    {activeTab === 'historico' && (
                        <div className="space-y-6">
                            {/* Tabla Horizontal de Consumos - Versión Profesional */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                                    <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                        <FaTable className="text-blue-600" />
                                        Histórico de Consumos Mensuales
                                    </h4>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Métrica
                                                </th>
                                                {Object.entries(producto.HISTORICO_CONSUMOS || {})
                                                    .sort(([mesA], [mesB]) => {
                                                        const [monthA, yearA] = mesA.split('-').map(Number);
                                                        const [monthB, yearB] = mesB.split('-').map(Number);
                                                        return new Date(yearA, monthA - 1).getTime() - new Date(yearB, monthB - 1).getTime();
                                                    })
                                                    .map(([mes]) => (
                                                        <th key={mes} scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            {formatMes(mes)}
                                                        </th>
                                                    ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {/* Fila de Consumos */}
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-5 w-5 text-blue-500">
                                                            <FaBox />
                                                        </div>
                                                        <div className="ml-2">
                                                            <div className="text-sm font-medium text-gray-900">Consumo</div>
                                                            <div className="text-xs text-gray-500">Unidades</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {Object.entries(producto.HISTORICO_CONSUMOS || {})
                                                    .sort(([mesA], [mesB]) => {
                                                        const [monthA, yearA] = mesA.split('-').map(Number);
                                                        const [monthB, yearB] = mesB.split('-').map(Number);
                                                        return new Date(yearA, monthA - 1).getTime() - new Date(yearB, monthB - 1).getTime();
                                                    })
                                                    .map(([mes, valor]) => (
                                                        <td key={mes} className="px-6 py-4 whitespace-nowrap text-center">
                                                            <div className="text-sm text-gray-900 font-medium">{formatNumber(valor)}</div>
                                                        </td>
                                                    ))}
                                            </tr>

                                            {/* Fila de Variación */}
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-5 w-5 text-purple-500">
                                                            <FaChartLine />
                                                        </div>
                                                        <div className="ml-2">
                                                            <div className="text-sm font-medium text-gray-900">Variación</div>
                                                            <div className="text-xs text-gray-500">vs mes anterior</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {Object.entries(producto.HISTORICO_CONSUMOS || {})
                                                    .sort(([mesA], [mesB]) => {
                                                        const [monthA, yearA] = mesA.split('-').map(Number);
                                                        const [monthB, yearB] = mesB.split('-').map(Number);
                                                        return new Date(yearA, monthA - 1).getTime() - new Date(yearB, monthB - 1).getTime();
                                                    })
                                                    .map(([mes, valor], index, array) => {
                                                        const prevValue = index > 0 ? array[index - 1][1] : null;
                                                        const variation = prevValue !== null ? ((valor - prevValue) / prevValue) * 100 : null;

                                                        return (
                                                            <td key={mes} className="px-6 py-4 whitespace-nowrap text-center">
                                                                {variation !== null ? (
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variation > 10 ? 'bg-green-100 text-green-800' :
                                                                            variation > 0 ? 'bg-blue-100 text-blue-800' :
                                                                                variation < -10 ? 'bg-red-100 text-red-800' :
                                                                                    variation < 0 ? 'bg-amber-100 text-amber-800' :
                                                                                        'bg-gray-100 text-gray-800'
                                                                        }`}>
                                                                        {variation > 0 ? '+' : ''}{formatNumber(variation, 1)}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                        -
                                                                    </span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Leyenda y Notas */}
                                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-3 rounded-full bg-green-100"></span>
                                            <span>Variación {'>'} +10%</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-3 rounded-full bg-blue-100"></span>
                                            <span>Variación positiva</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-3 rounded-full bg-amber-100"></span>
                                            <span>Variación negativa</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-3 rounded-full bg-red-100"></span>
                                            <span>Variación {'<'} -10%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Gráfico de Variación */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                {/* Encabezado compacto */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                                    <h4 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                        <div className="bg-blue-100 p-1.5 rounded-md">
                                            <FaChartLine className="text-blue-600 text-sm" />
                                        </div>
                                        <span>Tendencia de Consumos</span>
                                    </h4>
                                </div>

                                {/* Contenedor del gráfico ajustado */}
                                <div className="flex-1 min-h-0 p-2">  {/* Contenedor flexible sin espacios extra */}
                                    <div className="w-full h-full">  {/* Contenedor del gráfico al 100% */}
                                        <VariationChart
                                            data={variationData}
                                        />
                                    </div>
                                </div>
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
                                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${status === 'danger' ? 'bg-red-100 text-red-700' :
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