/** @type {import('tailwindcss').Config} */
export default {
  // ⚠️ 重点修改这里：添加你实际的文件夹路径
  content: [
    "./index.html",
    "./app/**/*.{js,ts,jsx,tsx}",      // 如果有 app 目录
    "./src/**/*.{js,ts,jsx,tsx}",      // 如果有 src 目录
    "./components/**/*.{js,ts,jsx,tsx}", // ✅ 添加 components
    "./utils/**/*.{js,ts,jsx,tsx}",     // ✅ 添加 utils (如果有带样式的组件)
    "./managers/**/*.{js,ts,jsx,tsx}",  // ✅ 添加 managers
    "./*.{js,ts,jsx,tsx}",              // ✅ 添加根目录下的文件 (App.tsx, index.tsx)
  ],
  theme: {
    // ... 保持原有配置不变 ...
    extend: {
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
        'inter': ['Inter', '"Microsoft YaHei"', 'sans-serif'],
      },
      colors: {
        bg: '#121212',
        textMain: '#e0e0e0',
        accent: '#a29bfe',
        success: '#00b894',
        danger: '#ff7675',
        warning: '#fdcb6e',
        chat: '#74b9ff',
        act: '#55efc4',
        ai: '#a29bfe',
        love: '#fd79a8',
        skill: '#fab1a0',
        select: '#39ff14',
      }
    },
  },
  plugins: [],
}