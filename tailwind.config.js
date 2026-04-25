import daisyui from 'daisyui';

export default {
  content: ['./client/**/*.{html,js,jsx}'],
  theme: { extend: {} },
  plugins: [daisyui],
  daisyui: {
    themes: [{
      monopoly: {
        'primary': '#dc2626',
        'primary-content': '#ffffff',
        'secondary': '#16a34a',
        'secondary-content': '#ffffff',
        'accent': '#f59e0b',
        'accent-content': '#1f2937',
        'neutral': '#1f2937',
        'base-100': '#fef3c7',
        'base-200': '#fde68a',
        'base-300': '#fcd34d',
        'base-content': '#1f2937',
        'info': '#3b82f6',
        'success': '#22c55e',
        'warning': '#f59e0b',
        'error': '#ef4444',
      },
    }, 'light', 'dark'],
  },
};
