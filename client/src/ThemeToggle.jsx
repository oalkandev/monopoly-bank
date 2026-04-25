import { useTheme } from './useTheme.js';

export function ThemeToggle({ size = 'md' }) {
  const { isDark, toggle } = useTheme();
  const cls = size === 'sm' ? 'btn-sm' : '';
  return (
    <button
      onClick={toggle}
      className={`btn btn-ghost btn-circle ${cls}`}
      aria-label={isDark ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
      title={isDark ? 'Aydınlık tema' : 'Karanlık tema'}
    >
      <span className="text-xl">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
