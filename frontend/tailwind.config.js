export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f6',
          100: '#d7efec',
          400: '#4fd8c4',
          500: '#2dd4bf',
          600: '#1fae9c',
          700: '#178578',
        },
        ink: {
          900: '#0f1225',
          800: '#171b34',
          700: '#20264a',
          400: '#8a8fa8',
          200: '#c7cadb',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
