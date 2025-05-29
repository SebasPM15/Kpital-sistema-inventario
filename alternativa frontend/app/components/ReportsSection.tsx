"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaFileAlt, FaSpinner, FaSearch, FaTimes, FaEye, FaFileDownload } from 'react-icons/fa';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const API_URL = 'https://kpital-sistema-inventario-backend-ia.onrender.com/api';

interface Report {
    id: number;
    filename: string;
    url: string;
    createdAt: string;
    User: {
        id: number;
        nombre: string;
        email: string;
        celular: string;
    };
    Product?: {
        code: string;
        description: string;
        totalStock: number;
        reorderPoint: number;
        unitsToOrder: number;
    };
    content?: string;
}

const ReportsSection = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [reportContent, setReportContent] = useState<string>('');
    const [contentLoading, setContentLoading] = useState(false);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await axios.get(`${API_URL}/reports`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                });

                if (response.data?.success) {
                    setReports(response.data.data || []);
                } else {
                    throw new Error('Respuesta inesperada del servidor');
                }
            } catch (err: any) {
                console.error('Error fetching reports:', err);
                setError(
                    err.response?.data?.message ||
                    err.message ||
                    'Error al cargar los reportes'
                );
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, []);

    const handleViewReport = async (report: Report) => {
        try {
            setContentLoading(true);
            setSelectedReport(report);
            
            const response = await axios.get(`${API_URL}/reports/${report.id}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.data?.success) {
                setReportContent(response.data.data.content || 'Contenido no disponible');
            } else {
                throw new Error('No se pudo obtener el contenido del reporte');
            }
        } catch (err: any) {
            console.error('Error fetching report content:', err);
            setReportContent('Error al cargar el contenido del reporte');
        } finally {
            setContentLoading(false);
        }
    };

    const filteredReports = reports.filter((report) =>
        report.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.Product && report.Product.code?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (report.Product && report.Product.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const formatDate = (dateString: string) => {
        return format(new Date(dateString), 'PPPpp', { locale: es });
    };

    const generateDownloadContent = (report: Report) => {
        if (reportContent) return reportContent;
        
        const date = new Date(report.createdAt);
        const formattedDate = date.toLocaleDateString('es-ES');
        const formattedTime = date.toLocaleTimeString('es-ES');

        return `
Reporte de Análisis
===================
Fecha: ${formattedDate}
Hora: ${formattedTime}

Generado por:
-------------
- ID: ${report.User.id}
- Nombre: ${report.User.nombre}
- Correo: ${report.User.email}
- Celular: ${report.User.celular}

Producto Analizado:
-------------------
- Código: ${report.Product?.code || 'N/A'}
- Descripción: ${report.Product?.description || 'N/A'}
- Stock Total: ${report.Product?.totalStock || 'N/A'}
- Punto de Reorden: ${report.Product?.reorderPoint || 'N/A'}
- Unidades A Pedir: ${report.Product?.unitsToOrder || 'N/A'}
        `.trim();
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="relative flex-grow max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaSearch className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 transition-all duration-200"
                        placeholder="Buscar reportes o productos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                            <FaTimes className="text-gray-400 hover:text-gray-600 transition-colors" />
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 border border-red-100">
                    <FaTimes className="flex-shrink-0" />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <FaSpinner className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    {searchTerm ? (
                        <div className="flex flex-col items-center gap-3">
                            <FaSearch className="text-3xl text-gray-300" />
                            <p className="text-gray-500">No se encontraron reportes que coincidan con "{searchTerm}"</p>
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="mt-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                Limpiar búsqueda
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <FaFileAlt className="text-3xl text-gray-300" />
                            <p className="text-gray-500">No hay reportes disponibles</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nombre del Archivo
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Producto
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Generado por
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Fecha de Creación
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filteredReports.map((report) => (
                                <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <FaFileAlt className="flex-shrink-0 h-5 w-5 text-indigo-500" />
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {report.filename}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {report.Product ? (
                                            <>
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {report.Product.code}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {report.Product.description}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-400 italic">
                                                Producto no disponible
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {report.User?.nombre || 'Usuario no disponible'}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {report.User?.email || ''}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(report.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleViewReport(report)}
                                            className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50 transition-colors"
                                            title="Ver Reporte"
                                        >
                                            <FaEye className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal mejorado para ver el contenido del reporte */}
            {selectedReport && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-100 overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {selectedReport.filename}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Generado el {formatDate(selectedReport.createdAt)}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedReport(null);
                                    setReportContent('');
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <FaTimes className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            {contentLoading ? (
                                <div className="flex justify-center items-center py-12">
                                    <FaSpinner className="animate-spin h-8 w-8 text-indigo-600" />
                                </div>
                            ) : (
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <pre className="whitespace-pre-wrap font-sans text-gray-700">
                                        {reportContent || 'Contenido no disponible'}
                                    </pre>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6">
                                <button
                                    onClick={() => {
                                        setSelectedReport(null);
                                        setReportContent('');
                                    }}
                                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
                                >
                                    Cerrar
                                </button>
                                <a
                                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(generateDownloadContent(selectedReport))}`}
                                    download={selectedReport.filename}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-500 text-white rounded-lg shadow-sm hover:from-indigo-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all flex items-center gap-2"
                                >
                                    <FaFileDownload className="w-4 h-4" />
                                    Descargar
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsSection;