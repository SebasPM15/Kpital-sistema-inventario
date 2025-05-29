/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './pages/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
        './src/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            colors: {
                // Paleta segura con colores hexadecimales explícitos
                gray: {
                    50: '#fafafa',
                    100: '#f4f4f5',
                    200: '#e4e4e7',
                    300: '#d4d4d8',
                    400: '#a1a1aa',
                    500: '#71717a',
                    600: '#52525b',
                    700: '#3f3f46',
                    800: '#27272a',
                    900: '#18181b'
                },
                primary: {
                    light: '#3b82f6',
                    DEFAULT: '#2563eb',
                    dark: '#1d4ed8'
                },
                danger: {
                    light: '#ef4444',
                    DEFAULT: '#dc2626',
                    dark: '#b91c1c'
                },
                success: {
                    light: '#22c55e',
                    DEFAULT: '#16a34a',
                    dark: '#15803d'
                },
                warning: {
                    light: '#f59e0b',
                    DEFAULT: '#d97706',
                    dark: '#b45309'
                }
            }
        }
    },
    plugins: [
        require('@tailwindcss/forms')({
            strategy: 'class' // Solo usar clases, no estilos base
        })
    ],
    corePlugins: {
        // Deshabilitar características que podrían generar colores modernos
        textOpacity: false,
        backgroundOpacity: false,
        borderOpacity: false
    }
}