import { Sun, Moon } from 'lucide-react';
import { useTheme } from './useTheme.js';

export function ThemeToggle({ size = 'md' }) {
  const { isDark, toggle } = useTheme();
  const btnSize = size === 'sm' ? 'btn-sm' : '';
  const iconSize = size === 'sm' ? 18 : 20;
  return (
    <button
      onClick={toggle}
      className={`btn btn-ghost btn-circle ${btnSize}`}
      aria-label={isDark ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
      title={isDark ? 'Aydınlık tema' : 'Karanlık tema'}
    >
      {isDark
        ? <Sun size={iconSize} className="text-warning" />
        : <Moon size={iconSize} className="text-info" />}
    </button>
  );
}
