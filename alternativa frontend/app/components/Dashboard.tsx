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
    FaFileExport,
    FaSearch,
    FaExclamation,
    FaCheck,
    FaClock,
    FaLightbulb,
    FaLock,
    FaSpinner,
    FaPhone,
    FaTruckLoading,
    FaChevronDown,
    FaBoxes,
    FaFileInvoice,
    FaCalendarCheck
} from 'react-icons/fa';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { GiReceiveMoney } from 'react-icons/gi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, Area, ReferenceLine } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnimatePresence, motion } from 'framer-motion';
import { Chart, LinearScale, CategoryScale, LineController, PointElement, LineElement, Title } from 'chart.js';
import AlertConfig from './AlertConfig';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReportsSection from './ReportsSection';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';
import ProjectionsPagination from './ProjectionsPagination';

Chart.register(LinearScale, CategoryScale, LineController, PointElement, LineElement, Title);
declare module 'jspdf' {
    interface jsPDF {
        lastAutoTable?: {
            finalY: number;
            // Puedes añadir otras propiedades que uses de lastAutoTable si es necesario
        };
    }
}

// Configuración global
const API_URL = 'https://kpital-sistema-inventario-backend-ia.onrender.com/api';

// Interfaces
interface Proyeccion {
    mes: string;
    stock_inicial: number;
    dias_transito: number;
    fecha_inicio_proyeccion: string;
    fecha_fin: string;
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
    fecha_solicitud: string;
    fecha_arribo: string;
    tiempo_cobertura: number;
    frecuencia_reposicion?: number; // Marcado como opcional, no usado en proyecciones
    unidades_en_transito: number;
    pedidos_pendientes: Record<string, number>;
    pedidos_recibidos: number;
    accion_requerida: string;
    stock_total?: number;
    consumo_inicial_transito?: number; // Agregado como opcional
    transitDaysApplied?: boolean;
}

interface ProductoData {
    CODIGO: string;
    DESCRIPCION: string;
    UNIDADES_POR_CAJA: number;
    STOCK_FISICO: number;
    UNIDADES_TRANSITO: number;
    STOCK_TOTAL: number;

    // Consumos
    CONSUMO_PROMEDIO: number;
    CONSUMO_PROYECTADO: number;
    CONSUMO_TOTAL: number;
    CONSUMO_DIARIO: number;
    HISTORICO_CONSUMOS: Record<string, number>;

    // Niveles de stock
    STOCK_SEGURIDAD: number;
    STOCK_MINIMO: number;
    PUNTO_REORDEN: number;

    // Pedidos
    DEFICIT: number;
    CAJAS_A_PEDIR: number;
    UNIDADES_A_PEDIR: number;

    // Tiempos
    FECHA_REPOSICION: string;
    FECHA_ARRIBO_PEDIDO: string; // Nuevo: Fecha estimada de arribo
    DIAS_COBERTURA: number;
    FRECUENCIA_REPOSICION: number;
    DIAS_TRANSITO_ACTUAL: number; // Nuevo: Días de tránsito aplicados
    FECHA_INICIO: string;

    // Alertas
    alerta_stock: boolean;
    ULTIMA_ALERTA?: string; // Nuevo campo opcional

    // Proyecciones
    PROYECCIONES: Proyeccion[];

    // Configuración
    CONFIGURACION: ConfiguracionInventario;

    // Campos adicionales para UI
    COLOR_ALERTA?: string; // Nuevo campo para UI
    ICONO_ESTADO?: string; // Nuevo campo para UI
}

interface ConfiguracionInventario {
    DIAS_STOCK_SEGURIDAD: number;
    DIAS_PUNTO_REORDEN: number;
    DIAS_ALARMA_STOCK: number; // Nuevo campo para días de alarma
    LEAD_TIME_REPOSICION: number;
    DIAS_MAX_REPOSICION: number;
    DIAS_LABORALES_MES: number;
    DIAS_TRANSITO: number; // Nuevo: Configuración días de tránsito
    VERSION_MODELO: string;
    METODO_CALCULO?: string; // Nuevo campo opcional
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

interface VariationChartProps {
    data: Array<{
        mes: string;
        variacion: number | null;
    }>;
    colors?: {
        positive: string;
        negative: string;
        neutral: string;
    };
}

// Constantes
const ITEMS_PER_PAGE = 12;

const Dashboard = () => {
    // Estados
    const [allPredictions, setAllPredictions] = useState<ProductoData[]>([]);
    const [filteredPredictions, setFilteredPredictions] = useState<ProductoData[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
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
    const searchInputRef = useRef<HTMLInputElement>(null);
    //Login
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showRegister, setShowRegister] = useState(false);
    const [showLogin, setShowLogin] = useState(true);  // El login es visible por defecto
    const [activeComponent, setActiveComponent] = useState<string>('dashboard');
    const [showReports, setShowReports] = useState(false);
    const [isDocsOpen, setIsDocsOpen] = useState(false);

    const toggleDocsMenu = () => {
        setIsDocsOpen(!isDocsOpen);
    };

    // Variantes para la animación del menú desplegable
    const menuVariants = {
        open: {
            opacity: 1,
            height: 'auto',
            transition: {
                duration: 0.3,
                ease: 'easeInOut',
                when: 'beforeChildren',
                staggerChildren: 0.1
            }
        },
        closed: {
            opacity: 0,
            height: 0,
            transition: {
                duration: 0.2,
                ease: 'easeInOut',
                when: 'afterChildren'
            }
        }
    };

    // Variantes para los elementos del menú
    const itemVariants = {
        open: {
            y: 0,
            opacity: 1,
            transition: {
                duration: 0.3,
                ease: 'easeOut'
            }
        },
        closed: {
            y: -10,
            opacity: 0,
            transition: {
                duration: 0.2,
                ease: 'easeIn'
            }
        }
    };

    const handleShowReports = () => {
        setActiveComponent('reports');
        setShowReports(true);
        setSidebarOpen(false); // Cerrar el sidebar en dispositivos móviles
    };

    const handleCloseReports = () => {
        setShowReports(false);
        setActiveComponent('dashboard');
    };

    // Refs
    const chartRef = useRef<HTMLDivElement>(null);

    // Efectos
    useEffect(() => {
        if (!searchTerm) {
            setFilteredPredictions(allPredictions);
            setCurrentPage(1);
            return;
        }

        const filtered = allPredictions.filter(producto => {
            const searchLower = searchTerm.toLowerCase();
            return (
                producto.CODIGO.toLowerCase().includes(searchLower) ||
                producto.DESCRIPCION.toLowerCase().includes(searchLower)
            );
        });

        setFilteredPredictions(filtered);
        setCurrentPage(1);
    }, [searchTerm, allPredictions]);

    // Efecto para cargar datos iniciales
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${API_URL}/predictions`);

                if (response.data?.success) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [];
                    setAllPredictions(data);
                    setFilteredPredictions(data);
                } else {
                    setAllPredictions([]);
                    setFilteredPredictions([]);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                setAllPredictions([]);
                setFilteredPredictions([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Comprobar autenticación al cargar
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    // Manejadores para autenticación
    const handleSuccessfulLogin = () => {
        setIsAuthenticated(true);
    };

    const handleSuccessfulRegister = () => {
        setIsAuthenticated(true);
    };

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

        try {
            const pdf = new jsPDF('p', 'mm', 'a4') as jsPDF & { lastAutoTable?: { finalY: number } };

            // Configuración de márgenes y espacios
            const margin = {
                left: 15,
                right: 15,
                top: 15,  // Reducido para dar más espacio al logo
                bottom: 20
            };
            const pageWidth = 210;
            const contentWidth = pageWidth - margin.left - margin.right;
            let currentY = margin.top;

            // Configuración de fuentes y colores corporativos
            pdf.setFont('helvetica');
            const primaryBlue: [number, number, number] = [0, 50, 104]; // #003268
            const oceanBlue: [number, number, number] = [0, 116, 207]; // #0074CF
            const cyan: [number, number, number] = [0, 176, 240]; // #00B0F0
            const darkBlue: [number, number, number] = [0, 26, 48]; // #001A30
            const smokeColor: [number, number, number] = [237, 237, 237]; // #EDEDED
            const successGreen: [number, number, number] = [25, 135, 84]; // #198754
            const dangerRed: [number, number, number] = [220, 53, 69]; // #DC3545
            const warningYellow: [number, number, number] = [255, 193, 7]; // #FFC107

            // --- ENCABEZADO CON LOGO ---
            const logoData = await getBase64ImageFromURL('/Logo_Kpital.jpg') as string;

            // Ajuste profesional del logo
            const logoMaxHeight = 20; // Altura máxima en mm
            const logoMaxWidth = 60;  // Ancho máximo en mm

            // Calcular dimensiones manteniendo aspecto ratio
            let logoWidth = logoMaxWidth;
            let logoHeight = logoMaxHeight;

            // Obtener dimensiones reales de la imagen
            const img = new Image();
            img.src = logoData;
            await new Promise((resolve) => {
                img.onload = resolve;
            });

            const aspectRatio = img.width / img.height;

            // Ajustar para mantener proporciones
            if (img.width > img.height) {
                logoHeight = logoWidth / aspectRatio;
                if (logoHeight > logoMaxHeight) {
                    logoHeight = logoMaxHeight;
                    logoWidth = logoHeight * aspectRatio;
                }
            } else {
                logoWidth = logoHeight * aspectRatio;
                if (logoWidth > logoMaxWidth) {
                    logoWidth = logoMaxWidth;
                    logoHeight = logoWidth / aspectRatio;
                }
            }

            // Posición centrada
            const logoX = (pageWidth - logoWidth) / 2;
            const logoY = margin.top;

            pdf.addImage(logoData, 'JPEG', logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');

            // Título principal
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.text('INFORME DE GESTIÓN DE INVENTARIOS', pageWidth / 2, logoY + logoHeight + 10, { align: 'center' });

            // Línea decorativa
            pdf.setDrawColor(oceanBlue[0], oceanBlue[1], oceanBlue[2]);
            pdf.setLineWidth(0.5);
            currentY = logoY + logoHeight + 15;
            pdf.line(margin.left, currentY, pageWidth - margin.right, currentY);

            currentY += 15;

            // --- INFORMACIÓN DEL PRODUCTO ---
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);

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

            currentY += 6 + (descripcion.length * 5) + 10;

            // Función para agregar nueva página si es necesario
            const checkPageBreak = (requiredSpace: number) => {
                if (currentY + requiredSpace > 297 - margin.bottom) {
                    pdf.addPage();
                    currentY = margin.top;
                    pdf.setFontSize(10);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text(`Continuación informe: ${selectedPrediction.data.CODIGO}`, margin.left, currentY);
                    currentY += 10;
                }
            };

            // --- RESUMEN EJECUTIVO ---
            checkPageBreak(40);
            pdf.setFontSize(14);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.setFont('helvetica', 'bold');
            pdf.text('1. RESUMEN EJECUTIVO', margin.left, currentY);

            pdf.setDrawColor(oceanBlue[0], oceanBlue[1], oceanBlue[2]);
            pdf.setLineWidth(0.3);
            pdf.line(margin.left, currentY + 2, pageWidth - margin.right, currentY + 2);
            currentY += 12;

            // Configuración base para el texto
            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60); // Gris oscuro para mejor legibilidad

            const status = getStockStatus(
                selectedPrediction.data.STOCK_TOTAL,
                selectedPrediction.data.STOCK_SEGURIDAD,
                selectedPrediction.data.PUNTO_REORDEN
            );

            let statusMessage = '';
            let statusColor: [number, number, number];
            if (status === 'danger') {
                statusMessage = 'NIVEL CRÍTICO';
                statusColor = [0, 50, 104]; // Primary Blue: #003268
            } else if (status === 'warning') {
                statusMessage = 'NIVEL BAJO';
                statusColor = [0, 116, 207]; // Ocean Blue: #0074CF
            } else {
                statusMessage = 'NIVEL ÓPTIMO';
                statusColor = [0, 176, 240]; // Cian: #00B0F0
            }

            // Contenedor centrado para el estado
            const statusWidth = 60;
            const statusX = (pageWidth - statusWidth) / 2;

            // Etiqueta de estado centrada
            pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
            pdf.roundedRect(statusX, currentY + 5, statusWidth, 10, 3, 3, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(statusMessage, pageWidth / 2, currentY + 11, { align: 'center' });

            // Texto descriptivo del estado (centrado)
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const statusDescription = status === 'danger'
                ? 'Se requiere acción inmediata para reponer stock'
                : status === 'warning'
                    ? 'Monitorear estrechamente el inventario'
                    : 'El inventario se encuentra en niveles adecuados';

            pdf.text(statusDescription, pageWidth / 2, currentY + 22, { align: 'center' });

            currentY += 30;

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
                    fillColor: darkBlue,
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    textColor: 50,
                    fontSize: 9
                },
                alternateRowStyles: {
                    fillColor: smokeColor
                },
                margin: { left: margin.left, right: margin.right },
                styles: {
                    cellPadding: 4,
                    fontSize: 9,
                    valign: 'middle',
                    lineColor: [200, 200, 200],
                    lineWidth: 0.5,
                    overflow: 'linebreak'
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 60, textColor: darkBlue },
                    1: { cellWidth: 'auto', halign: 'right' }
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            });

            // --- ANÁLISIS DETALLADO --- (Versión optimizada con análisis profundo)
            currentY = (pdf.lastAutoTable?.finalY || currentY) + 10;
            checkPageBreak(150);

            // Título de sección
            pdf.setFontSize(14);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.setFont('helvetica', 'bold');
            pdf.text('2. ANÁLISIS ESTRATÉGICO DE INVENTARIO', margin.left, currentY);
            pdf.setDrawColor(oceanBlue[0], oceanBlue[1], oceanBlue[2]);
            pdf.setLineWidth(0.3);
            pdf.line(margin.left, currentY + 2, pageWidth - margin.right, currentY + 2);
            currentY += 12;

            // Configuración base para texto
            pdf.setFontSize(9);
            pdf.setTextColor(60, 60, 60);

            // Función para texto compacto
            const addCompactText = (text: string, isBold = false, indent = 0) => {
                pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
                const lines = pdf.splitTextToSize(text, contentWidth - indent);
                lines.forEach((line: string) => {
                    checkPageBreak(5);
                    pdf.text(line, margin.left + indent, currentY);
                    currentY += 5;
                });
            };

            // 1. Contexto Operacional
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            addCompactText('Situación Actual:', true);
            currentY += 2;

            addCompactText(
                `El producto ${selectedPrediction.data.CODIGO} muestra un stock total de ${selectedPrediction.data.STOCK_TOTAL} unidades ` +
                `(${selectedPrediction.data.STOCK_FISICO} unidades físicas + ${selectedPrediction.data.UNIDADES_TRANSITO} unidades en tránsito), ` +
                `con una cobertura de ${selectedPrediction.data.DIAS_COBERTURA} días frente a los ${selectedPrediction.data.CONFIGURACION.DIAS_STOCK_SEGURIDAD} ` +
                `días recomendados, situándose en un nivel ${selectedPrediction.data.DIAS_COBERTURA < selectedPrediction.data.CONFIGURACION.DIAS_STOCK_SEGURIDAD ? 'CRÍTICO' : 'DE ALERTA'}.`
            );
            currentY += 6;

            // 2. Análisis de Comportamiento
            pdf.setFont('helvetica', 'bold');
            addCompactText('Patrón de Consumo:', true);
            currentY += 2;

            const variabilidad = calculateVariability(selectedPrediction.data.HISTORICO_CONSUMOS);
            const desviacion = calculateStandardDeviation(Object.values(selectedPrediction.data.HISTORICO_CONSUMOS)) || 15;
            addCompactText(
                `El histórico muestra un consumo promedio de ${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)}±${desviacion.toFixed(0)} uds/mes ` +
                `(variabilidad ${variabilidad.toFixed(1)}%), indicando una demanda ${variabilidad > 25 ? 'VOLÁTIL' : 'ESTABLE'}. ` +
                `El punto de reorden actual (${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)} uds) y stock de seguridad ` +
                `(${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} uds) están ${variabilidad > 25 ? 'POR DEBAJO' : 'ACORDE'} ` +
                `a la variabilidad observada.`
            );
            currentY += 6;

            // 3. Evaluación de Riesgos
            pdf.setFont('helvetica', 'bold');
            addCompactText('Riesgos Operacionales:', true);
            currentY += 2;

            const riesgoStockout = calculateStockoutRisk(selectedPrediction.data);
            addCompactText(
                `Existe un ${riesgoStockout.toFixed(1)}% de probabilidad de quiebre de stock considerando: ` +
                `(1) Cobertura actual insuficiente (${selectedPrediction.data.DIAS_COBERTURA} días), ` +
                `(2) Tiempo de reposición de ${selectedPrediction.data.CONFIGURACION.LEAD_TIME_REPOSICION} días, ` +
                `(3) Variabilidad del ${variabilidad.toFixed(1)}%. El déficit actual de ` +
                `${selectedPrediction.data.DEFICIT > 0 ? selectedPrediction.data.DEFICIT.toFixed(0) + ' uds' : '0'} ` +
                `(${(selectedPrediction.data.DEFICIT / selectedPrediction.data.STOCK_MINIMO * 100).toFixed(1)}% del mínimo) ` +
                `agrega presión al sistema.`
            );
            currentY += 6;

            // 4. Plan de Acción
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(successGreen[0], successGreen[1], successGreen[2]);
            addCompactText('Acciones Recomendadas:', true);
            pdf.setTextColor(60, 60, 60);
            currentY += 2;

            addCompactText(`• Pedido inmediato: ${selectedPrediction.data.CAJAS_A_PEDIR} cajas (${selectedPrediction.data.UNIDADES_A_PEDIR} uds)`);
            addCompactText(`• Fecha reposición: ${formatDate(selectedPrediction.data.FECHA_REPOSICION)}`);
            addCompactText(`• Optimización parámetros:`);
            addCompactText(`  - Aumentar stock seguridad a ${Math.round(selectedPrediction.data.STOCK_SEGURIDAD * 1.15)} uds (+15%)`, false, 10);
            addCompactText(`  - Reducir lead time a 10 días (actual: ${selectedPrediction.data.CONFIGURACION.LEAD_TIME_REPOSICION} días)`, false, 10);
            addCompactText(`  - Revisar algoritmo de reorden cada trimestre`, false, 10);
            currentY += 6;

            // 5. Análisis Estratégico (en lugar de conclusión)
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            addCompactText('Análisis Estratégico:', true);
            pdf.setFont('helvetica', 'normal');
            currentY += 2;

            addCompactText(
                `El comportamiento actual del inventario sugiere que ${selectedPrediction.data.DIAS_COBERTURA < 15 ? 'se requiere intervención ' +
                    'inmediata para evitar rupturas de stock' : 'existe un margen de seguridad que permite ' +
                'acciones planificadas'}. La ${variabilidad > 25 ? 'alta' : 'moderada'} variabilidad ` +
                `del consumo (${variabilidad.toFixed(1)}%) justifica adoptar una estrategia ${variabilidad > 25 ?
                    '"just-in-case" con inventarios de seguridad más conservadores' : '"just-in-time" con ' +
                    'revisiones frecuentes'}. El lead time actual de ${selectedPrediction.data.CONFIGURACION.LEAD_TIME_REPOSICION} ` +
                `días ${selectedPrediction.data.CONFIGURACION.LEAD_TIME_REPOSICION > 10 ? 'debería reducirse para mejorar ' +
                    'la respuesta' : 'es adecuado para el patrón de consumo actual'}.`
            );
            currentY += 10;

            // Resetear estilo para secciones siguientes
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);

            // --- CÁLCULOS CLAVE --- (SECCIÓN AÑADIDA)
            currentY += 15;

            pdf.setFontSize(14);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.setFont('helvetica', 'bold');
            pdf.text('3. CÁLCULOS CLAVE', margin.left, currentY);

            pdf.setDrawColor(oceanBlue[0], oceanBlue[1], oceanBlue[2]);
            pdf.setLineWidth(0.3);
            pdf.line(margin.left, currentY + 2, pageWidth - margin.right, currentY + 2);
            currentY += 12;

            // Configuración base para el texto
            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60); // Gris oscuro para mejor legibilidad

            const formulas = [
                `• Stock Mínimo = Consumo Mensual + Stock Seguridad`,
                `  ${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)} + ${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} = ${selectedPrediction.data.STOCK_MINIMO.toFixed(0)} unidades`,
                `• Punto de Reorden = Consumo Diario × 44 días`,
                `  ${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} × 44 = ${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)} unidades`,
                `• Días de Cobertura = Stock Actual / Consumo Diario`,
                `  ${selectedPrediction.data.STOCK_TOTAL.toFixed(0)} / ${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} = ${selectedPrediction.data.DIAS_COBERTURA} días`
            ];

            formulas.forEach((formula, index) => {
                checkPageBreak(6);
                pdf.text(formula, margin.left + (formula.startsWith('•') ? 0 : 10), currentY);

                // Añadir espacio extra después de cada fórmula completa
                if (index % 2 === 1) {
                    currentY += 8; // Más espacio entre fórmulas
                } else {
                    currentY += 6;
                }
            });

            // --- GRÁFICO DE PREDICCIONES SEMANAL ---
            checkPageBreak(160);
            currentY += 15;
            pdf.setFontSize(14);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.setFont('helvetica', 'bold');
            pdf.text('4. GRÁFICO DE PREDICCIONES SEMANAL', margin.left, currentY);

            pdf.setDrawColor(oceanBlue[0], oceanBlue[1], oceanBlue[2]);
            pdf.setLineWidth(0.3);
            pdf.line(margin.left, currentY + 2, pageWidth - margin.right, currentY + 2);
            currentY += 12;

            // Convertir datos mensuales a semanas
            const weeklyData = selectedPrediction.data.PROYECCIONES.flatMap(proyeccion => {
                const semanas: { semana: string; stock: number; min: number; seguridad: number; consumo: number; }[] = [];
                const consumoSemanal = proyeccion.consumo_mensual / 4;
                let stock = proyeccion.stock_proyectado + proyeccion.consumo_mensual;

                for (let i = 1; i <= 4; i++) {
                    stock -= consumoSemanal;
                    semanas.push({
                        semana: `Sem ${i} ${formatMes(proyeccion.mes)}`,
                        stock: Math.max(0, stock),
                        min: proyeccion.punto_reorden,
                        seguridad: proyeccion.stock_seguridad,
                        consumo: consumoSemanal
                    });
                }
                return semanas;
            });

            // Crear canvas oculto en el DOM con mayor tamaño
            const canvas = document.createElement('canvas');
            canvas.width = 1200; // Aumentado para mejor resolución
            canvas.height = 700; // Aumentado para mejor resolución
            canvas.style.display = 'none';
            document.body.appendChild(canvas);

            // Generar el gráfico semanal
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: weeklyData.map(w => w.semana),
                        datasets: [
                            {
                                label: 'Stock Proyectado',
                                data: weeklyData.map(w => w.stock),
                                borderColor: '#0074CF', // Azul principal
                                backgroundColor: 'rgba(0, 176, 240, 0.15)', // Cyan con opacidad
                                tension: 0.1,
                                fill: true,
                                borderWidth: 3,
                                pointBackgroundColor: '#0074CF',
                                pointRadius: 5,
                                pointHoverRadius: 7
                            },
                            {
                                label: 'Punto de Reorden',
                                data: weeklyData.map(w => w.min),
                                borderColor: '#EF4444', // Rojo
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                borderDash: [5, 3],
                                tension: 0.1,
                                borderWidth: 2.5,
                                pointBackgroundColor: '#EF4444',
                                pointRadius: 4
                            },
                            {
                                label: 'Stock de Seguridad',
                                data: weeklyData.map(w => w.seguridad),
                                borderColor: '#001A30', // Azul oscuro
                                backgroundColor: 'rgba(0, 26, 48, 0.1)',
                                borderDash: [4, 2],
                                tension: 0.1,
                                borderWidth: 2.5,
                                pointBackgroundColor: '#001A30',
                                pointRadius: 4
                            },
                            {
                                label: 'Consumo Semanal',
                                data: weeklyData.map(w => w.consumo),
                                borderColor: '#10B981', // Verde
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                borderDash: [3, 3],
                                tension: 0.1,
                                borderWidth: 2.5,
                                pointBackgroundColor: '#10B981',
                                pointRadius: 4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Proyección de Stock Semanal',
                                font: {
                                    size: 22,
                                    family: 'Helvetica',
                                    weight: 'bold'
                                },
                                color: '#001A30',
                                padding: {
                                    top: 10,
                                    bottom: 30
                                }
                            },
                            legend: {
                                position: 'top',
                                labels: {
                                    font: {
                                        size: 16,
                                        family: 'Helvetica'
                                    },
                                    padding: 20,
                                    boxWidth: 20,
                                    boxHeight: 20,
                                    usePointStyle: true,
                                    color: '#001A30'
                                },
                            },
                            tooltip: {
                                backgroundColor: '#FFFFFF',
                                titleColor: '#001A30',
                                bodyColor: '#001A30',
                                borderColor: '#EDEDED',
                                borderWidth: 1,
                                padding: 12,
                                cornerRadius: 6,
                                usePointStyle: true,
                                boxPadding: 6,
                                callbacks: {
                                    label: function (context) {
                                        return `${context.dataset.label}: ${context.parsed.y.toFixed(0)} unidades`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: '#001A30',
                                    font: {
                                        family: 'Helvetica',
                                        size: 12
                                    },
                                    padding: 10
                                },
                                grid: {
                                    color: 'rgba(237, 237, 237, 0.5)',
                                    drawOnChartArea: true,
                                    drawTicks: false
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'Unidades',
                                    color: '#001A30',
                                    font: {
                                        size: 16,
                                        family: 'Helvetica',
                                        weight: 'bold'
                                    }
                                },
                                ticks: {
                                    color: '#001A30',
                                    font: {
                                        family: 'Helvetica',
                                        size: 12
                                    }
                                },
                                grid: {
                                    color: 'rgba(237, 237, 237, 0.5)',
                                    drawOnChartArea: true,
                                    drawTicks: false
                                }
                            }
                        }
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 500));

                try {
                    const chartImage = canvas.toDataURL('image/png', 1.0);
                    const imgWidth = contentWidth;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    checkPageBreak(imgHeight + 15);
                    pdf.addImage(chartImage, 'PNG', margin.left, currentY, imgWidth, imgHeight);

                    // Agregar leyenda explicativa debajo del gráfico
                    currentY += imgHeight + 10;
                    checkPageBreak(60);

                    const legendText = [
                        'Cómo interpretar este gráfico:',
                        '- Área Azul: Stock proyectado semanal',
                        '- Línea Roja: Punto de reorden',
                        '- Línea Azul Oscuro: Stock de seguridad',
                        '- Línea Verde: Consumo semanal estimado'
                    ];

                    pdf.setFontSize(9);
                    pdf.setTextColor(100, 100, 100);

                    legendText.forEach((text, index) => {
                        if (index === 0) {
                            pdf.setFont('helvetica', 'bold');
                            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
                        } else {
                            pdf.setFont('helvetica', 'normal');
                            pdf.setTextColor(100, 100, 100);
                        }

                        pdf.text(text, margin.left, currentY);
                        currentY += 5;
                    });

                    currentY += 10;
                } finally {
                    chart.destroy();
                    document.body.removeChild(canvas);
                }
            }

            // --- PROYECCIÓN MENSUAL (TABLA) ---
            checkPageBreak(40);
            pdf.setFontSize(14);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.setFont('helvetica', 'bold');
            pdf.text('5. PROYECCIÓN MENSUAL', margin.left, currentY);

            pdf.setDrawColor(oceanBlue[0], oceanBlue[1], oceanBlue[2]);
            pdf.setLineWidth(0.3);
            pdf.line(margin.left, currentY + 2, pageWidth - margin.right, currentY + 2);
            currentY += 12;

            // Configuración base para el texto
            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60); // Gris oscuro para mejor legibilidad
            const proyeccionData = selectedPrediction.data.PROYECCIONES.map(proyeccion => {
                const alerta = proyeccion.alerta_stock;
                return [
                    proyeccion.mes,
                    proyeccion.stock_proyectado.toFixed(0),
                    proyeccion.stock_seguridad.toFixed(0),
                    proyeccion.punto_reorden.toFixed(0),
                    proyeccion.cajas_a_pedir > 0 ? proyeccion.cajas_a_pedir : '-',
                    proyeccion.fecha_reposicion,
                    alerta ? 'ALERTA' : 'OK'
                ];
            });

            // Tabla centrada con márgenes
            const tableWidth = 170;
            const tableMarginLeft = (pageWidth - tableWidth) / 2;

            autoTable(pdf, {
                startY: currentY,
                head: [['Mes', 'Stock', 'Seguridad', 'Reorden', 'Pedir', 'Fecha Rep.', 'Estado']],
                body: proyeccionData,
                margin: { left: tableMarginLeft, right: tableMarginLeft },
                headStyles: {
                    fillColor: darkBlue,
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center',
                    fontSize: 9,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.2
                },
                bodyStyles: {
                    halign: 'center',
                    fontSize: 9,
                    cellPadding: 4,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.2,
                    textColor: 50
                },
                alternateRowStyles: {
                    fillColor: smokeColor,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.2
                },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'left' },
                    1: { cellWidth: 20 }, // Aumentado
                    2: { cellWidth: 20 }, // Aumentado
                    3: { cellWidth: 20 }, // Aumentado
                    4: { cellWidth: 15 },
                    5: { cellWidth: 30, halign: 'left' },
                    6: {
                        cellWidth: 24,
                        halign: 'center',
                        fontStyle: 'bold'
                    }
                },
                styles: {
                    fontSize: 9,
                    cellPadding: 3,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.2,
                    overflow: 'linebreak'
                },
                didParseCell: (data: any) => {
                    // Solo aplicar estilo a la columna "Estado" (índice 6)
                    if (data.section === 'body' && data.column.index === 6) {
                        const isAlert = data.cell.raw === 'ALERTA';

                        // Colores corporativos
                        const primaryBlue = [0, 50, 104];    // #003268
                        const smoke = [237, 237, 237];       // #EDEDED

                        data.cell.styles.fillColor = isAlert ? primaryBlue : smoke;
                        data.cell.styles.textColor = isAlert ? [255, 255, 255] : [0, 0, 0];
                    }
                }
            });

            // --- PIE DE PÁGINA ---
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text('Documento confidencial - Kpital Inventory Management System', margin.left, 290);
            pdf.setTextColor(oceanBlue[0], oceanBlue[1], oceanBlue[2]);
            pdf.text('www.kpital.com', pageWidth - margin.right, 290, { align: 'right' });

            // Guardar PDF
            const fileName = `KPI-Inventory-${selectedPrediction.data.CODIGO}-${new Date().toISOString().slice(0, 10)}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error('Error al generar el PDF:', error);
            alert('Ocurrió un error al generar el PDF. Por favor intente nuevamente.');
        }
    };

    const generateOrderPDF = async (products: any[]) => {
        try {
            const pdf = new jsPDF('p', 'mm', 'a4') as jsPDF & { lastAutoTable?: { finalY: number } };

            const margin = { left: 15, right: 15, top: 15, bottom: 20 };
            const pageWidth = 210;
            let currentY = margin.top;

            const primaryBlue: [number, number, number] = [0, 50, 104];
            const oceanBlue: [number, number, number] = [0, 116, 207];
            const darkBlue: [number, number, number] = [0, 26, 48];
            const smokeColor: [number, number, number] = [237, 237, 237];

            const logoData = await getBase64ImageFromURL('/Logo_Kpital.jpg') as string;
            const logoMaxHeight = 20;
            const logoMaxWidth = 60;

            const img = new Image();
            img.src = logoData;
            await new Promise((resolve) => { img.onload = resolve; });

            const aspectRatio = img.width / img.height;
            let logoWidth = logoMaxWidth;
            let logoHeight = logoMaxHeight;
            if (img.width > img.height) {
                logoHeight = logoWidth / aspectRatio;
                if (logoHeight > logoMaxHeight) {
                    logoHeight = logoMaxHeight;
                    logoWidth = logoHeight * aspectRatio;
                }
            } else {
                logoWidth = logoHeight * aspectRatio;
                if (logoWidth > logoMaxWidth) {
                    logoWidth = logoMaxWidth;
                    logoHeight = logoWidth / aspectRatio;
                }
            }

            const logoX = (pageWidth - logoWidth) / 2;
            pdf.addImage(logoData, 'JPEG', logoX, currentY, logoWidth, logoHeight, undefined, 'FAST');
            currentY += logoHeight + 4;

            // --- Datos de empresa centrados bajo el logo ---
            pdf.setFontSize(9);
            pdf.setTextColor(60, 60, 60);
            const empresaData = [
                'Kpital Link',
                'RUC: 1793153682001',
                'Dirección: Catalina Aldaz N34-155 y Portugal',
                'Teléfono: 0995099217',
                'Email: pricing@kpitalink.com'
            ];
            empresaData.forEach((line, i) => {
                pdf.text(line, pageWidth / 2, currentY + (i * 4), { align: 'center' });
            });
            currentY += empresaData.length * 4 + 6;

            // --- Título central ---
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            pdf.setTextColor(...darkBlue);
            pdf.text('ORDEN DE COMPRA', pageWidth / 2, currentY, { align: 'center' });
            currentY += 10;

            // --- Datos del proveedor y enviar a ---
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);

            const proveedorData = [
                'PROVEEDOR:',
                'Polígono Industrial can Roca C/SNT',
                'Martí S/N e-08107 Martorelles',
                'BARCELONA - SPAIN',
                'TEL: 34935049510',
                'FAX: 34935977910',
                'RUC: 09132000'
            ];

            const enviarAData = [
                'ENVIAR A:',
                'AGLOMERADOS COTOPAXI S.A',
                'Av. De Los Granados E12-70 e Isla Marchena',
                'QUITO - ECUADOR',
                'TEL: 5933 3963000',
                'FAX: 5933 3963091',
                'RUC: 0590028665001'
            ];

            const lineSpacing = 5;
            const maxLines = Math.max(proveedorData.length, enviarAData.length);

            for (let i = 0; i < maxLines; i++) {
                const y = currentY + i * lineSpacing;

                if (proveedorData[i]) {
                    pdf.text(proveedorData[i], margin.left, y);
                }

                if (enviarAData[i]) {
                    pdf.text(enviarAData[i], pageWidth - margin.right, y, { align: 'right' });
                }
            }

            const fecha = new Date();
            const monthsES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
            const formattedFecha = `${fecha.getDate().toString().padStart(2, '0')} DE ${monthsES[fecha.getMonth()]} DE ${fecha.getFullYear()}`;
            const ordenNum = `ORD-${fecha.toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

            pdf.setFont('helvetica', 'bold');
            pdf.text(`Número: ${ordenNum}`, pageWidth - margin.right, currentY + 42, { align: 'right' });
            pdf.text(`Fecha: ${formattedFecha}`, pageWidth - margin.right, currentY + 47, { align: 'right' });
            pdf.text('Transporte: Terrestre / Courier / Marítimo', pageWidth - margin.right, currentY + 52, { align: 'right' });
            pdf.text('Duración estimada: 22 días laborables', pageWidth - margin.right, currentY + 57, { align: 'right' });

            currentY += 42;

            // --- Datos del solicitante ---
            const userString = localStorage.getItem('user');
            const user = userString ? JSON.parse(userString) : {};

            pdf.setTextColor(...primaryBlue);
            pdf.text('DATOS DEL SOLICITANTE', margin.left, currentY);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            const clienteData = [
                `Nombre: ${user?.nombre || 'No especificado'}`,
                `Email: ${user?.email || 'No especificado'}`,
                `Teléfono: ${user?.celular || 'No especificado'}`
            ];
            clienteData.forEach((line, index) => {
                pdf.text(line, margin.left, currentY + 5 + (index * 5));
            });
            currentY += 25;

            // --- Tabla de productos ---
            const productsAPedir = products
                .filter((p) => p.CAJAS_A_PEDIR && p.CAJAS_A_PEDIR > 0 && p.UNIDADES_A_PEDIR && p.UNIDADES_A_PEDIR > 0)
                .map(p => ({
                    ...p,
                    CAJAS_A_PEDIR: Number(p.CAJAS_A_PEDIR),
                    UNIDADES_A_PEDIR: Number(p.UNIDADES_A_PEDIR),
                    PRECIO_UNITARIO: Number(p.PRECIO_UNITARIO || 0)
                }));

            const tableData = productsAPedir.map((p, index) => [
                (index + 1).toString(),
                p.CODIGO || '-',
                p.DESCRIPCION || '-',
                p.UNIDADES_A_PEDIR?.toString() || '-',
                p.CAJAS_A_PEDIR?.toString() || '-',
                `$${(p.PRECIO_UNITARIO || 0).toFixed(2)}`,
                `$${((p.PRECIO_UNITARIO || 0) * (p.UNIDADES_A_PEDIR || 0)).toFixed(2)}`,
                new Date().toLocaleDateString('es-ES')
            ]);

            // 🧮 Cálculo de totales
            const totalUnidades = productsAPedir.reduce((sum, p) => sum + (p.UNIDADES_A_PEDIR || 0), 0);
            const totalCajas = productsAPedir.reduce((sum, p) => sum + (p.CAJAS_A_PEDIR || 0), 0);
            const totalPrecioUnitario = productsAPedir.reduce((sum, p) => sum + (p.PRECIO_UNITARIO || 0), 0);
            const totalTotal = productsAPedir.reduce((sum, p) => sum + ((p.PRECIO_UNITARIO || 0) * (p.UNIDADES_A_PEDIR || 0)), 0);

            // ✅ Fila de totales limpia, sin cortar texto
            tableData.push([
                '', '', `TOTAL (${productsAPedir.length})`,
                totalUnidades.toString(),
                totalCajas.toString(),
                `$${totalPrecioUnitario.toFixed(2)}`,
                `$${totalTotal.toFixed(2)}`,
                ''
            ]);

            autoTable(pdf, {
                startY: currentY,
                head: [['#', 'Código', 'Descripción', 'Unidades', 'Cajas', 'P. Unitario', 'Total', 'F. Solicitud']],
                body: tableData,
                margin: { left: margin.left, right: margin.right },
                headStyles: { fillColor: primaryBlue, textColor: 255, fontSize: 9, halign: 'center' },
                bodyStyles: { textColor: 50, fontSize: 9 },
                alternateRowStyles: { fillColor: smokeColor },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 8 },
                    1: { cellWidth: 22, halign: 'center' },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 18, halign: 'center' },
                    5: { cellWidth: 25, halign: 'right' },
                    6: { cellWidth: 25, halign: 'right' },
                    7: { cellWidth: 28, halign: 'center' }
                },

                // 👇 Esto es lo nuevo: pintamos y dibujamos texto de la última fila
                didDrawCell: (data) => {
                    const rows = tableData.length;
                    const isLastRow = data.row.index === rows - 1;

                    if (isLastRow) {
                        const { cell, doc, column, row } = data;

                        doc.setFillColor(230, 230, 230); // gris claro
                        doc.setDrawColor(150, 150, 150); // borde
                        doc.rect(cell.x, cell.y, cell.width, cell.height, 'FD'); // Fondo + borde

                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 0, 0);
                        doc.setFontSize(9);

                        // Si es una celda vacía (inicio o final), no pongas texto
                        const value = row.cells[column.index]?.text?.join(' ')?.trim() || '';
                        if (value !== '') {
                            const textX = cell.x + cell.width / 2;
                            const textY = cell.y + cell.height / 2 + 1;
                            doc.text(value, textX, textY, { align: 'center', baseline: 'middle' });
                        }
                    }
                }

            });



            // --- Total general ---
            const totalOrden = productsAPedir.reduce((sum, p) => sum + ((p.PRECIO_UNITARIO || 0) * (p.UNIDADES_A_PEDIR || 0)), 0);
            currentY = (pdf.lastAutoTable?.finalY || currentY) + 10;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`TOTAL ORDEN: $${totalOrden.toFixed(2)}`, pageWidth - margin.right, currentY, { align: 'right' });

            // --- Línea de firma ---
            currentY += 20;
            pdf.setLineWidth(0.3);
            pdf.line(margin.left, currentY, margin.left + 60, currentY);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.text(user?.nombre || 'Firma solicitante', margin.left, currentY + 5);

            // --- Pie de página ---
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text('Documento generado automáticamente - © Kpital Link', pageWidth / 2, 290, { align: 'center' });

            pdf.save(`Orden_Compra_${ordenNum}.pdf`);
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            alert('Ocurrió un error al generar el PDF. Por favor intente nuevamente.');
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

            const response = await axios.post(`${API_URL}/predictions/refresh`, formData, {
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

            const predictionsResponse = await axios.get(`${API_URL}/predictions`);
            setAllPredictions(predictionsResponse.data.data || []);
            // ✅ Limpiar las marcas visuales al cargar un nuevo archivo
            localStorage.removeItem('transitDaysMap');

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
            // 1. Obtener datos del usuario actual
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (!user?.id) {
                throw new Error('No se pudo identificar al usuario. Por favor, inicie sesión nuevamente.');
            }

            // 2. Obtener datos del producto
            const producto = allPredictions.find((p) => p.CODIGO === codigo);
            if (!producto) {
                throw new Error(`Producto con código ${codigo} no encontrado`);
            }

            // 3. Obtener predicción actualizada
            const response = await axios.get<PredictionData>(`${API_URL}/predictions/${codigo}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });

            if (!response.data?.data) {
                throw new Error('No se recibieron datos válidos del servidor');
            }

            setSelectedPrediction(response.data);
            const { weekly, monthly } = generateChartData(response.data.data.PROYECCIONES);
            setWeeklyData(weekly);
            setMonthlyData(monthly);

            // 4. Manejo del producto
            let productId;
            try {
                // Intentar obtener el producto existente
                const existingProductRes = await axios.get(`${API_URL}/products?code=${encodeURIComponent(producto.CODIGO)}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });

                if (existingProductRes.data?.data?.length > 0) {
                    const existingProduct = existingProductRes.data.data.find((p: any) => p.code === producto.CODIGO);
                    if (!existingProduct) {
                        throw new Error('Producto encontrado pero no coincide con el código');
                    }
                    productId = existingProduct.id;
                } else {
                    // Crear nuevo producto
                    const productData = {
                        code: producto.CODIGO,
                        description: producto.DESCRIPCION,
                        totalStock: Math.floor(producto.STOCK_TOTAL),
                        reorderPoint: Math.floor(producto.PUNTO_REORDEN),
                        unitsToOrder: Math.floor(producto.UNIDADES_A_PEDIR),
                    };

                    const productResponse = await axios.post(
                        `${API_URL}/products`,
                        productData,
                        {
                            headers: {
                                Authorization: `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!productResponse.data?.success) {
                        throw new Error(productResponse.data?.message || 'Error al crear el producto');
                    }

                    productId = productResponse.data.data.id;
                }
            } catch (err: any) {
                if (err.response?.status === 409) {
                    // Reintentar obtener el producto en caso de conflicto
                    const existingProductRes = await axios.get(`${API_URL}/products?code=${encodeURIComponent(producto.CODIGO)}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    });
                    const existingProduct = existingProductRes.data.data.find((p: any) => p.code === producto.CODIGO);
                    if (existingProduct) {
                        productId = existingProduct.id;
                    } else {
                        throw new Error('No se pudo obtener el ID del producto existente');
                    }
                } else {
                    throw new Error(err.response?.data?.message || 'Error al procesar el producto');
                }
            }

            if (!productId) {
                throw new Error('No se pudo obtener el ID del producto');
            }

            // 5. Validar reportes existentes para este producto
            const today = new Date().toISOString().split('T')[0];
            const reportsRes = await axios.get(`${API_URL}/reports?productId=${productId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });

            if (!reportsRes.data?.success) {
                throw new Error('Error al obtener los reportes existentes');
            }

            const reports = reportsRes.data.data || [];
            const userReportToday = reports.find((report: any) => {
                const reportDate = new Date(report.createdAt).toISOString().split('T')[0];
                return (
                    report.productId === productId &&
                    report.userId === user.id &&
                    reportDate === today &&
                    report.filename.includes(producto.CODIGO)
                );
            });

            if (userReportToday) {
                toast.warn(
                    `⚠️ Ya generaste un reporte para ${producto.CODIGO} hoy. ` +
                    `Puedes verlo en la sección de reportes.`,
                    { autoClose: 5000 }
                );
                return;
            }

            // 6. Crear el nuevo reporte
            const filename = `Reporte_${producto.CODIGO}_${today}_${user.id}.txt`;
            const reportResponse = await axios.post(
                `${API_URL}/reports`,
                {
                    filename,
                    url: '#',
                    productId,
                    userId: user.id,
                    content: JSON.stringify({
                        ...response.data.data,
                        generatedAt: new Date().toISOString(),
                        productCode: producto.CODIGO,
                        productDescription: producto.DESCRIPCION,
                    }),
                },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!reportResponse.data.success) {
                throw new Error(reportResponse.data.message || 'Error al crear el reporte');
            }

            // 7. Mostrar mensaje apropiado
            const otherReportsToday = reports.filter((report: any) => {
                const reportDate = new Date(report.createdAt).toISOString().split('T')[0];
                return (
                    report.productId === productId &&
                    report.userId !== user.id &&
                    reportDate === today &&
                    report.filename.includes(producto.CODIGO)
                );
            });

            if (otherReportsToday.length > 0) {
                const otherUsers = [...new Set(otherReportsToday.map((r: any) => r.User?.nombre || 'Desconocido'))].join(', ');
                toast.success(
                    `✅ Reporte generado correctamente para ${producto.CODIGO}. ` +
                    `Otros usuarios (${otherUsers}) también han generado reportes para este producto hoy.`,
                    { autoClose: 6000 }
                );
            } else {
                toast.success(`✅ Reporte generado exitosamente para ${producto.CODIGO}`, { autoClose: 4000 });
            }

            setShowReports(false);

        } catch (err: any) {
            console.error('Error en handlePredict:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Error al procesar el análisis';
            toast.error(`❌ ${errorMessage}`, { autoClose: 5000 });

            if (err.response?.data?.errors) {
                const validationErrors = err.response.data.errors.map((e: any) => e.message).join(', ');
                toast.error(`Errores de validación: ${validationErrors}`, { autoClose: 7000 });
            }
        } finally {
            setLoading(false);
        }
    };

    const refreshPredictions = async () => {
        try {
            const response = await axios.get(`${API_URL}/predictions`);
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

    // Función para resaltar coincidencias en el texto
    const highlightMatches = (text: string, search: string) => {
        if (!search.trim()) return text;

        const regex = new RegExp(`(${search.trim()})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, index) =>
            regex.test(part) ? (
                <span key={index} className="bg-yellow-200 text-black">
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

    // 1. Cálculo de desviación estándar para medir variabilidad del consumo
    function calculateStandardDeviation(values: number[]): number {
        if (!values || values.length === 0) return 0;

        const n = values.length;
        const mean = values.reduce((a, b) => a + b, 0) / n;
        const squaredDifferences = values.map(x => Math.pow(x - mean, 2));
        const variance = squaredDifferences.reduce((a, b) => a + b, 0) / n;

        return Math.sqrt(variance);
    }

    // 2. Cálculo de variabilidad porcentual (Coeficiente de Variación)
    function calculateVariability(historicData: Record<string, number>): number {
        if (!historicData) return 0;

        const values = Object.values(historicData);
        if (values.length < 3) return 0; // Mínimo 3 meses para cálculo confiable

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        if (mean === 0) return 0;

        const stdDev = calculateStandardDeviation(values);
        return (stdDev / mean) * 100; // Coeficiente de variación en porcentaje
    }

    // 3. Cálculo de probabilidad de stockout (basado en distribución normal)
    function calculateStockoutRisk(data: ProductoData): number {
        if (!data || !data.HISTORICO_CONSUMOS) return 0;

        const values = Object.values(data.HISTORICO_CONSUMOS);
        if (values.length < 3) return 0;

        const mean = data.CONSUMO_PROMEDIO;
        const stdDev = calculateStandardDeviation(values);
        const currentStock = data.STOCK_TOTAL;
        const leadTime = data.CONFIGURACION.LEAD_TIME_REPOSICION;

        // Cálculo basado en distribución normal
        const zScore = (currentStock - (mean * leadTime / 30)) / (stdDev * Math.sqrt(leadTime / 30));

        // Función de distribución acumulativa inversa aproximada
        const t = 1 / (1 + 0.2316419 * Math.abs(zScore));
        const pd = 1 - 0.3989423 * Math.exp(-zScore * zScore / 2) *
            ((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.319381530) * t;

        return zScore < 0 ? (1 - pd) * 100 : pd * 100;
    }

    // 7. Formateo de fechas profesional
    function formatDate(dateString: string): string {
        if (!dateString) return "Fecha no definida";

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-ES', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }).replace(/,\s*/g, ' ');
        } catch {
            return dateString;
        }
    }

    // Funciones auxiliares
    const totalPages = Math.ceil((filteredPredictions?.length || 0) / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentPredictions = (filteredPredictions || []).slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

        // Forzar número entero
        const integerValue = Math.floor(value);

        return integerValue.toLocaleString('es-ES', {
            maximumFractionDigits: 0,  // Sin decimales
            useGrouping: true          // Con separadores de miles
        });
    };

    const formatFullDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
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
        <div className="flex items-center justify-center gap-4">
            <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 disabled:bg-slate-100 disabled:text-slate-400 transition-colors shadow-sm"
            >
                <FaChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 bg-sky-50 px-6 py-2 rounded-full mx-2">
                <span className="text-sm font-medium text-sky-700 whitespace-nowrap">
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
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-10 border border-[#EDEDED]">
            {/* Encabezado con logo */}
            <div className="text-center mb-10">
                <div className="flex flex-col items-center justify-center">
                    <img
                        src="/Logo_Kpital.jpg"
                        alt="Logo Kpital"
                        className="h-20 w-auto mb-1 object-contain"
                    />
                    <h2 className="font-gotham-medium text-[#0074CF] text-sm tracking-normal mt-0">
                        2020 - 2025
                    </h2>
                </div>
                <p className="font-gotham-regular text-[#0074CF] mt-3 text-lg">
                    Plataforma de Inteligencia Predictiva para Inventarios
                </p>
            </div>

            {/* Sección de requisitos */}
            <div className="mb-10 p-8 bg-[#EDEDED] rounded-xl border border-[#0074CF]/20">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-[#0074CF]/10 rounded-full">
                        <FaInfoCircle className="text-xl text-[#0074CF]" />
                    </div>
                    <h2 className="font-gotham-bold text-[#001A30] text-xl">
                        Especificaciones Técnicas del Archivo
                    </h2>
                </div>

                <ul className="space-y-3 pl-2">
                    {[
                        { field: "CODIGO", desc: "Identificador único del producto (texto alfanumérico)" },
                        { field: "DESCRIPCION", desc: "Nombre completo del producto (cadena de texto)" },
                        { field: "UNIDADES POR CAJA", desc: "Capacidad de unidades por empaque (valor entero)" },
                        { field: "STOCK TOTAL", desc: "Existencia actual en inventario (valor numérico)" },
                        { field: "HISTORICO DE CONSUMOS", desc: 'Registro histórico en formato JSON: {mes-anio: cantidad}' }
                    ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3">
                            <span className="inline-block w-2 h-2 mt-2.5 rounded-full bg-[#00B0F0] flex-shrink-0"></span>
                            <span className="font-gotham-regular text-[#001A30]">
                                <span className="font-gotham-medium">{item.field}:</span> {item.desc}
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
                        className="block font-gotham-medium text-[#001A30] text-sm mb-3"
                        whileHover={{ scale: 1.02 }}
                    >
                        Seleccione su archivo de datos:
                    </motion.label>

                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            id="excel-upload"
                            accept=".xlsx, .xls, .csv"
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
                                boxShadow: "0 10px 25px -5px rgba(0, 116, 207, 0.3)"
                            }}
                            whileTap={{ scale: 0.98 }}
                            className="flex-1 px-4 py-3.5 bg-gradient-to-r from-[#0074CF] to-[#003268] text-white rounded-xl flex items-center justify-center gap-3 cursor-pointer transition-all shadow-md"
                        >
                            <motion.div
                                whileHover={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 0.5 }}
                            >
                                <FaFileExcel className="text-xl" />
                            </motion.div>
                            <span className="font-gotham-medium">Seleccionar Archivo</span>
                        </motion.label>
                    </div>

                    {selectedFile && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-3 text-sm font-gotham-regular text-[#001A30] flex items-center gap-2 bg-[#EDEDED] p-3 rounded-lg border border-[#0074CF]/30"
                        >
                            <FaCheckCircle className="text-[#28a745] text-lg" />
                            <span>{selectedFile.name}</span>
                            <span className="text-[#0074CF] ml-auto text-xs">{Math.round(selectedFile.size / 1024)} KB</span>
                        </motion.div>
                    )}
                </div>

                {selectedFile && (
                    <motion.button
                        onClick={handleProcessFile}
                        whileHover={{
                            scale: 1.03,
                            boxShadow: "0 10px 25px -5px rgba(0, 116, 207, 0.4)"
                        }}
                        whileTap={{ scale: 0.97 }}
                        disabled={processing}
                        className="px-8 py-3.5 bg-gradient-to-r from-[#0074CF] to-[#003268] text-white rounded-xl flex items-center justify-center gap-3 transition-all shadow-md"
                    >
                        {processing ? (
                            <>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
                                />
                                <span className="font-gotham-medium">Procesando Datos...</span>
                            </>
                        ) : (
                            <>
                                <FaChartLine className="text-lg" />
                                <span className="font-gotham-medium">Generar Pronóstico</span>
                            </>
                        )}
                    </motion.button>
                )}
            </motion.div>
        </div>
    );

    const InventoryChart = ({ data, stockActual }: { data: Proyeccion[], stockActual: number }) => {
        const [chartView, setChartView] = useState<'semanal' | 'mensual'>('mensual');

        // Procesar datos para el gráfico
        const monthlyData = data.map(proyeccion => ({
            periodo: formatMes(proyeccion.mes),
            stock: proyeccion.stock_proyectado,
            min: proyeccion.punto_reorden,
            seguridad: proyeccion.stock_seguridad,
            consumo: proyeccion.consumo_mensual,
            fechaReposicion: proyeccion.fecha_reposicion
        }));

        // Convertir datos mensuales a semanas
        const weeklyData = data.flatMap(proyeccion => {
            const semanas = [];
            const consumoSemanal = proyeccion.consumo_mensual / 4;
            let stock = proyeccion.stock_proyectado + proyeccion.consumo_mensual;

            for (let i = 1; i <= 4; i++) {
                stock -= consumoSemanal;
                semanas.push({
                    semana: `Sem ${i} ${formatMes(proyeccion.mes)}`,
                    stock: Math.max(0, stock),
                    min: proyeccion.punto_reorden,
                    seguridad: proyeccion.stock_seguridad,
                    consumo: consumoSemanal
                });
            }
            return semanas;
        });

        return (
            <div className="bg-white p-4 rounded-lg border border-[#EDEDED] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-gotham-bold flex items-center gap-2 text-[#001A30]">
                        <FaChartLine className="text-[#0074CF]" />
                        Proyección de Stock - {chartView === 'semanal' ? 'Semanal' : 'Mensual'}
                    </h4>
                    <select
                        value={chartView}
                        onChange={(e) => setChartView(e.target.value as 'semanal' | 'mensual')}
                        className="px-3 py-1 border rounded-lg text-sm bg-white text-[#001A30] border-[#EDEDED] focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] font-gotham-regular"
                    >
                        <option value="mensual">Vista Mensual</option>
                        <option value="semanal">Vista Semanal</option>
                    </select>
                </div>

                {/* Instrucciones del gráfico */}
                <div className="mb-4 p-3 bg-[#EDEDED] rounded-lg border border-[#0074CF]/20">
                    <h5 className="text-sm font-gotham-bold text-[#001A30] mb-2 flex items-center gap-2">
                        <FaInfoCircle className="text-[#00B0F0]" />
                        Cómo interpretar este gráfico
                    </h5>
                    <ul className="text-xs font-gotham-light text-[#001A30] space-y-1">
                        <li className="flex items-start gap-2">
                            <span className="inline-block w-3 h-3 mt-0.5 rounded-full bg-[#0074CF] flex-shrink-0"></span>
                            <span className="text-sm">
                                <span className="font-gotham-medium">Área Azul:</span> Stock proyectado
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="inline-block w-3 h-3 mt-0.5 rounded-full bg-[#EF4444] flex-shrink-0"></span>
                            <span className="text-sm">
                                <span className="font-gotham-medium">Línea Roja:</span> Punto de reorden
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="inline-block w-3 h-3 mt-0.5 rounded-full bg-[#001A30] flex-shrink-0"></span>
                            <span className="text-sm">
                                <span className="font-gotham-medium">Línea Azul Oscuro:</span> Stock de seguridad
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="inline-block w-3 h-3 mt-0.5 rounded-full bg-[#10B981] flex-shrink-0"></span>
                            <span className="text-sm">
                                <span className="font-gotham-medium">Línea Verde:</span> Consumo {chartView === 'semanal' ? 'semanal' : 'mensual'}
                            </span>
                        </li>
                    </ul>
                </div>

                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartView === 'semanal' ? weeklyData : monthlyData}
                            margin={{ top: 20, right: 20, left: 30, bottom: 80 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#EDEDED" opacity={0.5} />
                            <XAxis
                                dataKey={chartView === 'semanal' ? 'semana' : 'periodo'}
                                angle={-45}
                                textAnchor="end"
                                tick={{
                                    fontSize: 12,
                                    fill: "#001A30",
                                    fontFamily: 'Gotham Regular'
                                }}
                                tickMargin={15}
                                interval={0}
                                height={60}
                            />
                            <YAxis
                                tick={{
                                    fill: "#001A30",
                                    fontSize: 12,
                                    fontFamily: 'Gotham Regular'
                                }}
                                label={{
                                    value: 'Unidades',
                                    angle: -90,
                                    position: 'insideLeft',
                                    fill: "#001A30",
                                    style: {
                                        fontSize: 13,
                                        fontFamily: 'Gotham Medium'
                                    }
                                }}
                            />
                            <Tooltip
                                formatter={(value: number, name: string) => {
                                    const formattedValue = formatNumber(Number(value));
                                    const metricNames = {
                                        stock: 'Stock Proyectado',
                                        min: 'Punto de Reorden',
                                        seguridad: 'Stock de Seguridad',
                                        consumo: chartView === 'semanal' ? 'Consumo Semanal' : 'Consumo Mensual'
                                    };

                                    return [
                                        <span className="font-gotham-medium">{formattedValue} unidades</span>,
                                        <span className="font-gotham-regular">{metricNames[name as keyof typeof metricNames] || name}</span>
                                    ];
                                }}
                                labelFormatter={(label) => (
                                    <span className="font-gotham-medium">
                                        {chartView === 'semanal' ? 'Semana:' : 'Mes:'} {label}
                                    </span>
                                )}
                                contentStyle={{
                                    backgroundColor: '#FFFFFF',
                                    border: '1px solid #EDEDED',
                                    borderRadius: '6px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    color: '#001A30',
                                    fontFamily: 'Gotham Regular',
                                    fontSize: '13px',
                                    padding: '8px 12px'
                                }}
                            />
                            <Legend
                                wrapperStyle={{
                                    paddingTop: 10,
                                    paddingBottom: 20,
                                    fontSize: '13px',
                                    color: '#001A30',
                                    fontFamily: 'Gotham Medium'
                                }}
                                layout="horizontal"
                                verticalAlign="top"
                                align="center"
                            />

                            {/* Stock Proyectado */}
                            <Line
                                type="monotone"
                                dataKey="stock"
                                stroke="#0074CF"
                                strokeWidth={3}
                                name="Stock Proyectado"
                                dot={{ fill: '#0074CF', strokeWidth: 1, r: 5 }}
                                activeDot={{ r: 7 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="stock"
                                fill="#00B0F0"
                                fillOpacity={0.15}
                                stroke="none"
                            />

                            {/* Punto de Reorden */}
                            <Line
                                type="monotone"
                                dataKey="min"
                                stroke="#EF4444"
                                strokeWidth={2.5}
                                strokeDasharray="5 3"
                                name="Punto de Reorden"
                                dot={{ fill: '#EF4444', strokeWidth: 1, r: 4 }}
                            />

                            {/* Stock de Seguridad */}
                            <Line
                                type="monotone"
                                dataKey="seguridad"
                                stroke="#001A30"
                                strokeWidth={2.5}
                                name="Stock de Seguridad"
                                dot={{ fill: '#001A30', strokeWidth: 1, r: 4 }}
                                strokeDasharray="4 2"
                            />

                            {/* Consumo */}
                            <Line
                                type="monotone"
                                dataKey="consumo"
                                stroke="#10B981"
                                strokeWidth={2.5}
                                name={`Consumo ${chartView === 'semanal' ? 'Semanal' : 'Mensual'}`}
                                dot={{ fill: '#10B981', strokeWidth: 1, r: 4 }}
                                strokeDasharray="3 3"
                            />

                            {/* Marcador de stock actual */}
                            {chartView === 'mensual' && monthlyData.length > 0 && (
                                <ReferenceLine
                                    x={monthlyData[0].periodo}
                                    stroke="#003268"
                                    strokeWidth={2.5}
                                    strokeDasharray="3 3"
                                    label={{
                                        value: `Stock Actual: ${formatNumber(stockActual)}`,
                                        position: 'top',
                                        fill: '#003268',
                                        fontSize: 12,
                                        fontFamily: 'Gotham Medium',
                                        offset: 10
                                    }}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const VariationChart = ({ data, colors = {
        positive: '#10B981', // verde
        negative: '#EF4444', // rojo
        neutral: '#6B7280'   // gris
    } }: VariationChartProps) => (
        <div className="bg-white p-4 rounded-lg border border-[#EDEDED] shadow-sm mt-4">
            <h4 className="text-lg font-gotham-bold mb-4 flex items-center gap-2 text-[#001A30]">
                <FaChartPie className="text-[#0074CF]" />
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
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={
                                        entry.variacion !== null
                                            ? entry.variacion > 0
                                                ? colors.positive
                                                : colors.negative
                                            : colors.neutral
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
                    `${API_URL}/predictions/${codigo}/transit`,
                    {
                        units: Number(transitUnits),
                        recalculateProjections: true,
                        updateFrequency: true
                    }
                );

                if (response.data.success) {
                    setSuccess(true);
                    setTransitUnits('');

                    const updatedResponse = await axios.get<PredictionData>(`${API_URL}/predictions/${codigo}`);
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
                            {selectedPrediction?.data.UNIDADES_TRANSITO || 0} unidades
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

    const TransitDaysControl = ({ codigo }: { codigo: string }) => {
        const [transitDays, setTransitDays] = useState<number | ''>('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [success, setSuccess] = useState(false);
        const inputRef = useRef<HTMLInputElement>(null);

        const handleApplyTransitDays = async () => {
            if (transitDays === '' || Number(transitDays) <= 0) {
                setError('Debe ingresar un número válido mayor a 0');
                inputRef.current?.focus();
                return;
            }

            try {
                setLoading(true);
                setError(null);
                setSuccess(false);

                const response = await axios.post<{
                    success: boolean;
                    data: ProductoData;
                    message?: string;
                }>(`${API_URL}/predictions/${codigo}/transit/days`, {
                    transitDays: Number(transitDays),
                    recalculateProjections: true,
                    transitDaysApplied: true // Enviar la bandera para marcar que los días fueron aplicados
                });

                if (response.data.success) {
                    setSuccess(true);
                    setTransitDays('');

                    // Actualizar el estado global con los nuevos datos
                    const updatedData = response.data.data;
                    setSelectedPrediction({
                        ...selectedPrediction!,
                        data: updatedData
                    });

                    setAllPredictions((prev: any[]) => prev.map(item =>
                        item.CODIGO === codigo ? updatedData : item
                    ));
                } else {
                    throw new Error(response.data.message || 'Error al aplicar días de tránsito');
                }
            } catch (err: any) {
                console.error('Error al aplicar días de tránsito:', err);
                setError(err.response?.data?.message || err.message || 'Error al aplicar días de tránsito');
            } finally {
                setLoading(false);
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleApplyTransitDays();
            }
        };

        // Calcular información derivada
        const consumoProyectado = selectedPrediction?.data.CONSUMO_DIARIO
            ? selectedPrediction.data.CONSUMO_DIARIO * (Number(transitDays) || 0)
            : 0;

        const fechaArribo = transitDays && selectedPrediction?.data.FECHA_INICIO
            ? new Date(new Date(selectedPrediction.data.FECHA_INICIO).setDate(
                new Date(selectedPrediction.data.FECHA_INICIO).getDate() + Number(transitDays)
            )).toLocaleDateString()
            : 'No aplica';

        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    <FaCalendarAlt className="text-blue-600" />
                    Configuración de Días de Tránsito
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                        <div className="text-xs text-blue-600 mb-1">Días de Tránsito Actuales</div>
                        <div className="text-xl font-bold text-blue-800">
                            {selectedPrediction?.data.CONFIGURACION.DIAS_TRANSITO || 0} días
                        </div>
                        <div className="text-xs text-blue-500 mt-1">
                            Configuración actual
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <label htmlFor="transit-days-input" className="block text-xs text-blue-600 mb-1">
                            Establecer Días de Tránsito
                        </label>
                        <input
                            id="transit-days-input"
                            ref={inputRef}
                            type="number"
                            min="1"
                            max="30"
                            value={transitDays}
                            onChange={(e) => {
                                const value = e.target.value;
                                setTransitDays(value === '' ? '' : Number(value));
                                setError(null);
                            }}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            placeholder="Ej: 7 días"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={handleApplyTransitDays}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors"
                        >
                            {loading ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    <FaCheck className="w-4 h-4" />
                                    Aplicar
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
                        Días de tránsito aplicados correctamente
                    </div>
                )}

                {transitDays && Number(transitDays) > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                            <div className="text-xs text-blue-600 mb-1">Fecha estimada de arribo</div>
                            <div className="text-sm font-medium text-blue-800 flex items-center gap-2">
                                <FaCalendarAlt />
                                {fechaArribo}
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                            <div className="text-xs text-blue-600 mb-1">Consumo proyectado durante tránsito</div>
                            <div className="text-sm font-medium text-blue-800 flex items-center gap-2">
                                <FaChartLine />
                                {formatNumber(consumoProyectado)} unidades
                                <span className="text-xs text-blue-500 ml-auto">
                                    ({selectedPrediction?.data.CONSUMO_DIARIO} uds/día)
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-3 text-xs text-blue-600">
                    <FaInfoCircle className="inline mr-1" />
                    Los días de tránsito afectarán las proyecciones de stock y fechas de reposición
                </div>
            </div>
        );
    };

    const TransitControl = ({ codigo }: { codigo: string }) => {
        const [transitUnits, setTransitUnits] = useState<number | ''>('');
        const [transitDays, setTransitDays] = useState<number | ''>('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [success, setSuccess] = useState(false);
        const unitsInputRef = useRef<HTMLInputElement>(null);
        const daysInputRef = useRef<HTMLInputElement>(null);

        const handleApplyTransit = async () => {
            // Validar ambos campos
            if (transitUnits === '' || Number(transitUnits) <= 0) {
                setError('Debe ingresar un número válido de unidades mayor a 0');
                unitsInputRef.current?.focus();
                return;
            }
            if (transitDays === '' || Number(transitDays) <= 0) {
                setError('Debe ingresar un número válido de días mayor a 0');
                daysInputRef.current?.focus();
                return;
            }

            try {
                setLoading(true);
                setError(null);
                setSuccess(false);

                // 1. Enviar unidades en tránsito
                const unitsResponse = await axios.post(
                    `${API_URL}/predictions/${codigo}/transit`,
                    {
                        units: Number(transitUnits),
                        recalculateProjections: true,
                        updateFrequency: true
                    }
                );

                if (!unitsResponse.data.success) {
                    throw new Error(unitsResponse.data.error || 'Error al agregar unidades en tránsito');
                }

                // 2. Enviar días de tránsito con la bandera transitDaysApplied
                const daysResponse = await axios.post<{
                    success: boolean;
                    data: ProductoData;
                    message?: string;
                }>(`${API_URL}/predictions/${codigo}/transit/days`, {
                    transitDays: Number(transitDays),
                    recalculateProjections: true,
                    transitDaysApplied: true // Enviar la bandera para marcar que los días fueron aplicados
                });

                if (!daysResponse.data.success) {
                    throw new Error(daysResponse.data.message || 'Error al aplicar días de tránsito');
                }

                // Actualizar estado global
                const updatedResponse = await axios.get<PredictionData>(`${API_URL}/predictions/${codigo}`);
                setSelectedPrediction(updatedResponse.data);

                setAllPredictions(prev => prev.map(item =>
                    item.CODIGO === codigo ? updatedResponse.data.data : item
                ));

                // Éxito
                setSuccess(true);
                setTransitUnits('');
                setTransitDays('');
            } catch (err: any) {
                console.error('Error:', err);
                setError(err.response?.data?.error || err.message || 'Error al aplicar configuración de tránsito');
            } finally {
                setLoading(false);
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleApplyTransit();
            }
        };

        // Calcular información derivada
        const consumoProyectado = selectedPrediction?.data.CONSUMO_DIARIO
            ? selectedPrediction.data.CONSUMO_DIARIO * (Number(transitDays) || 0)
            : 0;

        const fechaArribo = transitDays && selectedPrediction?.data.FECHA_INICIO
            ? new Date(new Date(selectedPrediction.data.FECHA_INICIO).setDate(
                new Date(selectedPrediction.data.FECHA_INICIO).getDate() + Number(transitDays)
            )).toLocaleDateString()
            : 'No aplica';

        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    <FaTruck className="text-blue-600" />
                    Configuración de Tránsito
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Valores actuales */}
                    <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                        <div className="text-xs text-blue-600 mb-1">Configuración Actual</div>
                        <div className="text-sm font-bold text-blue-800">
                            <div>Unidades: {selectedPrediction?.data.UNIDADES_TRANSITO || 0}</div>
                            <div>Días: {selectedPrediction?.data.CONFIGURACION.DIAS_TRANSITO || 0}</div>
                        </div>
                    </div>

                    {/* Input para unidades */}
                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <label htmlFor="transit-units-input" className="block text-xs text-blue-600 mb-1">
                            Unidades en Tránsito
                        </label>
                        <input
                            id="transit-units-input"
                            ref={unitsInputRef}
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

                    {/* Input para días */}
                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <label htmlFor="transit-days-input" className="block text-xs text-blue-600 mb-1">
                            Días de Tránsito
                        </label>
                        <input
                            id="transit-days-input"
                            ref={daysInputRef}
                            type="number"
                            min="1"
                            max="30"
                            value={transitDays}
                            onChange={(e) => {
                                const value = e.target.value;
                                setTransitDays(value === '' ? '' : Number(value));
                                setError(null);
                            }}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            placeholder="Ej: 7 días"
                            disabled={loading}
                        />
                    </div>

                    {/* Botón unificado */}
                    <div className="flex items-end">
                        <button
                            onClick={handleApplyTransit}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors"
                        >
                            {loading ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    <FaCheck className="w-4 h-4" />
                                    Aplicar
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Mensajes de error y éxito */}
                {error && (
                    <div className="mt-2 text-red-500 text-sm flex items-center gap-1">
                        <FaExclamationTriangle />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mt-2 text-green-600 text-sm flex items-center gap-1">
                        <FiCheckCircle />
                        Configuración de tránsito aplicada correctamente
                    </div>
                )}

                {/* Información derivada */}
                {transitDays && Number(transitDays) > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                            <div className="text-xs text-blue-600 mb-1">Fecha estimada de arribo</div>
                            <div className="text-sm font-medium text-blue-800 flex items-center gap-2">
                                <FaCalendarAlt />
                                {fechaArribo}
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                            <div className="text-xs text-blue-600 mb-1">Consumo proyectado durante tránsito</div>
                            <div className="text-sm font-medium text-blue-800 flex items-center gap-2">
                                <FaChartLine />
                                {formatNumber(consumoProyectado)} unidades
                                <span className="text-xs text-blue-500 ml-auto">
                                    ({selectedPrediction?.data.CONSUMO_DIARIO} uds/día)
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-3 text-xs text-blue-600">
                    <FaInfoCircle className="inline mr-1" />
                    La configuración de tránsito afecta las proyecciones de stock y fechas de reposición
                </div>
            </div>
        );
    };

    const Sidebar = () => {
        const [user, setUser] = useState<any>(null);
        const [activeComponent, setActiveComponent] = useState<string>('dashboard');
        const [showReports, setShowReports] = useState(false);

        useEffect(() => {
            const userData = localStorage.getItem('user');
            if (userData) {
                setUser(JSON.parse(userData));
            }
        }, []);



        return (
            <div className={`fixed inset-y-0 left-0 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-in-out z-40 w-64`}>
                <div className="flex flex-col items-center justify-center p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                        <FaChartLine className="text-[#0074CF] text-2xl" />
                        <span className="text-xl font-gotham-bold text-[#001A30] text-center">
                            Plannink<br />2020 - 2025
                        </span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="absolute top-4 right-4 text-[#0074CF] hover:text-[#001A30]"
                    >
                        <FaChevronLeft className="w-4 h-4" />
                    </button>
                </div>

                <UserProfile user={user} />

                <nav className="p-4">
                    <div className="space-y-1">
                        <a href="#" className="flex items-center space-x-3 p-2 rounded-lg bg-[#EDEDED] text-[#003268] font-gotham-medium">
                            <FaHome className="text-[#0074CF]" />
                            <span>Dashboard</span>
                        </a>
                        <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                            <FaWarehouse className="text-[#0074CF]" />
                            <span>Inventario</span>
                        </a>
                        <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                            <FaClipboardList className="text-[#0074CF]" />
                            <span>Órdenes</span>
                        </a>


                        <button
                            onClick={handleShowReports}
                            className={`flex items-center space-x-3 p-2 rounded-lg w-full text-left ${activeComponent === 'reports'
                                ? 'bg-[#EDEDED] text-[#003268]'
                                : 'text-[#001A30] hover:bg-[#EDEDED]'
                                } font-gotham-regular`}
                        >
                            <FaChartBar className="text-[#0074CF]" />
                            <span>Reportes</span>
                            {activeComponent === 'reports' && (
                                <span className="ml-auto bg-[#0074CF] text-white text-xs px-2 py-1 rounded-full">
                                    Nuevo
                                </span>
                            )}
                        </button>

                        <div className="space-y-1">
                            <motion.div
                                className="flex items-center justify-between p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular cursor-pointer"
                                onClick={toggleDocsMenu}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="flex items-center space-x-3">
                                    <motion.div
                                        animate={{ rotate: isDocsOpen ? 0 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <FaFileAlt className="text-[#0074CF]" />
                                    </motion.div>
                                    <span>Documentación</span>
                                </div>
                                <motion.div
                                    animate={{ rotate: isDocsOpen ? 0 : -90 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <FaChevronDown className="text-[#0074CF] w-3 h-3" />
                                </motion.div>
                            </motion.div>

                            <AnimatePresence>
                                {isDocsOpen && (
                                    <motion.ul
                                        initial="closed"
                                        animate="open"
                                        exit="closed"
                                        variants={menuVariants}
                                        className="ml-10 space-y-1 overflow-hidden"
                                    >
                                        <motion.li variants={itemVariants}>
                                            <Link href="/documentacion/manual" legacyBehavior>
                                                <motion.a
                                                    className="text-sm text-[#003268] hover:text-[#0074CF] flex items-center py-1"
                                                    whileHover={{ x: 5 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    📘 Manual de Usuario
                                                </motion.a>
                                            </Link>
                                        </motion.li>
                                        <motion.li variants={itemVariants}>
                                            <Link href="/documentacion/guia" legacyBehavior>
                                                <motion.a
                                                    className="text-sm text-[#003268] hover:text-[#0074CF] flex items-center py-1"
                                                    whileHover={{ x: 5 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    📗 Guía del Desarrollador
                                                </motion.a>
                                            </Link>
                                        </motion.li>
                                    </motion.ul>
                                )}
                            </AnimatePresence>
                        </div>

                        <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                            <FaExchangeAlt className="text-[#0074CF]" />
                            <span>Movimientos</span>
                        </a>
                        <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                            <FaCog className="text-[#0074CF]" />
                            <span>Configuración</span>
                        </a>
                    </div>

                    <div className="mt-8 pt-4 border-t border-gray-200">
                        <button
                            onClick={handleLogout}
                            className="flex items-center w-full space-x-3 p-2 rounded-lg text-red-600 hover:bg-red-50 font-gotham-regular transition-colors"
                        >
                            <FaSignOutAlt className="text-red-500" />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </nav>
            </div>
        );
    };

    const DetailModal = ({ onClose, selectedPrediction, refreshPredictions }: DetailModalProps) => {
        if (!selectedPrediction) return null;

        const producto = selectedPrediction.data;
        const stockActual = producto.STOCK_FISICO;
        const stockSeguridad = producto.STOCK_SEGURIDAD;
        const puntoReorden = producto.PUNTO_REORDEN;
        const status = getStockStatus(stockActual, stockSeguridad, puntoReorden);
        const diasCobertura = calculateDaysOfCoverage(stockActual, producto.CONSUMO_DIARIO);
        const consumoPromedio = producto.CONSUMO_PROMEDIO;
        const porcentajeSS = Math.round(stockSeguridad / consumoPromedio * 100);

        // Estado para manejar los días de tránsito por proyección
        const [transitDaysInputs, setTransitDaysInputs] = useState<{ [key: number]: number }>({});
        const [isApplyingDays, setIsApplyingDays] = useState<number | null>(null);
        const [projectionsWithDates, setProjectionsWithDates] = useState<Proyeccion[]>([]);
        const [isRefreshing, setIsRefreshing] = useState(false);
        const [notification, setNotification] = useState<string | null>(null);

        // Pagination state
        const [currentPage, setCurrentPage] = useState(1);
        const itemsPerPage = 5; // Number of projections per page
        const totalPages = Math.ceil(projectionsWithDates.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const currentProjections = projectionsWithDates.slice(startIndex, startIndex + itemsPerPage);

        useEffect(() => {
            if (selectedPrediction?.data?.PROYECCIONES) {
                const calculateProjectionDates = () => {
                    try {
                        const appliedMap = JSON.parse(localStorage.getItem('transitDaysMap') || '{}');

                        const projections = selectedPrediction.data.PROYECCIONES.map((proj, index) => {
                            let startDate = new Date(proj.fecha_inicio_proyeccion || selectedPrediction.data.FECHA_INICIO || Date.now());
                            if (isNaN(startDate.getTime())) {
                                console.warn(`Invalid start date for projection ${index}, using current date`);
                                startDate = new Date();
                            }

                            let endDate = proj.fecha_fin ? new Date(proj.fecha_fin) : addBusinessDays(startDate, proj.dias_transito || producto.CONFIGURACION.DIAS_LABORALES_MES);
                            if (isNaN(endDate.getTime())) {
                                console.warn(`Invalid end date for projection ${index}, using current date`);
                                endDate = new Date();
                            }

                            const localKey = `${selectedPrediction.data.CODIGO}_${index}`;

                            return {
                                ...proj,
                                fecha_inicio_proyeccion: startDate.toISOString().split('T')[0],
                                fecha_fin: endDate.toISOString().split('T')[0],
                                transitDaysApplied: appliedMap[localKey] || false // ✅ AQUÍ aplicamos la marca real
                            };
                        });

                        setProjectionsWithDates(projections);
                    } catch (error) {
                        console.error('Error calculating projection dates:', error);
                        setProjectionsWithDates(selectedPrediction.data.PROYECCIONES);
                    }
                };

                calculateProjectionDates();
            }
        }, [selectedPrediction]);


        const addBusinessDays = (startDate: Date, days: number) => {
            let date = new Date(startDate);
            if (isNaN(date.getTime())) {
                console.warn('Invalid date in addBusinessDays, using current date');
                date = new Date();
            }

            let addedDays = 0;
            while (addedDays < days) {
                date.setDate(date.getDate() + 1);
                if (date.getDay() !== 0 && date.getDay() !== 6) {
                    addedDays++;
                }
            }

            return date;
        };

        const handleApplyTransitDays = async (projectionIndex: number) => {
            const days = transitDaysInputs[projectionIndex];
            if (!days || days <= 0 || !Number.isInteger(days)) {
                setNotification('Por favor ingrese un número entero positivo de días');
                setTimeout(() => setNotification(null), 3000);
                return;
            }

            setIsApplyingDays(projectionIndex);
            setIsRefreshing(true);
            try {
                const response = await fetch(`${API_URL}/predictions/${producto.CODIGO}/projections/${projectionIndex}/transit-days`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ days, transitDaysApplied: true })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al aplicar días de tránsito');
                }

                const updatedProduct = await response.json();
                if (!updatedProduct || !Array.isArray(updatedProduct.PROYECCIONES)) {
                    console.error('Invalid PATCH response:', updatedProduct);
                    setNotification('Error: Respuesta inválida del servidor');
                    setTimeout(() => setNotification(null), 3000);
                    return;
                }

                // Mapear las proyecciones actualizadas, preservando los valores previos de transitDaysApplied
                const updatedProjections = updatedProduct.PROYECCIONES.map((proj: Proyeccion, index: number) => {
                    let startDate = new Date(proj.fecha_inicio_proyeccion || updatedProduct.FECHA_INICIO || Date.now());
                    if (isNaN(startDate.getTime())) {
                        startDate = new Date();
                    }

                    let endDate = proj.fecha_fin ? new Date(proj.fecha_fin) : addBusinessDays(startDate, proj.dias_transito || producto.CONFIGURACION.DIAS_LABORALES_MES);
                    if (isNaN(endDate.getTime())) {
                        endDate = new Date();
                    }

                    // Obtener el estado previo de la proyección para preservar transitDaysApplied
                    const prevProjection = projectionsWithDates[index] || {};

                    return {
                        ...proj,
                        fecha_inicio_proyeccion: startDate.toISOString().split('T')[0],
                        fecha_fin: endDate.toISOString().split('T')[0],
                        // Preservar transitDaysApplied del estado previo si no es la proyección que estamos actualizando
                        // Si es la proyección actualizada (projectionIndex), establecerlo como true
                        transitDaysApplied: index === projectionIndex
                            ? true
                            : (prevProjection.transitDaysApplied ?? proj.transitDaysApplied ?? false)
                    };
                });

                // Actualizar el estado con las proyecciones modificadas
                setProjectionsWithDates(updatedProjections);

                // Guardar en localStorage que esta proyección fue aplicada
                const localKey = `${producto.CODIGO}_${projectionIndex}`;
                const appliedMap = JSON.parse(localStorage.getItem('transitDaysMap') || '{}');
                appliedMap[localKey] = true;
                localStorage.setItem('transitDaysMap', JSON.stringify(appliedMap));


                // Limpiar el input después de aplicar
                setTransitDaysInputs(prev => {
                    const newInputs = { ...prev };
                    delete newInputs[projectionIndex];
                    return newInputs;
                });

                setNotification(`Días de tránsito (${days}) aplicados correctamente`);
                setTimeout(() => setNotification(null), 3000);
            } catch (error) {
                console.error('Error applying transit days:', error);
                setNotification('Error al aplicar días de tránsito');
                setTimeout(() => setNotification(null), 3000);
            } finally {
                setIsApplyingDays(null);
                setIsRefreshing(false);
            }
        };

        const handleClose = async () => {
            setIsRefreshing(true);
            try {
                await refreshPredictions();
            } finally {
                setIsRefreshing(false);
                onClose();
            }
        };

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
                                            {formatNumber(producto.STOCK_FISICO)} unidades
                                        </div>
                                        <div className="text-xs text-slate-500 flex flex-col">
                                            <span>Físico: {formatNumber(producto.STOCK_FISICO)}</span>
                                            {producto.UNIDADES_TRANSITO > 0 && (
                                                <span className="text-blue-600">Tránsito: {formatNumber(producto.UNIDADES_TRANSITO)}</span>
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

                            <AlertConfig
                                product={producto}
                                onConfigure={async (email, isManual = false) => {
                                    const response = await fetch(`${API_URL}/alertas/stock`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                                        },
                                        body: JSON.stringify({
                                            predictionData: selectedPrediction,
                                            email: email,
                                            isManual: isManual // Añadimos este parámetro
                                        })
                                    });

                                    if (!response.ok) {
                                        const error = await response.json();
                                        throw new Error(error.message || `Error al ${isManual ? 'reenviar' : 'enviar'} alerta por correo`);
                                    }

                                    return response.json();
                                }}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Contenedor de Umbrales Clave - Diseño Profesional */}
                                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3 text-indigo-700">
                                        <FaChartLine className="text-indigo-600" />
                                        <h4 className="text-sm font-semibold">Umbrales Clave</h4>
                                        <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                                            {producto.PROYECCIONES[0]?.mes || 'Proyección actual'}
                                        </span>
                                    </div>
                                    <div className="space-y-4">

                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-50 shadow-xs">
                                            <div className="bg-indigo-100 p-2 rounded-full">
                                                <FaChartBar className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-indigo-500">Consumo Mensual</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {formatNumber(producto.CONSUMO_PROMEDIO)} <span className="text-sm font-normal text-gray-500">unidades/mes</span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Promedio de los últimos {Object.keys(producto.HISTORICO_CONSUMOS).length} meses
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-50 shadow-xs">
                                            <div className="bg-indigo-100 p-2 rounded-full">
                                                <FaCalendarAlt className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-indigo-500">Consumo Diario</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {formatNumber(producto.CONSUMO_DIARIO, 2)} <span className="text-sm font-normal text-gray-500">unidades/día</span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Consumo Mensual ÷ {producto.CONFIGURACION.DIAS_LABORALES_MES} días
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
                                                    {formatNumber(producto.PROYECCIONES[0]?.punto_reorden || 0)}  <span className="text-sm font-normal text-gray-500">unidades</span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Consumo Diario × {producto.CONFIGURACION.DIAS_PUNTO_REORDEN} días de cobertura
                                                </div>
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
                                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                                            {producto.PROYECCIONES[0]?.fecha_inicio_proyeccion || 'Primer mes'}
                                        </span>
                                    </div>
                                    <div className="space-y-4">
                                        {/* Déficit Actual */}
                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                            <div className="bg-red-100 p-2 rounded-full">
                                                <FaExclamationTriangle className="text-red-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-red-500">Déficit Actual</div>
                                                <div className="text-lg font-bold text-gray-800">
                                                    {formatNumber(producto.PROYECCIONES[0]?.deficit || producto.DEFICIT)}
                                                    <span className="text-sm font-normal text-gray-500"> unidades</span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Punto de Reorden: {formatNumber(producto.PROYECCIONES[0]?.punto_reorden || producto.PUNTO_REORDEN)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cajas a Pedir */}
                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                            <div className="bg-amber-100 p-2 rounded-full">
                                                <FaBox className="text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-amber-600">Cajas a Pedir</div>
                                                <div className="text-xl font-bold text-gray-800">
                                                    {producto.PROYECCIONES[0]?.cajas_a_pedir || producto.CAJAS_A_PEDIR}
                                                    <span className="text-sm font-normal text-gray-500"> cajas</span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {producto.UNIDADES_POR_CAJA} unid./caja
                                                </div>
                                            </div>
                                        </div>

                                        {/* Unidades a Pedir */}
                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                            <div className="bg-emerald-100 p-2 rounded-full">
                                                <FaBoxOpen className="text-emerald-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-emerald-600">Unidades a Pedir</div>
                                                <div className="text-xl font-bold text-gray-800">
                                                    {formatNumber(producto.PROYECCIONES[0]?.unidades_a_pedir || producto.UNIDADES_A_PEDIR)}
                                                    <span className="text-sm font-normal text-gray-500"> unidades</span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {producto.PROYECCIONES[0]?.accion_requerida || "Stock suficiente"}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fechas de Reposición */}
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {/* Fecha de Solicitud */}
                                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                                <div className="bg-blue-100 p-2 rounded-full">
                                                    <FaFileInvoice className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-blue-600">Solicitar antes de</div>
                                                    <div className="text-sm font-bold text-gray-800">
                                                        {producto.PROYECCIONES[0]?.fecha_solicitud || "No aplica"}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Fecha de Arribo */}
                                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs">
                                                <div className="bg-purple-100 p-2 rounded-full">
                                                    <FaTruckLoading className="text-purple-600" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-purple-600">Llegará aproximadamente</div>
                                                    <div className="text-sm font-bold text-gray-800">
                                                        {producto.PROYECCIONES[0]?.fecha_arribo || "No aplica"}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Fecha de Reposición */}
                                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-50 shadow-xs md:col-span-2">
                                                <div className="bg-green-100 p-2 rounded-full">
                                                    <FaCalendarCheck className="text-green-600" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-green-600">Fecha Crítica de Reposición</div>
                                                    <div className="text-sm font-bold text-gray-800">
                                                        {producto.PROYECCIONES[0]?.fecha_reposicion || producto.FECHA_REPOSICION}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Lead time: {producto.CONFIGURACION.LEAD_TIME_REPOSICION} días
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Nota de Proyección */}
                                        <div className="text-xs text-gray-500 italic pt-2 border-t border-emerald-100">
                                            Basado en proyección de {producto.PROYECCIONES[0]?.fecha_inicio_proyeccion || 'próximo mes'}.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Proyección Mensual */}
                            <div className="space-y-6">
                                <div className="bg-white rounded-lg border border-[#EDEDED] shadow-sm">
                                    <div className="flex items-center justify-between p-4 border-b border-[#EDEDED]">
                                        <h4 className="text-lg font-gotham-bold text-[#001A30] flex items-center gap-2">
                                            <FaChartLine className="text-[#0074CF]" />
                                            Proyección Detallada
                                        </h4>
                                        <div className="text-xs text-[#00B0F0]">
                                            Fecha de cálculo: {new Date().toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="p-4 overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-[#EDEDED]">
                                                    <th className="text-left text-sm text-[#001A30] font-medium p-3">Período</th>
                                                    <th className="text-center text-sm text-[#001A30] font-medium p-3">Stock Inicial</th>
                                                    <th className="text-center text-sm text-[#001A30] font-medium p-3">Consumo</th>
                                                    <th className="text-center text-sm text-[#001A30] font-medium p-3">Stock Final</th>
                                                    <th className="text-center text-sm text-[#001A30] font-medium p-3">Días de Tránsito</th>
                                                    <th className="text-center text-sm text-[#001A30] font-medium p-3">Pedido Sugerido</th>
                                                    <th className="text-center text-sm text-[#001A30] font-medium p-3">Alerta</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {isRefreshing ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-4 text-center text-gray-500">
                                                            <FaSpinner className="animate-spin inline-block mr-2" />
                                                            Actualizando proyecciones...
                                                        </td>
                                                    </tr>
                                                ) : currentProjections.map((proyeccion, index) => {
                                                    const globalIndex = startIndex + index;
                                                    const stockInicial =
                                                        globalIndex === 0
                                                            ? producto.STOCK_FISICO
                                                            : projectionsWithDates[globalIndex - 1].stock_proyectado +
                                                            (projectionsWithDates[globalIndex - 1].unidades_a_pedir || 0);

                                                    const isStockCritical = proyeccion.stock_proyectado < proyeccion.stock_seguridad;
                                                    const hasPendingOrder = proyeccion.unidades_a_pedir > 0;
                                                    const isFirstProjection = globalIndex === 0;
                                                    const hasTransitDays = proyeccion.dias_transito && proyeccion.dias_transito > 0;

                                                    return (
                                                        <tr
                                                            key={globalIndex}
                                                            className={`border-t border-[#EDEDED] hover:bg-[#EDEDED]/50 ${proyeccion.transitDaysApplied
                                                                    ? 'bg-[#D1FAE5] border border-2 border-[#15803D]'
                                                                    : ''
                                                                }`}
                                                        >
                                                            <td className="p-3 text-sm text-[#001A30]">
                                                                <div className="font-medium">{proyeccion.mes}</div>
                                                                <div className="text-xs text-[#0074CF] flex flex-col gap-1 mt-1">
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <FaCalendarAlt className="text-xs" />
                                                                        Fecha De Solicitud: {proyeccion.fecha_inicio_proyeccion}
                                                                    </span>
                                                                    {proyeccion.fecha_fin && (
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <FaCalendarCheck className="text-xs" />
                                                                            Fecha De Arribo: {proyeccion.fecha_fin}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-center text-sm text-[#001A30] whitespace-nowrap">
                                                                <span title="Stock al inicio del período">
                                                                    {formatNumber(stockInicial)} <span className="text-xs text-[#0074CF]">unid.</span>
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center text-sm text-[#001A30] whitespace-nowrap">
                                                                {formatNumber(proyeccion.consumo_mensual)} <span className="text-xs text-[#0074CF]">unid.</span>
                                                                <div className="text-xs text-slate-500">
                                                                    {proyeccion.dias_transito ? `${proyeccion.dias_transito} días` : 'Período completo'}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-center text-sm text-[#001A30] font-medium whitespace-nowrap">
                                                                {formatNumber(proyeccion.stock_proyectado)} <span className="text-xs text-[#0074CF]">unid.</span>
                                                                <div
                                                                    className={`text-xs ${isStockCritical ? 'text-red-500' : proyeccion.alerta_stock ? 'text-amber-500' : 'text-green-500'
                                                                        }`}
                                                                >
                                                                    {isStockCritical ? 'Bajo stock de seguridad' : proyeccion.alerta_stock ? 'Alerta de stock' : 'Stock seguro'}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-center whitespace-nowrap">
                                                                {hasTransitDays && isFirstProjection ? (
                                                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                                                                        <FaCheck className="text-blue-500" />
                                                                        {proyeccion.dias_transito} días
                                                                    </span>
                                                                ) : (
                                                                    <div className="flex flex-col gap-2 items-center">
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            max={producto.CONFIGURACION.DIAS_LABORALES_MES}
                                                                            value={transitDaysInputs[globalIndex] || ''}
                                                                            onChange={(e) =>
                                                                                setTransitDaysInputs({
                                                                                    ...transitDaysInputs,
                                                                                    [globalIndex]: parseInt(e.target.value) || 0,
                                                                                })
                                                                            }
                                                                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                            placeholder="Días"
                                                                            disabled={isApplyingDays === globalIndex}
                                                                        />
                                                                        <button
                                                                            onClick={() => handleApplyTransitDays(globalIndex)}
                                                                            disabled={
                                                                                isApplyingDays === globalIndex ||
                                                                                !transitDaysInputs[globalIndex] ||
                                                                                transitDaysInputs[globalIndex] <= 0
                                                                            }
                                                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center gap-1 disabled:opacity-50"
                                                                        >
                                                                            {isApplyingDays === globalIndex ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                                                                            Aplicar
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center whitespace-nowrap">
                                                                {hasPendingOrder ? (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">
                                                                            <FaBox className="text-amber-600" />
                                                                            {proyeccion.cajas_a_pedir} cajas
                                                                        </span>
                                                                        <span className="text-xs text-blue-600">({formatNumber(proyeccion.unidades_a_pedir)} unid.)</span>
                                                                        {proyeccion.fecha_solicitud && proyeccion.fecha_solicitud !== 'No aplica' && (
                                                                            <span className="text-xs text-slate-500 mt-1">Solicitar: {proyeccion.fecha_solicitud}</span>
                                                                        )}
                                                                        {proyeccion.fecha_arribo && proyeccion.fecha_arribo !== 'No aplica' && (
                                                                            <span className="text-xs text-slate-500">Arribo: {proyeccion.fecha_arribo}</span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                                                                        <FaCheck className="text-green-500" />
                                                                        {proyeccion.accion_requerida}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {isStockCritical ? (
                                                                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
                                                                        <FiAlertTriangle className="w-3 h-3" />
                                                                        Crítico
                                                                    </span>
                                                                ) : proyeccion.alerta_stock ? (
                                                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">
                                                                        <FiAlertTriangle className="w-3 h-3" />
                                                                        Alerta
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                                                                        <FiCheckCircle className="w-3 h-3" />
                                                                        Normal
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {/* Add Pagination Component */}
                                {projectionsWithDates.length > 0 && (
                                    <ProjectionsPagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        setCurrentPage={setCurrentPage}
                                    />
                                )}
                            </div>

                        </div>
                    )}

                    {activeTab === 'grafico' && <InventoryChart
                        data={producto.PROYECCIONES}
                        stockActual={producto.STOCK_TOTAL}
                    />}

                    {activeTab === 'historico' && (
                        <div className="space-y-6">
                            {/* Tabla Horizontal de Consumos - Versión Profesional */}
                            <div className="bg-white rounded-lg border border-[#EDEDED] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-4 border-b border-[#EDEDED] bg-[#EDEDED]">
                                    <h4 className="text-lg font-gotham-bold text-[#001A30] flex items-center gap-2">
                                        <FaTable className="text-[#0074CF]" />
                                        Histórico de Consumos Mensuales
                                    </h4>
                                    <div className="text-xs font-gotham-light text-[#0074CF]">
                                        Últimos {Object.keys(producto.HISTORICO_CONSUMOS).length} meses
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-[#EDEDED]">
                                        <thead className="bg-[#EDEDED]">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-gotham-medium text-[#0074CF] uppercase tracking-wider">
                                                    Métrica
                                                </th>
                                                {Object.entries(producto.HISTORICO_CONSUMOS)
                                                    .sort(([mesA], [mesB]) => {
                                                        const [monthA, yearA] = mesA.split('-').map(Number);
                                                        const [monthB, yearB] = mesB.split('-').map(Number);
                                                        return new Date(yearA, monthA - 1).getTime() - new Date(yearB, monthB - 1).getTime();
                                                    })
                                                    .map(([mes]) => (
                                                        <th key={mes} scope="col" className="px-6 py-3 text-center text-xs font-gotham-medium text-[#0074CF] uppercase tracking-wider">
                                                            {formatMes(mes)}
                                                        </th>
                                                    ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-[#EDEDED]">
                                            {/* Fila de Consumos */}
                                            <tr className="hover:bg-[#EDEDED]/50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-5 w-5 text-[#0074CF]">
                                                            <FaBox />
                                                        </div>
                                                        <div className="ml-2">
                                                            <div className="text-sm font-gotham-medium text-[#001A30]">Consumo</div>
                                                            <div className="text-xs font-gotham-light text-[#0074CF]">Unidades</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {Object.entries(producto.HISTORICO_CONSUMOS)
                                                    .sort(([mesA], [mesB]) => {
                                                        const [monthA, yearA] = mesA.split('-').map(Number);
                                                        const [monthB, yearB] = mesB.split('-').map(Number);
                                                        return new Date(yearA, monthA - 1).getTime() - new Date(yearB, monthB - 1).getTime();
                                                    })
                                                    .map(([mes, valor]) => (
                                                        <td key={mes} className="px-6 py-4 whitespace-nowrap text-center">
                                                            <div className="text-sm font-gotham-medium text-[#001A30]">{formatNumber(valor)}</div>
                                                        </td>
                                                    ))}
                                            </tr>

                                            {/* Fila de Variación */}
                                            <tr className="hover:bg-[#EDEDED]/50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-5 w-5 text-[#00B0F0]">
                                                            <FaChartLine />
                                                        </div>
                                                        <div className="ml-2">
                                                            <div className="text-sm font-gotham-medium text-[#001A30]">Variación</div>
                                                            <div className="text-xs font-gotham-light text-[#0074CF]">vs mes anterior</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {Object.entries(producto.HISTORICO_CONSUMOS)
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
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gotham-medium ${variation > 0 ? 'bg-green-100 text-green-800' :
                                                                        variation < 0 ? 'bg-red-100 text-red-800' :
                                                                            'bg-[#EDEDED] text-[#001A30]'
                                                                        }`}>
                                                                        {variation > 0 ? '+' : ''}{formatNumber(variation, 1)}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gotham-medium bg-[#EDEDED] text-[#001A30]">
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
                            </div>

                            {/* Gráfico de Variación */}
                            <div className="bg-white rounded-lg border border-[#EDEDED] shadow-sm overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDEDED] bg-[#EDEDED]">
                                    <h4 className="text-base font-gotham-bold text-[#001A30] flex items-center gap-2">
                                        <div className="bg-[#00B0F0]/10 p-1.5 rounded-md">
                                            <FaChartLine className="text-[#00B0F0] text-sm" />
                                        </div>
                                        <span>Tendencia de Consumos</span>
                                    </h4>
                                </div>
                                <div className="flex-1 min-h-0 p-2">
                                    <div className="w-full h-full">
                                        <VariationChart
                                            data={variationData}
                                            colors={{
                                                positive: '#00B0F0',
                                                negative: '#0074CF',
                                                neutral: '#EDEDED'
                                            }}
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

    // Componente de Login
    const LoginForm = ({ onLogin }: { onLogin: () => void }) => {
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setLoading(true);
            setError('');

            try {
                const response = await axios.post(`${API_URL}/auth/login`, {
                    email,
                    password
                });

                const { token, user } = response.data;

                if (token) {
                    // Verificar en la base de datos
                    const verifyResponse = await axios.get(`${API_URL}/auth/email/${email}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    const userFromDB = verifyResponse.data;

                    if (!userFromDB || userFromDB.email !== email) {
                        setError('Usuario no encontrado en la base de datos.');
                        return;
                    }

                    // Verificar si hay usuario en localStorage
                    const userFromLocalStorage = localStorage.getItem('user');

                    if (!userFromLocalStorage) {
                        // El usuario existe en la BD pero no en el localStorage → lo sincronizamos
                        localStorage.setItem('user', JSON.stringify(userFromDB));
                        localStorage.setItem('token', token);
                        onLogin();
                        return;
                    }

                    const parsedLocalUser = JSON.parse(userFromLocalStorage);

                    // Comparar IDs o emails
                    if (parsedLocalUser.email !== userFromDB.email) {
                        setError('El usuario en localStorage no coincide con el de la base de datos.');
                        localStorage.removeItem('user');
                        localStorage.removeItem('token');
                        return;
                    }

                    // Todo bien, continuar
                    localStorage.setItem('token', token); // Actualizar si hace falta
                    localStorage.setItem('user', JSON.stringify(userFromDB));
                    onLogin();
                } else {
                    setError('Credenciales inválidas.');
                }

            } catch (err: any) {
                console.error('Login error:', err);
                setError(err.response?.data?.message || 'Error al iniciar sesión');
            } finally {
                setLoading(false);
            }
        };


        return (
            <div className="min-h-screen flex items-center justify-center bg-[#EDEDED] p-4">
                <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
                    {/* Header con gradiente corporativo */}
                    <div className="flex flex-col items-center p-6">
                        <img
                            src="/Logo_Kpital.jpg"
                            alt="Logo Kpital"
                            className="h-16 mb-3 object-contain"
                        />
                        <h1 className="text-2xl font-bold text-[#0074CF]">Iniciar Sesión</h1>
                        <p className="text-[#001A30] mt-1">Accede a tu cuenta de Plannink</p>
                    </div>

                    <div className="p-8">
                        {error && (
                            <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                                <FiAlertCircle />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-[#001A30] mb-1">
                                    Correo Electrónico
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FaUser className="text-[#0074CF]" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition"
                                        placeholder="tu@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-[#001A30] mb-1">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FaLock className="text-[#0074CF]" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        className="h-4 w-4 text-[#0074CF] focus:ring-[#0074CF] border-[#EDEDED] rounded"
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm text-[#001A30]">
                                        Recordarme
                                    </label>
                                </div>

                                <div className="text-sm">
                                    <Link href="/forgot-password" className="font-medium text-[#0074CF] hover:text-[#003268]">
                                        ¿Olvidaste tu contraseña?
                                    </Link>
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-gradient-to-r from-[#0074CF] to-[#003268] hover:from-[#0060b0] hover:to-[#002550] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00B0F0] transition-all"
                                >
                                    {loading ? (
                                        <>
                                            <FaSpinner className="animate-spin mr-2" />
                                            Procesando...
                                        </>
                                    ) : (
                                        'Iniciar Sesión'
                                    )}
                                </button>
                            </div>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-[#001A30]">
                                ¿No tienes una cuenta?{' '}
                                <button
                                    onClick={() => {
                                        setShowLogin(false);  // Oculta el formulario de login
                                        setShowRegister(true); // Muestra el formulario de registro
                                    }}
                                    className="font-medium text-[#0074CF] hover:text-[#003268]"
                                >
                                    Regístrate
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Componente de Registro
    const RegisterForm = ({ onRegister }: { onRegister: () => void }) => {
        const [nombre, setNombre] = useState('');
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [celular, setCelular] = useState('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');
        const [success, setSuccess] = useState(false);
        const router = useRouter();

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setLoading(true);
            setError('');

            // Validación básica
            if (!nombre || !email || !password || !celular) {
                setError('Todos los campos son requeridos');
                setLoading(false);
                return;
            }

            if (!email.includes('@')) {
                setError('Email inválido');
                setLoading(false);
                return;
            }

            if (!/^\d{10}$/.test(celular)) {
                setError('El número de celular debe tener exactamente 10 dígitos');
                setLoading(false);
                return;
            }

            try {
                const response = await axios.post(`${API_URL}/auth/register`, {
                    nombre,
                    email,
                    password,
                    celular
                });

                if (response.data.token) {
                    setSuccess(true);
                    // Guardar token y usuario
                    localStorage.setItem('token', response.data.token);
                    localStorage.setItem('user', JSON.stringify(response.data.user));

                    // Redirigir después de 2 segundos
                    setTimeout(() => {
                        onRegister();
                    }, 2000);
                }
            } catch (err: any) {
                console.error('Register error:', err);
                setError(err.response?.data?.message || 'Error al registrar usuario');
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="min-h-screen flex items-center justify-center bg-[#EDEDED] p-4">
                <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
                    {/* Header con gradiente corporativo */}
                    <div className="flex flex-col items-center p-6">
                        <img
                            src="/Logo_Kpital.jpg"
                            alt="Logo Kpital"
                            className="h-16 mb-3 object-contain"
                        />
                        <h1 className="text-2xl font-bold text-[#0074CF]">Crear Cuenta</h1>
                        <p className="text-[#001A30] mt-1">Únete a Plannink</p>
                    </div>

                    <div className="p-8">
                        {error && (
                            <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                                <FiAlertCircle />
                                <span>{error}</span>
                            </div>
                        )}

                        {success ? (
                            <div className="text-center py-8">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                    <FaCheck className="h-6 w-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-medium text-[#001A30] mb-2">
                                    ¡Registro exitoso!
                                </h3>
                                <p className="text-sm text-[#0074CF]">
                                    Serás redirigido al dashboard...
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="nombre" className="block text-sm font-medium text-[#001A30] mb-1">
                                        Nombre Completo
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FaUser className="text-[#0074CF]" />
                                        </div>
                                        <input
                                            id="nombre"
                                            name="nombre"
                                            type="text"
                                            required
                                            value={nombre}
                                            onChange={(e) => setNombre(e.target.value)}
                                            className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition"
                                            placeholder="Juan Pérez"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-[#001A30] mb-1">
                                        Correo Electrónico
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FaUser className="text-[#0074CF]" />
                                        </div>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition"
                                            placeholder="tu@email.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-[#001A30] mb-1">
                                        Contraseña
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FaLock className="text-[#0074CF]" />
                                        </div>
                                        <input
                                            id="password"
                                            name="password"
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-[#0074CF]">
                                        Mínimo 8 caracteres
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="celular" className="block text-sm font-medium text-[#001A30] mb-1">
                                        Número de Celular
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FaPhone className="text-[#0074CF]" />
                                        </div>
                                        <input
                                            id="celular"
                                            name="celular"
                                            type="tel"
                                            required
                                            value={celular}
                                            onChange={(e) => setCelular(e.target.value)}
                                            className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition"
                                            placeholder="0991234567"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-gradient-to-r from-[#0074CF] to-[#003268] hover:from-[#0060b0] hover:to-[#002550] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00B0F0] transition-all"
                                    >
                                        {loading ? (
                                            <>
                                                <FaSpinner className="animate-spin mr-2" />
                                                Registrando...
                                            </>
                                        ) : (
                                            'Registrarme'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="mt-6 text-center">
                            <p className="text-sm text-[#001A30]">
                                ¿Ya tienes una cuenta?{' '}
                                <button
                                    onClick={() => {
                                        setShowLogin(true);  // Oculta el formulario de login
                                        setShowRegister(false); // Muestra el formulario de registro
                                    }}
                                    className="font-medium text-[#0074CF] hover:text-[#003268]"
                                >
                                    Inicia Sesión
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false); // Actualizar estado de autenticación
        setShowLogin(true);
        setShowRegister(false);
    };


    // Componente de Barra de Búsqueda
    const SearchBar = () => {
        const inputRef = useRef<HTMLInputElement>(null);
        const [showSuggestions, setShowSuggestions] = useState(false);
        const [activeSuggestion, setActiveSuggestion] = useState(-1);

        useEffect(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, []);

        const getSuggestions = () => {
            if (!searchTerm) return [];

            return filteredPredictions
                .filter(producto =>
                    producto.CODIGO.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    producto.DESCRIPCION.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .slice(0, 5);
        };

        const suggestions = getSuggestions();

        const handleSuggestionClick = (producto: ProductoData) => {
            setSearchTerm(producto.CODIGO);
            setShowSuggestions(false);
            inputRef.current?.focus();
            handlePredict(producto.CODIGO);
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSearchTerm('');
                setShowSuggestions(false);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion(prev =>
                    prev > 0 ? prev - 1 : -1
                );
            } else if (e.key === 'Enter' && activeSuggestion >= 0) {
                e.preventDefault();
                handleSuggestionClick(suggestions[activeSuggestion]);
            }
        };

        return (
            <div className="relative w-full max-w-md mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                    placeholder="Buscar por código/nombre"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowSuggestions(true);
                        setActiveSuggestion(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {searchTerm && (
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            inputRef.current?.focus();
                            setShowSuggestions(false);
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                        <FaTimes className="text-gray-400 hover:text-gray-600" />
                    </button>
                )}

                {/* Panel de sugerencias */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        <ul>
                            {suggestions.map((producto, index) => (
                                <li
                                    key={producto.CODIGO}
                                    className={`px-4 py-2 hover:bg-blue-50 cursor-pointer ${index === activeSuggestion ? 'bg-blue-100' : ''
                                        }`}
                                    onClick={() => handleSuggestionClick(producto)}
                                    onMouseEnter={() => setActiveSuggestion(index)}
                                >
                                    <div className="font-medium text-gray-900">
                                        {highlightMatches(producto.CODIGO, searchTerm)}
                                    </div>
                                    <div className="text-sm text-gray-500 truncate">
                                        {highlightMatches(producto.DESCRIPCION, searchTerm)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {showSuggestions && searchTerm && suggestions.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-2 text-gray-500">
                        No se encontraron productos
                    </div>
                )}
            </div>
        );
    };

    // Componente UserProfile
    const UserProfile = ({ user }: { user: any }) => {
        return (
            <div className="flex flex-col items-center p-4 border-b border-gray-200">
                <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full bg-[#0074CF] flex items-center justify-center text-2xl font-bold text-white">
                        {user?.nombre?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="text-center">
                    <h3 className="font-gotham-medium text-[#001A30] text-lg">
                        {user?.nombre || 'Usuario'}
                    </h3>
                    <p className="text-sm text-[#0074CF] font-gotham-light truncate">
                        {user?.email || 'usuario@example.com'}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-1 text-sm text-[#001A30]">
                        <FaPhone className="text-[#00B0F0] text-sm" />
                        <span>{user?.celular || 'No registrado'}</span>
                    </div>
                </div>
            </div>
        );
    };

    // Si está cargando, mostrar spinner
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#EDEDED]">
                <FaSpinner className="animate-spin h-12 w-12 text-[#0074CF]" />
            </div>
        );
    }

    // Si no está autenticado, mostrar forms de login/registro
    if (!isAuthenticated) {
        return (
            // Si está en el estado de registro, muestra el formulario de registro
            showRegister ?
                <RegisterForm
                    onRegister={handleSuccessfulRegister}
                /> :
                // Si no está en el estado de registro, muestra el formulario de login
                <LoginForm
                    onLogin={handleSuccessfulLogin}
                />
        );
    }


    // Render principal
    return (
        <div className="flex h-screen bg-gray-50">
            <ToastContainer position="top-right" autoClose={3000} />

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

                    {showReports ? (
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                                    <FaChartBar className="text-blue-600" />
                                    Gestión de Reportes
                                </h1>
                                <button
                                    onClick={handleCloseReports}
                                    className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                                    title="Volver al dashboard"
                                >
                                    <FaTimes className="w-5 h-5" />
                                </button>
                            </div>
                            <ReportsSection />
                        </div>
                    ) : (
                        !excelSubido || allPredictions.length === 0 ? (
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
                                            Gestión inteligente de stock y proyecciones de la demanda
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            const productosAEnviar = allPredictions
                                                .filter(p => p.PROYECCIONES?.[0]?.cajas_a_pedir > 0)
                                                .map(p => ({
                                                    ...p,
                                                    CAJAS_A_PEDIR: p.PROYECCIONES[0].cajas_a_pedir,
                                                    UNIDADES_A_PEDIR: p.PROYECCIONES[0].unidades_a_pedir
                                                    //PRECIO_UNITARIO: p.PROYECCIONES[0].precio_unitario || 0
                                                }));

                                            generateOrderPDF(productosAEnviar);
                                        }}
                                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-2xl font-medium text-sm transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                        <span>Generar Orden de Pedidos</span>
                                    </button>



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
                                    <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 rounded-t-xl">
                                        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
                                            <div className="flex items-center gap-2">
                                                <FaBoxOpen className="text-sky-600 text-xl" />
                                                <h2 className="text-xl font-semibold text-slate-700 whitespace-nowrap">
                                                    Productos Analizados
                                                    <span className="text-slate-500 font-normal ml-1">({filteredPredictions.length})</span>
                                                </h2>
                                            </div>
                                            <span className="text-sm text-slate-500 md:ml-2">
                                                Archivo: <span className="font-medium">{currentExcel}</span>
                                            </span>
                                        </div>

                                        <div className="w-full md:w-auto flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                                            <div className="flex-grow md:w-64">
                                                <SearchBar />
                                            </div>
                                            <div className="flex-shrink-0">
                                                <PaginationControls />
                                            </div>
                                        </div>
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
                                                {currentPredictions.length > 0 ? (
                                                    currentPredictions.map((producto) => {
                                                        const stockTotal = producto.STOCK_FISICO
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
                                                                    {highlightMatches(producto.CODIGO, searchTerm)}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                                                                    {highlightMatches(producto.DESCRIPCION, searchTerm)}
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
                                                                            {formatNumber(producto.STOCK_FISICO)} unid.
                                                                        </span>
                                                                        <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                                                            <span className="flex items-center">
                                                                                <FaBox className="mr-1" />
                                                                                {formatNumber(producto.STOCK_FISICO)}
                                                                            </span>
                                                                            {producto.UNIDADES_TRANSITO > 0 && (
                                                                                <span className="flex items-center text-blue-600">
                                                                                    <FaTruck className="mr-1" />
                                                                                    +{formatNumber(producto.UNIDADES_TRANSITO)}
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
                                                                    {producto.PROYECCIONES[0]?.cajas_a_pedir > 0 ? (
                                                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium shadow-sm">
                                                                            {producto.PROYECCIONES[0]?.cajas_a_pedir} cajas
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
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                                            {searchTerm ? (
                                                                <div className="flex flex-col items-center justify-center gap-2">
                                                                    <FaSearch className="text-gray-400 text-2xl" />
                                                                    <span>No se encontraron productos que coincidan con <strong>"{searchTerm}"</strong></span>
                                                                    <button
                                                                        onClick={() => setSearchTerm('')}
                                                                        className="mt-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                                                                    >
                                                                        Limpiar búsqueda
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center gap-2">
                                                                    <FaBoxOpen className="text-gray-400 text-2xl" />
                                                                    <span>No hay productos disponibles</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ))};
                </main>
            </div>
        </div>
    );
};

export default Dashboard;