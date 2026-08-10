/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        normal:     '#6B7280',
        monitor:    '#F59E0B',
        alert:      '#F97316',
        evacuation: '#EF4444',
        critical:   '#7C3AED',
      },
    },
  },
  plugins: [],
};