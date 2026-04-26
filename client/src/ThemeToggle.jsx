import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from './useTheme.js';

export function ThemeToggle({ size = 'md' }) {
  const { t } = useTranslation();
  const { isDark, toggle } = useTheme();
  const btnSize = size === 'sm' ? 'btn-sm' : '';
  const iconSize = size === 'sm' ? 18 : 20;
  const label = isDark ? t('common.lightMode') : t('common.darkMode');
  return (
    <button
      onClick={toggle}
      className={`btn btn-ghost btn-circle ${btnSize}`}
      aria-label={label}
      title={label}
    >
      {isDark
        ? <Sun size={iconSize} className="text-warning" />
        : <Moon size={iconSize} className="text-info" />}
    </button>
  );
}
