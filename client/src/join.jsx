import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl max-w-md">
        <div className="card-body text-center">
          <h2 className="card-title justify-center text-2xl">😕 Oyun bulunamadı</h2>
          <p className="opacity-70 mt-2">Bu link geçersiz veya oyun sıfırlanmış.</p>
          <p className="opacity-70">Bankacıdan yeni bir link iste.</p>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
