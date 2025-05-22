import React, { useState } from 'react';
import { FaEnvelope, FaLock, FaCode, FaSpinner } from 'react-icons/fa';
import { FiAlertCircle } from 'react-icons/fi';

interface ForgotPasswordFormProps {
    onResetPassword: (data: {
        email: string;
        verificationCode?: string;
        newPassword?: string;
        isResend?: boolean;
    }) => Promise<{
        success: boolean;
        message?: string;
        alreadySent?: boolean;
    }>;
    onBackToLogin: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onResetPassword, onBackToLogin }) => {
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [codeSent, setCodeSent] = useState(false); // Indica si el código fue enviado
    const [codeVerified, setCodeVerified] = useState(false); // Indica si el código fue validado

    // Enviar el código de verificación
    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('Por favor, ingresa un correo electrónico');
            return;
        }

        setLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            console.log('Enviando solicitud para código a:', email);
            const result = await onResetPassword({ email, isResend: false });
            console.log('Resultado de onResetPassword (send code):', result);

            if (result.success || result.alreadySent) {
                setSuccessMessage(
                    result.message || 'Se ha enviado un código de verificación a tu correo'
                );
                setCodeSent(true);
            } else {
                setError(result.message || 'No se pudo enviar el código');
            }
        } catch (err: any) {
            console.error('Error al enviar el código:', err);
            setError(err.message || 'Error al enviar el código');
        } finally {
            setLoading(false);
        }
    };

    // Validar el código de verificación
    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!verificationCode) {
            setError('Por favor, ingresa el código de verificación');
            return;
        }

        setLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            console.log('Validando código:', verificationCode);
            const result = await onResetPassword({
                email,
                verificationCode,
            });
            console.log('Resultado de onResetPassword (verify code):', result);

            if (result.success) {
                setSuccessMessage('Código verificado correctamente');
                setCodeVerified(true);
            } else {
                setError(result.message || 'Código de verificación inválido');
            }
        } catch (err: any) {
            console.error('Error al verificar el código:', err);
            setError(err.message || 'Error al verificar el código');
        } finally {
            setLoading(false);
        }
    };

    // Restablecer la contraseña
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPassword) {
            setError('Por favor, ingresa una nueva contraseña');
            return;
        }

        setLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            console.log('Restableciendo contraseña con:', { email, verificationCode, newPassword });
            const result = await onResetPassword({
                email,
                verificationCode,
                newPassword,
            });
            console.log('Resultado de onResetPassword (reset password):', result);

            if (result.success) {
                setSuccessMessage(result.message || 'Contraseña restablecida correctamente');
                setTimeout(() => {
                    onBackToLogin();
                }, 2000);
            } else {
                setError(result.message || 'No se pudo restablecer la contraseña');
            }
        } catch (err: any) {
            console.error('Error al restablecer la contraseña:', err);
            setError(err.message || 'Error al restablecer la contraseña');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#EDEDED] p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="flex flex-col items-center p-6">
                    <img src="/Logo_Kpital.jpg" alt="Logo Kpital" className="h-16 mb-3 object-contain" />
                    <h1 className="text-2xl font-bold text-[#0074CF]">Restablecer Contraseña</h1>
                    <p className="text-[#001A30] mt-1">
                        {codeVerified
                            ? 'Ingresa tu nueva contraseña'
                            : codeSent
                            ? 'Ingresa el código que recibiste'
                            : 'Ingresa tu correo para recibir un código'}
                    </p>
                </div>

                <div className="p-8">
                    {(error || successMessage) && (
                        <div className={`mb-6 p-3 rounded-lg flex items-center gap-2 ${
                            error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>
                            <FiAlertCircle />
                            <span>{error || successMessage}</span>
                        </div>
                    )}

                    <form
                        onSubmit={
                            codeVerified
                                ? handleResetPassword
                                : codeSent
                                ? handleVerifyCode
                                : handleSendCode
                        }
                        className="space-y-6"
                    >
                        {/* Campo de Correo Electrónico */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-[#001A30] mb-1">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FaEnvelope className="text-[#0074CF]" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={codeSent} // Deshabilitar después de enviar el código
                                    className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition disabled:bg-gray-200"
                                    placeholder="tu@email.com"
                                />
                            </div>
                        </div>

                        {/* Campo de Código de Verificación (se muestra después de enviar el correo) */}
                        {codeSent && !codeVerified && (
                            <div>
                                <label htmlFor="verificationCode" className="block text-sm font-medium text-[#001A30] mb-1">
                                    Código de Verificación
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FaCode className="text-[#0074CF]" />
                                    </div>
                                    <input
                                        id="verificationCode"
                                        name="verificationCode"
                                        type="text"
                                        required
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value)}
                                        className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition"
                                        placeholder="123456"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Campo de Nueva Contraseña (se muestra después de verificar el código) */}
                        {codeVerified && (
                            <div>
                                <label htmlFor="newPassword" className="block text-sm font-medium text-[#001A30] mb-1">
                                    Nueva Contraseña
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FaLock className="text-[#0074CF]" />
                                    </div>
                                    <input
                                        id="newPassword"
                                        name="newPassword"
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="pl-10 w-full px-4 py-3 bg-[#F8F9FA] text-[#001A30] border border-[#EDEDED] rounded-lg focus:ring-2 focus:ring-[#0074CF] focus:border-[#0074CF] outline-none transition"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Botón de Acción */}
                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-gradient-to-r from-[#0074CF] to-[#003268] hover:from-[#0060b0] hover:to-[#002550] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00B0F0] transition-all disabled:bg-gray-400"
                            >
                                {loading ? (
                                    <>
                                        <FaSpinner className="animate-spin mr-2" />
                                        Procesando...
                                    </>
                                ) : codeVerified ? (
                                    'Restablecer Contraseña'
                                ) : codeSent ? (
                                    'Verificar Código'
                                ) : (
                                    'Enviar Código'
                                )}
                            </button>
                        </div>

                        {/* Botón de Reenviar Código (se muestra después de enviar el correo) */}
                        {codeSent && !codeVerified && (
                            <div className="flex items-center justify-between">
                                <div className="text-sm">
                                    <button
                                        type="button"
                                        onClick={handleSendCode}
                                        disabled={loading}
                                        className="font-medium text-[#0074CF] hover:text-[#003268] disabled:text-gray-400"
                                    >
                                        Reenviar Código
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-[#001A30]">
                            ¿Ya tienes una cuenta?{' '}
                            <button
                                onClick={onBackToLogin}
                                className="font-medium text-[#0074CF] hover:text-[#003268]"
                            >
                                Iniciar Sesión
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordForm;