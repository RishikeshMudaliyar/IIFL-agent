/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // ponytail: keys kept (used across pages); values repointed L&T gold -> Muthoot FinCorp blue
                abc: {
                    red: '#0071A9',
                    'red-dark': '#003652',
                    'red-light': '#4BA3D3',
                    cream: '#EBF8FF',
                    gold: '#00699E',
                },
                // IIFL Finance brand palette
                iifl: {
                    orange: '#F56E28',
                    'orange-light': '#F28046',
                    'orange-dark': '#D9531A',
                    navy: '#1B1B5C',
                    'navy-light': '#2B2B7C',
                    blue: '#0779BF',
                    cream: '#FFF4EC',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                roboto: ['Roboto', 'system-ui', 'sans-serif'],
                'roboto-condensed': ['"Roboto Condensed"', 'system-ui', 'sans-serif'],
            },
            keyframes: {
                marquee: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
                floaty: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                pulseRing: {
                    '0%': { transform: 'scale(0.9)', opacity: '0.6' },
                    '70%': { transform: 'scale(1.6)', opacity: '0' },
                    '100%': { transform: 'scale(1.6)', opacity: '0' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                fadeUp: {
                    '0%': { opacity: '0', transform: 'translateY(14px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                equalize: {
                    '0%, 100%': { transform: 'scaleY(0.35)' },
                    '50%': { transform: 'scaleY(1)' },
                },
            },
            animation: {
                floaty: 'floaty 6s ease-in-out infinite',
                'pulse-ring': 'pulseRing 2.4s cubic-bezier(0.2, 0.6, 0.35, 1) infinite',
                shimmer: 'shimmer 3s linear infinite',
                'fade-up': 'fadeUp 0.7s ease-out both',
            },
        },
    },
    plugins: [],
}