/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,tsx,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          header: '#f0f2f5',
          background: '#efeae2',
          incoming: '#ffffff',
          outgoing: '#d9fdd3',
          sidebar: '#ffffff',
          active: '#f0f2f5',
          teal: '#00a884'
        }
      }
    },
  },
  plugins: [],
}

