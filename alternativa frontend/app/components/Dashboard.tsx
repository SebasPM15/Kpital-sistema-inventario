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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, Area, ReferenceLine } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'framer-motion';
import { Chart, LinearScale, CategoryScale, LineController, PointElement, LineElement, Title } from 'chart.js';
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
                const response = await axios.get(`${API_URL}/predictions`);

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
    
        try {
            const pdf = new jsPDF('p', 'mm', 'a4') as jsPDF & { lastAutoTable?: { finalY: number } };
    
            // Configuración de márgenes y espacios
            const margin = {
                left: 15,
                right: 15,
                top: 20,
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
    
            // --- ENCABEZADO CON LOGO ---
            const logoData = await getBase64ImageFromURL('/Logo_Kpital.jpg') as string;
    
            // Logo centrado
            const logoWidth = 50;
            const logoHeight = 20;
            const logoX = (pageWidth - logoWidth) / 2;
            const logoY = margin.top;
    
            pdf.addImage(logoData, 'JPEG', logoX, logoY, logoWidth, logoHeight);
    
            // Título principal debajo del logo
            pdf.setFontSize(14);
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
            pdf.setFontSize(12);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.text('1. RESUMEN EJECUTIVO', margin.left, currentY);
            currentY += 8;
    
            const status = getStockStatus(
                selectedPrediction.data.STOCK_TOTAL,
                selectedPrediction.data.STOCK_SEGURIDAD,
                selectedPrediction.data.PUNTO_REORDEN
            );
    
            let statusMessage = '';
            let statusColor: [number, number, number] = oceanBlue;
            let statusIcon = '';
    
            if (status === 'danger') {
                statusMessage = 'NIVEL CRÍTICO';
                statusColor = [220, 53, 69];
                statusIcon = '⚠';
            } else if (status === 'warning') {
                statusMessage = 'NIVEL BAJO';
                statusColor = [255, 193, 7];
                statusIcon = '⚠';
            } else {
                statusMessage = 'NIVEL ÓPTIMO';
                statusColor = [40, 167, 69];
                statusIcon = '✓';
            }
    
            // Etiqueta de estado con ícono (usando texto simple en lugar de emoji)
            pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
            pdf.roundedRect(margin.left, currentY + 5, 50, 8, 3, 3, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.text(`${statusMessage}`, margin.left + 5, currentY + 10);
    
            // Texto descriptivo del estado
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            const statusDescription = status === 'danger' 
                ? 'Se requiere acción inmediata para reponer stock'
                : status === 'warning'
                ? 'Monitorear estrechamente el inventario'
                : 'El inventario se encuentra en niveles adecuados';
    
            pdf.text(statusDescription, margin.left + 55, currentY + 10);
    
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
    
            // --- ANÁLISIS DETALLADO ---
            currentY = (pdf.lastAutoTable?.finalY || currentY) + 15;
            checkPageBreak(60);
            pdf.setFontSize(12);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.text('2. ANÁLISIS DETALLADO', margin.left, currentY);
            currentY += 10;
    
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            
            const analysisText = [
                `El análisis muestra que el producto ${selectedPrediction.data.CODIGO} tiene un consumo promedio de ${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)} unidades mensuales, equivalente a ${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} unidades por día.`,
                `El stock de seguridad está calculado en ${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} unidades (${porcentajeSS}% del consumo mensual), proporcionando un colchón para fluctuaciones en la demanda.`
            ];
    
            analysisText.forEach(text => {
                const splitText = pdf.splitTextToSize(text, contentWidth);
                splitText.forEach((line: string | string[]) => {
                    checkPageBreak(6);
                    pdf.text(line, margin.left, currentY);
                    currentY += 6;
                });
            });
    
            // Fórmulas destacadas
            checkPageBreak(25);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.text('Cálculos Clave:', margin.left, currentY);
            currentY += 8;
    
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);
            
            const formulas = [
                `• Stock Mínimo = Consumo Mensual + Stock Seguridad`,
                `  ${selectedPrediction.data.CONSUMO_PROMEDIO.toFixed(0)} + ${selectedPrediction.data.STOCK_SEGURIDAD.toFixed(0)} = ${selectedPrediction.data.STOCK_MINIMO.toFixed(0)} unidades`,
                `• Punto de Reorden = Consumo Diario × 44 días`,
                `  ${selectedPrediction.data.CONSUMO_DIARIO.toFixed(2)} × 44 = ${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)} unidades`
            ];
    
            formulas.forEach(formula => {
                checkPageBreak(6);
                pdf.text(formula, margin.left + (formula.startsWith('•') ? 0 : 10), currentY);
                currentY += 6;
            });
    
            // Espacio adicional antes de la siguiente sección
            currentY += 10;
    
            // --- RECOMENDACIONES ---
            checkPageBreak(35);
            pdf.setFontSize(12);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.text('3. RECOMENDACIONES', margin.left, currentY);
            currentY += 12;
    
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            
            const recommendations = [
                `Ordenar ${selectedPrediction.data.CAJAS_A_PEDIR} cajas (${selectedPrediction.data.UNIDADES_A_PEDIR} unidades) lo antes posible`,
                `Fecha sugerida de pedido: ${new Date().toLocaleDateString()}`,
                `Fecha estimada de reposición: ${selectedPrediction.data.FECHA_REPOSICION}`,
                `Justificación: Stock actual (${selectedPrediction.data.STOCK_TOTAL.toFixed(0)}u) bajo punto de reorden (${selectedPrediction.data.PUNTO_REORDEN.toFixed(0)}u)`,
                `Tiempo de cobertura actual: ${selectedPrediction.data.DIAS_COBERTURA} días`,
                `Frecuencia sugerida de reposición: Cada ${selectedPrediction.data.PROYECCIONES[0]?.frecuencia_reposicion || 30} días`
            ];
    
            recommendations.forEach(rec => {
                checkPageBreak(7);
                pdf.setFillColor(oceanBlue[0], oceanBlue[1], oceanBlue[2]);
                pdf.circle(margin.left + 3, currentY - 1, 1.5, 'F');
                pdf.text(` ${rec}`, margin.left + 8, currentY);
                currentY += 7;
            });
    
            // --- GRÁFICO DE PREDICCIONES ---
            checkPageBreak(160);
            currentY += 15;
            pdf.setFontSize(12);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.text('4. GRÁFICO DE PREDICCIONES', margin.left, currentY);
            currentY += 12;
    
            // Agregar leyenda explicativa antes del gráfico
            const leyendaGrafico = [
                "Leyenda:",
                "• Línea Azul: Stock proyectado (disminuye con el consumo)",
                "• Línea Cian: Stock de seguridad (nivel mínimo requerido)",
                "• Línea Azul Oscuro: Punto de reorden (nivel para realizar pedido)",
                "• Línea Verde: Stock actual (nivel actual de inventario)"
            ];

            leyendaGrafico.forEach((linea, index) => {
                checkPageBreak(6);
                pdf.setFontSize(index === 0 ? 10 : 9);
                pdf.setTextColor(index === 0 ? darkBlue[0] : 0, index === 0 ? darkBlue[1] : 0, index === 0 ? darkBlue[2] : 0);
                pdf.text(linea, margin.left, currentY + 6 + (index * 5));
            });

            currentY += 6 + (leyendaGrafico.length * 5) + 10;

            // Crear canvas oculto en el DOM con mayor tamaño
            const canvas = document.createElement('canvas');
            canvas.width = 1000;  // Aumentado para mejor calidad
            canvas.height = 600;   // Aumentado para mejor calidad
            canvas.style.display = 'none';
            document.body.appendChild(canvas);
    
            // Generar el gráfico con colores corporativos y leyendas
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const proyecciones = selectedPrediction.data.PROYECCIONES;
                const meses = proyecciones.map(p => p.mes);
                const stockProyectado = proyecciones.map(p => p.stock_proyectado);
                const stockSeguridad = proyecciones.map(p => p.stock_seguridad);
                const puntoReorden = proyecciones.map(p => p.punto_reorden);
    
                // Configuración del gráfico con estilos mejorados
                const chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: meses,
                        datasets: [
                            {
                                label: 'Stock Proyectado',
                                data: stockProyectado,
                                borderColor: `rgb(${oceanBlue.join(',')})`,
                                backgroundColor: `rgba(${oceanBlue.join(',')}, 0.2)`,
                                tension: 0.1,
                                fill: true,
                                borderWidth: 3
                            },
                            {
                                label: 'Stock de Seguridad',
                                data: stockSeguridad,
                                borderColor: `rgb(${cyan.join(',')})`,
                                backgroundColor: `rgba(${cyan.join(',')}, 0.2)`,
                                borderDash: [5, 5],
                                tension: 0.1,
                                borderWidth: 2
                            },
                            {
                                label: 'Punto de Reorden',
                                data: puntoReorden,
                                borderColor: `rgb(${primaryBlue.join(',')})`,
                                backgroundColor: `rgba(${primaryBlue.join(',')}, 0.2)`,
                                borderDash: [5, 5],
                                tension: 0.1,
                                borderWidth: 2
                            },
                            {
                                label: 'Stock Actual',
                                data: Array(meses.length).fill(selectedPrediction.data.STOCK_TOTAL),
                                borderColor: '#10B981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                borderWidth: 2,
                                borderDash: [6, 6],
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            duration: 0
                        },
                        plugins: {
                            title: {
                                display: true,
                                text: 'Proyección de Stock Mensual',
                                font: {
                                    size: 20,
                                    family: 'Helvetica',
                                    weight: 'bold'
                                },
                                color: `rgb(${darkBlue.join(',')})`,
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
                                        family: 'Helvetica',
                                        weight: 'bold'
                                    },
                                    padding: 30,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    boxWidth: 12
                                }
                            },
                            tooltip: {
                                bodyFont: {
                                    size: 14,
                                    family: 'Helvetica'
                                },
                                titleFont: {
                                    size: 16,
                                    family: 'Helvetica',
                                    weight: 'bold'
                                }
                            }
                        },
                        scales: {
                            y: {
                                type: 'linear',
                                beginAtZero: false,
                                title: {
                                    display: true,
                                    text: 'Unidades',
                                    font: {
                                        size: 16,
                                        family: 'Helvetica',
                                        weight: 'bold'
                                    }
                                },
                                ticks: {
                                    font: {
                                        size: 14,
                                        family: 'Helvetica'
                                    },
                                    padding: 10
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)',
                                    lineWidth: 1
                                }
                            },
                            x: {
                                type: 'category',
                                ticks: {
                                    font: {
                                        size: 14,
                                        family: 'Helvetica'
                                    },
                                    padding: 10
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.05)',
                                    lineWidth: 1
                                }
                            }
                        }
                    }
                });
    
                await new Promise(resolve => setTimeout(resolve, 500));
    
                try {
                    const chartImage = canvas.toDataURL('image/png', 1.0);
                    
                    if (chartImage && chartImage.startsWith('data:image/png')) {
                        const imgWidth = contentWidth;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        
                        checkPageBreak(imgHeight + 15);
                        pdf.addImage(chartImage, 'PNG', margin.left, currentY, imgWidth, imgHeight);
                        currentY += imgHeight + 15;
                    }
                } finally {
                    // Limpiar
                    chart.destroy();
                    document.body.removeChild(canvas);
                }
            }
    
            // --- PROYECCIÓN MENSUAL (TABLA CENTRADA) ---
            checkPageBreak(40);
            pdf.setFontSize(12);
            pdf.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
            pdf.text('5. PROYECCIÓN MENSUAL', margin.left, currentY);
            currentY += 12;
    
            const proyeccionData = selectedPrediction.data.PROYECCIONES.map(proyeccion => {
                // Usar texto simple para alertas en lugar de emojis
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
    
            // Tabla centrada con márgenes
            const tableWidth = 150;
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
                    fontSize: 9
                },
                bodyStyles: {
                    textColor: 50,
                    halign: 'center',
                    fontSize: 9,
                    cellPadding: 4
                },
                alternateRowStyles: {
                    fillColor: smokeColor
                },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'left' },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 18 },
                    4: { cellWidth: 15 },
                    5: { cellWidth: 30, halign: 'left' },
                    6: { 
                        cellWidth: 20,
                        halign: 'center',
                        fontStyle: 'bold',
                    }
                },
                styles: {
                    fontSize: 9,
                    cellPadding: 3,
                    overflow: 'linebreak',
                    lineColor: [200, 200, 200]
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
            const response = await axios.get<PredictionData>(`${API_URL}/predictions/${codigo}`);

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
                        { field: "UNIDADES_POR_CAJA", desc: "Capacidad de unidades por empaque (valor entero)" },
                        { field: "STOCK_TOTAL", desc: "Existencia actual en inventario (valor numérico)" },
                        { field: "HISTORICO_CONSUMOS", desc: 'Registro histórico en formato JSON: {"MES-AÑO": cantidad}' }
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
                            <span className="text-[#0074CF] ml-auto text-xs">{Math.round(selectedFile.size/1024)} KB</span>
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
                            <span className="inline-block w-3 h-3 mt-0.5 rounded-full bg-[#7C3AED] flex-shrink-0"></span>
                            <span className="text-sm">
                                <span className="font-gotham-medium">Línea Morada:</span> Stock de seguridad
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
                            {chartView === 'mensual' && (
                                <Line
                                    type="monotone"
                                    dataKey="seguridad"
                                    stroke="#7C3AED"
                                    strokeWidth={2.5}
                                    name="Stock de Seguridad"
                                    dot={{ fill: '#7C3AED', strokeWidth: 1, r: 4 }}
                                    strokeDasharray="4 2"
                                />
                            )}
                            
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
                    { units: Number(transitUnits) }
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
            <div className="flex flex-col items-center justify-center p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                    <FaChartLine className="text-[#0074CF] text-2xl" />
                    <span className="text-xl font-gotham-bold text-[#001A30] text-center">
                        Plannink<br/>2020 - 2025
                    </span>
                </div>
                <button
                    onClick={() => setSidebarOpen(false)}
                    className="absolute top-4 right-4 text-[#0074CF] hover:text-[#001A30]"
                >
                    <FaChevronLeft className="w-4 h-4" />
                </button>
            </div>
    
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
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                        <FaChartBar className="text-[#0074CF]" />
                        <span>Reportes</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                        <FaFileAlt className="text-[#0074CF]" />
                        <span>Documentación</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                        <FaExchangeAlt className="text-[#0074CF]" />
                        <span>Movimientos</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                        <FaUser className="text-[#0074CF]" />
                        <span>Usuarios</span>
                    </a>
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                        <FaCog className="text-[#0074CF]" />
                        <span>Configuración</span>
                    </a>
                </div>
    
                <div className="mt-8 pt-4 border-t border-gray-200">
                    <a href="#" className="flex items-center space-x-3 p-2 rounded-lg text-[#001A30] hover:bg-[#EDEDED] font-gotham-regular">
                        <FaSignOutAlt className="text-[#0074CF]" />
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
                                                    {formatNumber(producto.PUNTO_REORDEN)} <span className="text-sm font-normal text-gray-500">unidades</span>
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
                                                <div className="text-xs text-slate-500">
                                                    Punto de Reorden - Stock Total (Físico + Tránsito)
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
                            <div className="bg-white rounded-lg border border-[#EDEDED] shadow-sm">
                                <div className="flex items-center justify-between p-4 border-b border-[#EDEDED]">
                                    <h4 className="text-lg font-gotham-bold text-[#001A30] flex items-center gap-2">
                                        <FaChartLine className="text-[#0074CF]" />
                                        Proyección Mensual Detallada
                                    </h4>
                                    <div className="text-xs font-gotham-light text-[#0074CF]">
                                        Fecha de cálculo: {new Date().toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="p-4 overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-[#EDEDED]">
                                                <th className="text-left text-sm text-[#001A30] font-gotham-medium p-3">Mes / Fecha Reposición</th>
                                                <th className="text-center text-sm text-[#001A30] font-gotham-medium p-3">Consumo Promedio</th>
                                                <th className="text-center text-sm text-[#001A30] font-gotham-medium p-3">Stock Proyectado</th>
                                                <th className="text-center text-sm text-[#001A30] font-gotham-medium p-3">Stock Seguridad</th>
                                                <th className="text-center text-sm text-[#001A30] font-gotham-medium p-3">Punto Reorden</th>
                                                <th className="text-center text-sm text-[#001A30] font-gotham-medium p-3">Acción Requerida</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {producto.PROYECCIONES.map((proyeccion, index) => {
                                                const isReposicionMonth = proyeccion.fecha_reposicion === producto.FECHA_REPOSICION;
                                                
                                                return (
                                                    <tr key={index} className="border-t border-[#EDEDED] hover:bg-[#EDEDED]/50">
                                                        <td className="p-3 text-sm text-[#001A30] font-gotham-regular">
                                                            <div>
                                                                {formatFullDate(proyeccion.fecha_reposicion)}
                                                                {isReposicionMonth && (
                                                                    <div className="text-xs text-[#00B0F0] font-gotham-light mt-1">
                                                                        Reposición estimada
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center text-sm text-[#001A30] font-gotham-regular">
                                                            {formatNumber(proyeccion.consumo_mensual)} <span className="text-xs text-[#0074CF]">unid.</span>
                                                        </td>
                                                        <td className="p-3 text-center text-sm text-[#001A30] font-gotham-regular">
                                                            {formatNumber(proyeccion.stock_proyectado)} <span className="text-xs text-[#0074CF]">unid.</span>
                                                        </td>
                                                        <td className="p-3 text-center text-sm text-[#001A30] font-gotham-regular">
                                                            {formatNumber(proyeccion.stock_seguridad)} <span className="text-xs text-[#0074CF]">unid.</span>
                                                        </td>
                                                        <td className="p-3 text-center text-sm text-[#001A30] font-gotham-regular">
                                                            {formatNumber(proyeccion.punto_reorden)} <span className="text-xs text-[#0074CF]">unid.</span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {proyeccion.cajas_a_pedir > 0 ? (
                                                                <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-gotham-medium">
                                                                    <FiAlertTriangle className="w-3 h-3" />
                                                                    Pedir {proyeccion.cajas_a_pedir} cajas
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-gotham-medium">
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