import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from './i18n.js';

export function LanguageSwitcher({ size = 'md' }) {
  const { i18n } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.resolvedLanguage)
    ?? SUPPORTED_LANGUAGES.find(l => i18n.resolvedLanguage?.startsWith(l.code))
    ?? SUPPORTED_LANGUAGES[1];
  const btnSize = size === 'sm' ? 'btn-sm' : '';

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className={`btn btn-ghost btn-circle ${btnSize}`} aria-label="Language">
        <Languages size={size === 'sm' ? 18 : 20} />
      </label>
      <ul tabIndex={0} className="menu dropdown-content mt-2 z-[1] p-1 shadow-xl bg-base-200 rounded-box w-44">
        {SUPPORTED_LANGUAGES.map(lang => {
          const active = lang.code === current.code;
          return (
            <li key={lang.code}>
              <a
                onClick={() => i18n.changeLanguage(lang.code)}
                className={`gap-2 ${active ? 'active font-bold' : ''}`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
