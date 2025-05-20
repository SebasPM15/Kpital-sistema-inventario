import React, { useEffect, useState } from 'react';
import { FaEnvelope, FaCheckCircle, FaInfoCircle, FaSpinner, FaRedo } from 'react-icons/fa';
import { FiAlertTriangle } from 'react-icons/fi';

interface ProyeccionData {
    mes: string;
    stock_inicial: number;
    stock_proyectado: number;
    punto_reorden: number;
    fecha_reposicion: string;
    fecha_solicitud: string;
    fecha_arribo: string;
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
        details?: {
            productCode: string;
            coverageDays: number;
            deficit: number;
            unitsToOrder: number;
            boxesToOrder: number;
            urgency: string;
        };
    }>;
}

const AlertConfig: React.FC<AlertConfigProps> = ({ product, onConfigure }) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [alreadySent, setAlreadySent] = useState(false);
    const [alertDetails, setAlertDetails] = useState<{
        productCode: string;
        coverageDays: number;
        deficit: number;
        unitsToOrder: number;
        boxesToOrder: number;
        urgency: string;
    } | null>(null);

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
                    setAlertDetails(result.details || null);
                } else if (result.alreadySent) {
                    setAlreadySent(true);
                    setAlertDetails(result.details || null);
                } else {
                    setError(result.message || 'Error al enviar alerta automática');
                }
            } catch (err: any) {
                setError(err.message || 'Error al enviar alerta automática');
            } finally {
                setLoading(false);
            }
        };

        sendAlertAutomatically();
    }, [userEmail, product, onConfigure]);

    const shouldShowAlert = () => {
        if (!product.PROYECCIONES?.length) return false;
        const proyeccion = product.PROYECCIONES[0];
        return (
            proyeccion.tiempo_cobertura <= 10 ||
            proyeccion.alerta_stock ||
            proyeccion.deficit > 0
        );
    };

    const getAlertMessage = () => {
        if (!product.PROYECCIONES?.length) return '';
        const proyeccion = product.PROYECCIONES[0];

        if (proyeccion.deficit > 0) {
            return `Déficit de ${Math.round(proyeccion.deficit)} unidades en ${proyeccion.mes}`;
        }
        return `Stock crítico en ${proyeccion.mes} (${Math.round(proyeccion.tiempo_cobertura)} días de cobertura)`;
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
                setAlertDetails(result.details || null);
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
            <div className="bg-gray-50 border border-blue-200 rounded-lg p-5 shadow-sm mt-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <FiAlertTriangle className="text-blue-600" />
                    Estado de Alertas
                </h4>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-blue-600 mb-2">Estado Actual</div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                            SIN ALERTAS
                        </span>
                        <span className="text-sm text-gray-700">
                            Stock dentro de parámetros normales
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 border border-blue-200 rounded-lg p-5 shadow-sm mt-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiAlertTriangle className="text-red-600" />
                Alerta de Stock Crítico
            </h4>

            <div className="space-y-4">
                {/* Estado de Alerta */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-blue-600 mb-2">Situación Actual</div>
                    <div className="flex items-center gap-3">
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                                alertDetails?.urgency === 'urgente'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-red-100 text-red-600'
                            }`}
                        >
                            {alertDetails?.urgency === 'urgente' ? 'URGENTE' : 'ALERTA ACTIVA'}
                        </span>
                        <span className="text-sm text-gray-700">{getAlertMessage()}</span>
                    </div>
                    {alertDetails && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <p className="text-xs text-gray-600">
                                    <strong>Unidades a pedir:</strong> {alertDetails.unitsToOrder.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-600">
                                    <strong>Cajas a pedir:</strong> {alertDetails.boxesToOrder}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">
                                    <strong>Fecha de solicitud:</strong> {product.PROYECCIONES[0].fecha_solicitud}
                                </p>
                                <p className="text-xs text-gray-600">
                                    <strong>Fecha de reposición:</strong> {product.PROYECCIONES[0].fecha_reposicion}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Notificación de alerta ya enviada */}
                {alreadySent && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="flex items-start gap-3">
                            <FaInfoCircle className="text-blue-500 mt-1 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-blue-800">
                                    La alerta automática ya ha sido enviada
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                    Puede reenviar la alerta manualmente si es necesario
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notificación de envío exitoso */}
                {success && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <div className="flex items-start gap-3">
                            <FaCheckCircle className="text-green-500 mt-1 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-green-800">
                                    Alerta enviada correctamente a {userEmail}
                                </p>
                                <p className="text-xs text-green-600 mt-1">
                                    La notificación ha sido enviada con éxito
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Información del correo registrado */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-blue-600 mb-2">Correo Registrado</div>
                    <div className="text-sm font-medium text-gray-800">
                        {userEmail ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {userEmail}
                            </span>
                        ) : (
                            <span className="text-xs text-red-600">
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
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-colors ${
                            loading
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        {loading ? (
                            <>
                                <FaSpinner className="animate-spin w-4 h-4" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <FaRedo className="w-4 h-4" />
                                Reenviar Alerta
                            </>
                        )}
                    </button>
                </div>

                {/* Mensajes de error */}
                {error && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-3">
                        <FiAlertTriangle className="text-red-500 flex-shrink-0 mt-1" />
                        <span className="text-sm text-red-700">{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertConfig;