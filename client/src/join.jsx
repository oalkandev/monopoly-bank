import React from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import './i18n.js';
import '../index.css';

function App() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl max-w-md">
        <div className="card-body text-center">
          <h2 className="card-title justify-center text-2xl">😕 {t('join.notFoundTitle')}</h2>
          <p className="opacity-70 mt-2">{t('join.notFoundHint')}</p>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
