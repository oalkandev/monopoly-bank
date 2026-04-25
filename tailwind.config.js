import daisyui from 'daisyui';

export default {
  content: ['./client/**/*.{html,js,jsx}'],
  theme: { extend: {} },
  plugins: [daisyui],
  daisyui: {
    themes: [{
      monopoly: {
        'primary': '#3b82f6',
        'primary-content': '#ffffff',
        'secondary': '#10b981',
        'secondary-content': '#ffffff',
        'accent': '#8b5cf6',
        'accent-content': '#ffffff',
        'neutral': '#1e293b',
        'neutral-content': '#f1f5f9',
        'base-100': '#1e293b',
        'base-200': '#172033',
        'base-300': '#0f172a',
        'base-content': '#e2e8f0',
        'info': '#06b6d4',
        'success': '#22c55e',
        'warning': '#f59e0b',
        'error': '#ef4444',
      },
    }],
    darkTheme: 'monopoly',
  },
};
