/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
      },
      colors: {
        parchment: {
          50:  '#faf6ee',
          100: '#f3eada',
          200: '#e8d8bc',
        },
      },
    },
  },
  plugins: [],
};
