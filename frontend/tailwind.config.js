/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      colors: {
        // Background layers
        deep:   '#09090c',
        base:   '#0f1117',
        raised: '#171b25',
        float:  '#1e2230',
        pop:    '#262c3c',
        // Borders
        line:   '#202540',
        edge:   '#2c3350',
        // Text
        chalk:  '#e4e2dc',
        mist:   '#848090',
        smoke:  '#3e3d48',
        // Accent — dusty slate blue
        ink: {
          100: '#dde3f0',
          200: '#c4cce0',
          300: '#a8b3cf',
          400: '#8e9cbd',
          500: '#7382a8',
          600: '#5c6c94',
          700: '#48567a',
          800: '#2a3458',
          900: '#141929',
        },
        // Muted amber — needs-review / warnings
        glow: {
          DEFAULT: '#c9aa7a',
          dim:     '#a08a5c',
          bg:      '#1b1810',
          border:  '#2e2618',
          text:    '#d4b88a',
        },
        // Muted red — delete / errors
        ember: {
          DEFAULT: '#c47a74',
          bg:      '#1b1010',
          border:  '#2e1c1a',
        },
      },
    },
  },
  plugins: [],
};
