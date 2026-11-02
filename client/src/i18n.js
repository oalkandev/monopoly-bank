import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import tr from './locales/tr.json';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ptBR from './locales/pt-BR.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'tr',    name: 'Türkçe',     flag: '🇹🇷' },
  { code: 'en',    name: 'English',    flag: '🇬🇧' },
  { code: 'es',    name: 'Español',    flag: '🇪🇸' },
  { code: 'de',    name: 'Deutsch',    flag: '🇩🇪' },
  { code: 'fr',    name: 'Français',   flag: '🇫🇷' },
  { code: 'it',    name: 'Italiano',   flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Português',  flag: '🇧🇷' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
      es: { translation: es },
      de: { translation: de },
      fr: { translation: fr },
      it: { translation: it },
      'pt-BR': { translation: ptBR },
      // pt-PT veya sadece 'pt' yakalansın
      pt: { translation: ptBR },
    },
    fallbackLng: {
      'pt-PT': ['pt-BR', 'en'],
      'pt': ['pt-BR', 'en'],
      'default': ['en'],
    },
    supportedLngs: ['tr', 'en', 'es', 'de', 'fr', 'it', 'pt-BR', 'pt'],
    nonExplicitSupportedLngs: true,
    load: 'all',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'monopoly-lang',
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
