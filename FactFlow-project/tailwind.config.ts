// tailwind.config.js
export default {
  content: ['./index.html','./src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: '#892020',           // หลักจากโลโก้
        brandDark: '#6e1919',       // hover/active
        brandLight: '#f7eaea',      // พื้นหลังอ่อน/แถบเนียนๆ
      },
      boxShadow: {
        soft: '0 6px 20px rgba(137,32,32,.12)',
      },
      borderRadius: {
        xl2: '1rem',
      }
    },
    fontFamily: {
      serif: ['"Playfair Display"','ui-serif','Georgia'],
      sans: ['Inter','ui-sans-serif','system-ui']
    }
  },
  plugins: []
}
