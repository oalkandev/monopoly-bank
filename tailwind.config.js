import daisyui from 'daisyui';

export default {
  content: ['./client/**/*.{html,js,jsx}'],
  theme: { extend: {} },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        'monopoly-dark': {
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
      },
      {
        'monopoly-light': {
          'primary': '#2563eb',
          'primary-content': '#ffffff',
          'secondary': '#059669',
          'secondary-content': '#ffffff',
          'accent': '#7c3aed',
          'accent-content': '#ffffff',
          'neutral': '#1f2937',
          'neutral-content': '#f9fafb',
          'base-100': '#ffffff',
          'base-200': '#f3f4f6',
          'base-300': '#e5e7eb',
          'base-content': '#1f2937',
          'info': '#0891b2',
          'success': '#16a34a',
          'warning': '#d97706',
          'error': '#dc2626',
        },
      },
    ],
    darkTheme: 'monopoly-dark',
  },
};
