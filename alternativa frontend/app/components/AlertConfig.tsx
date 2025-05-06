import React, { useEffect, useState } from 'react';
import { FaEnvelope, FaCheckCircle, FaInfoCircle, FaSpinner, FaRedo } from 'react-icons/fa';
import { FiAlertTriangle } from 'react-icons/fi';

interface ProyeccionData {
    mes: string;
    stock_inicial: number;
    stock_proyectado: number;
    punto_reorden: number;
    fecha_reposicion: string;
    tiempo_cobertura: number;
    deficit: number;
    cajas_a_pedir: number;
    unidades_a_pedir: number;
    alerta_stock: boolean;
}

interface ProductoData {
    CODIGO: string;
    DESCRIPCION: string;
    PROYECCIONES: ProyeccionData[];
}

interface AlertConfigProps {
    product: ProductoData;
    onConfigure: (email: string, isManual?: boolean) => Promise<{ 
        success: boolean; 
        message?: string;
        alreadySent?: boolean;
    }>;
}

const AlertConfig: React.FC<AlertConfigProps> = ({ product, onConfigure }) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [alreadySent, setAlreadySent] = useState(false);

    // Obtener el email del usuario
    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const parsedUser = JSON.parse(userData);
                if (parsedUser.email) {
                    setUserEmail(parsedUser.email);
                }
            } catch (e) {
                console.error('Error al parsear datos de usuario:', e);
            }
        }
    }, []);

    // Enviar alerta automáticamente al cargar
    useEffect(() => {
        const sendAlertAutomatically = async () => {
            if (!userEmail || !shouldShowAlert()) return;
            
            setLoading(true);
            setError('');
            
            try {
                const result = await onConfigure(userEmail, false);
                
                if (result.success) {
                    setSuccess(true);
                } else if (result.alreadySent) {
                    setAlreadySent(true);
                }
            } catch (err: any) {
                setError(err.message || 'Error al enviar alerta automática');
            } finally {
                setLoading(false);
            }
        };

        sendAlertAutomatically();
    }, [userEmail, product]);

    const shouldShowAlert = () => {
        if (!product.PROYECCIONES?.length) return false;
        const proyeccion = product.PROYECCIONES[0];
        return proyeccion.tiempo_cobertura <= 10 || 
               proyeccion.alerta_stock || 
               proyeccion.deficit > 0;
    };

    const getAlertMessage = () => {
        if (!product.PROYECCIONES?.length) return '';
        const proyeccion = product.PROYECCIONES[0];
        
        if (proyeccion.deficit > 0) {
            return `Déficit de ${Math.round(proyeccion.deficit)} unidades (${proyeccion.mes})`;
        }
        return `Stock crítico en ${proyeccion.mes} (${Math.round(proyeccion.tiempo_cobertura)} días)`;
    };

    const handleResend = async () => {
        if (!userEmail) {
            setError('No se encontró dirección de correo registrada');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(false);
        setAlreadySent(false);
        
        try {
            const result = await onConfigure(userEmail, true);
            
            if (result.success) {
                setSuccess(true);
            } else {
                throw new Error(result.message || 'No se pudo reenviar la alerta');
            }
        } catch (err: any) {
            setError(err.message || 'Error al reenviar alerta');
        } finally {
            setLoading(false);
        }
    };

    if (!shouldShowAlert()) {
        return (
            <div className="bg-[#EDEDED] border border-[#00B0F0] rounded-lg p-4 shadow-sm mt-4">
                <h4 className="text-sm font-semibold text-[#001A30] mb-3 flex items-center gap-2">
                    <FiAlertTriangle className="text-[#0074CF]" />
                    Alertas de Stock
                </h4>
                <div className="bg-white p-3 rounded-lg border border-[#EDEDED]">
                    <div className="text-xs text-[#0074CF] mb-1">Estado Actual</div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#388E3C]">
                            SIN ALERTAS
                        </span>
                        <span className="text-xs text-[#001A30]">
                            Stock dentro de parámetros normales
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#EDEDED] border border-[#00B0F0] rounded-lg p-4 shadow-sm mt-4">
            <h4 className="text-sm font-semibold text-[#001A30] mb-3 flex items-center gap-2">
                <FiAlertTriangle className="text-[#0074CF]" />
                Alerta de Stock Crítico
            </h4>

            <div className="space-y-3">
                {/* Estado de Alerta */}
                <div className="bg-white p-3 rounded-lg border border-[#EDEDED]">
                    <div className="text-xs text-[#0074CF] mb-1">Situación Actual</div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#FFEBEE] text-[#D32F2F]">
                            ALERTA ACTIVA
                        </span>
                        <span className="text-xs text-[#001A30]">
                            {getAlertMessage()}
                        </span>
                    </div>
                </div>

                {/* Notificación de alerta ya enviada */}
                {alreadySent && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <div className="flex items-start gap-2">
                            <FaInfoCircle className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-blue-800">
                                    La alerta automática ya ha sido generada
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                    Si lo desea, puede reenviar la alerta de manera manual
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notificación de envío exitoso */}
                {success && (
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                        <div className="flex items-start gap-2">
                            <FaCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-green-800">
                                    Alerta reenviada correctamente a {userEmail}
                                </p>
                                <p className="text-xs text-green-600 mt-1">
                                    La notificación ha sido enviada nuevamente
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Información del correo registrado */}
                <div className="bg-white p-3 rounded-lg border border-[#EDEDED]">
                    <div className="text-xs text-[#0074CF] mb-1">Correo Registrado</div>
                    <div className="text-sm font-medium text-[#001A30]">
                        {userEmail ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1565C0]">
                                {userEmail}
                            </span>
                        ) : (
                            <span className="text-xs text-[#D32F2F]">
                                No tienes un correo registrado. Actualiza tu perfil.
                            </span>
                        )}
                    </div>
                </div>

                {/* Botón de Reenvío */}
                <div className="flex justify-end">
                    <button
                        onClick={handleResend}
                        disabled={loading || !userEmail}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs shadow-sm transition-colors ${
                            loading 
                                ? 'bg-[#003268] text-white'
                                : 'bg-white border border-blue-500 hover:bg-blue-500 hover:text-white text-blue-500'
                        }`}
                    >
                        {loading ? (
                            <>
                                <FaSpinner className="animate-spin w-3 h-3" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <FaRedo className="w-3 h-3" />
                                Reenviar alerta manualmente
                            </>
                        )}
                    </button>
                </div>

                {/* Mensajes de error */}
                {error && (
                    <div className="bg-red-50 p-2 rounded-lg border border-red-100 flex items-start gap-2">
                        <FiAlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-red-700">{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertConfig;