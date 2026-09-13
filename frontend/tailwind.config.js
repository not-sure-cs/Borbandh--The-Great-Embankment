/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#edf7ee',
          100: '#dfeedc',
          500: '#4c7d5f',
          600: '#3d6651',
          700: '#2d4d3e',
          900: '#1d352c',
        },
        danger: {
          500: '#b74f3d',
          600: '#9a3d32',
          700: '#7d3029',
        },
        warning: {
          500: '#d4a95d',
          600: '#bb8a42',
        },
        safe: {
          500: '#6a9d73',
          600: '#4d7d5d',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
