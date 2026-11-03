/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme:{ extend:{
    colors:{ ink:'#1C1917', paper:'#FAF8F5', clay:'#C14A2E', clayDark:'#9E3A22', sage:'#4D5B3E', sand:'#E7E0D8', stone2:'#78716C' },
    boxShadow:{ card:'0 1px 3px rgba(28,25,23,0.06), 0 8px 24px rgba(28,25,23,0.04)', pop:'0 12px 32px rgba(28,25,23,0.12)' },
    borderRadius:{ xl2:'20px' }
  }},
  plugins:[]
}