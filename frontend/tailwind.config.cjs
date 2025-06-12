/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');   // ← v4 기본 내장 팔레트

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'], // ← 필요 경로

  theme: {
    /* ① 색 팔레트 선언 */
    colors: {
      /* 회색 계열 전체(gray-50‒950)를 다시 사용하고 싶으면 */
      gray: colors.neutral,   // slate·stone·zinc 중 아무거나 골라도 OK

      /* 프로젝트 전용 색은 그대로 추가 */
      primary: {
        50:  '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e',
      },
    },

    /* ② 폰트 등 다른 토큰은 extend 대신 여기서 바로 선언해도 무방 */
    fontFamily: {
      body: ['Inter', 'sans-serif'],
      heading: ['Inter', 'sans-serif'],
    },
  },
};
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#eef4ff",
          100: "#dbe3ff",
          300: "#6a8cff",
          500: "#3b5bff",
        },
      },
      fontFamily: {
        sans: ["Inter", "Pretendard", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 16px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
