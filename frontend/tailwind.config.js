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
        },
    },
    plugins: [],
}