import React, { useEffect, useState } from 'react';
import { FaWhatsapp, FaCheckCircle, FaInfoCircle, FaSpinner } from 'react-icons/fa';
import { FiAlertTriangle } from 'react-icons/fi';

interface ProductoData {
    CODIGO: string;
    DESCRIPCION: string;
    STOCK_TOTAL: number;
    PUNTO_REORDEN: number;
    FECHA_REPOSICION: string;
    DIAS_COBERTURA: number;
    DEFICIT: number;
    CAJAS_A_PEDIR: number;
    UNIDADES_A_PEDIR: number;
    alerta_stock: boolean;
}

interface AlertConfigProps {
    product: ProductoData;
    onConfigure: (phone: string) => Promise<{ success: boolean; message?: string }>;
}

const AlertConfig: React.FC<AlertConfigProps> = ({ product, onConfigure }) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [lastAlertStatus, setLastAlertStatus] = useState<'active' | 'inactive' | null>(null);
    const [userPhone, setUserPhone] = useState('');

    // Obtener y formatear el número de teléfono desde localStorage
    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const parsedUser = JSON.parse(userData);
                if (parsedUser.celular) {
                    // Guardamos el número completo para mostrar al usuario
                    setUserPhone(parsedUser.celular);
                }
            } catch (e) {
                console.error('Error al parsear datos de usuario:', e);
            }
        }
    }, []);

    // Función para formatear el número para el backend (elimina el 0 inicial)
    const formatPhoneForBackend = (phone: string) => {
        if (!phone) return '';
        // Elimina todos los caracteres no numéricos
        const cleaned = phone.replace(/\D/g, '');
        // Si empieza con 0, lo removemos
        return cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!userPhone) {
            setError('No se encontró número de celular registrado');
            return;
        }

        const phoneForBackend = formatPhoneForBackend(userPhone);

        if (phoneForBackend.length !== 9 && phoneForBackend.length !== 12) {
            setError('El número debe tener 9 dígitos (sin código de país)');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(false);
        setLastAlertStatus(product.alerta_stock || product.DEFICIT > 0 ? 'active' : 'inactive');

        try {
            const result = await onConfigure(phoneForBackend);
            
            if (result.success) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 5000);
            } else {
                throw new Error(result.message || 'No se pudo enviar la alerta');
            }
        } catch (err: any) {
            setError(err.message || 'Error al configurar alertas');
            setTimeout(() => setError(''), 8000);
        } finally {
            setLoading(false);
        }
    };

    const shouldShowAlert = product.alerta_stock || product.DEFICIT > 0;
    const alertMessage = product.DEFICIT > 0
        ? `Déficit de ${Math.round(product.DEFICIT)} unidades`
        : 'Stock bajo punto de reorden';

    // Función para formatear el número para mostrar al usuario
    const formatPhoneForDisplay = (phone: string) => {
        if (!phone) return 'No registrado';
        // Mostramos el número tal como está en el registro
        return phone;
    };

    return (
        <div className="bg-[#EDEDED] border border-[#00B0F0] rounded-lg p-4 shadow-sm mt-4">
            <h4 className="text-sm font-semibold text-[#001A30] mb-3 flex items-center gap-2">
                <FiAlertTriangle className="text-[#0074CF]" />
                Alertas de Stock por WhatsApp
            </h4>

            <div className="space-y-3">
                {/* Estado de Alerta */}
                <div className="bg-white p-3 rounded-lg border border-[#EDEDED] shadow-xs">
                    <div className="text-xs text-[#0074CF] mb-1">Estado Actual</div>
                    <div className="text-sm font-medium text-[#001A30] flex items-center gap-2">
                        {shouldShowAlert ? (
                            <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FFEBEE] text-[#D32F2F]">
                                    ALERTA ACTIVA
                                </span>
                                <span className="text-xs text-[#001A30]">
                                    {alertMessage}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#388E3C]">
                                    SIN ALERTAS
                                </span>
                                <span className="text-xs text-[#001A30]">
                                    Stock dentro de parámetros normales
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Información del número registrado */}
                <div className="bg-white p-3 rounded-lg border border-[#EDEDED] shadow-xs">
                    <div className="text-xs text-[#0074CF] mb-1">Número Registrado</div>
                    <div className="text-sm font-medium text-[#001A30] flex items-center gap-2">
                        {userPhone ? (
                            <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1565C0]">
                                    {formatPhoneForDisplay(userPhone)}
                                </span>
                                <span className="text-xs text-[#001A30]">
                                    (Se enviarán alertas a este número)
                                </span>
                            </>
                        ) : (
                            <span className="text-xs text-[#D32F2F]">
                                No tienes un número registrado. Actualiza tu perfil.
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-[#0074CF] mt-2">
                        <FaInfoCircle className="inline mr-1" />
                        El sistema enviará: 593{userPhone ? formatPhoneForBackend(userPhone) : '...'}
                    </div>
                </div>

                {/* Botón de Envío */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !shouldShowAlert || !userPhone}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors ${
                            loading 
                                ? 'bg-[#003268] text-white'
                                : shouldShowAlert && userPhone
                                    ? 'bg-[#0074CF] hover:bg-[#003268] text-white'
                                    : 'bg-[#EDEDED] text-[#001A30]/50 cursor-not-allowed'
                        }`}
                        title={
                            !shouldShowAlert 
                                ? "No hay alertas activas para este producto" 
                                : !userPhone 
                                    ? "No tienes un número registrado" 
                                    : ""
                        }
                    >
                        {loading ? (
                            <>
                                <FaSpinner className="animate-spin w-4 h-4" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <FaWhatsapp className="w-4 h-4" />
                                {success ? '¡Enviado!' : 'Enviar Alerta'}
                            </>
                        )}
                    </button>
                </div>

                {/* Mensajes de retroalimentación */}
                {error && (
                    <div className="p-2 bg-[#FFEBEE] text-[#D32F2F] rounded text-xs flex items-start gap-2">
                        <FiAlertTriangle className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="p-2 bg-[#E8F5E9] text-[#388E3C] rounded text-xs flex items-start gap-2">
                        <FaCheckCircle className="flex-shrink-0 mt-0.5" />
                        <div>
                            <p>Alerta enviada correctamente a {formatPhoneForDisplay(userPhone)}</p>
                            <p className="text-[#388E3C] mt-1">
                                {lastAlertStatus === 'active' 
                                    ? "Recibirás notificaciones cuando el stock mejore"
                                    : "Serás notificado si el stock baja del punto de reorden"}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertConfig;