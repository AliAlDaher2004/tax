import React, { useState } from 'react';
import { FileText, Settings, Sparkles } from 'lucide-react';
import { InvoiceScreen } from './pages/InvoiceScreen';
import { AdminScreen } from './pages/AdminScreen';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

function App() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'admin'>('invoices');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Show customized toast alert
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto delete toast after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="app-container">
      {/* Arabic Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="logo-text">منصة الإعفاءات الضريبية</h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
                إنشاء وتصدير الفواتير المعفاة من الضرائب بسهولة
              </p>
            </div>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-button ${activeTab === 'invoices' ? 'active' : ''}`}
              onClick={() => setActiveTab('invoices')}
            >
              <FileText size={18} />
              <span>إدخال الفواتير</span>
            </button>
            <button
              className={`nav-button ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <Settings size={18} />
              <span>إدارة البيانات الأساسية</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        {activeTab === 'invoices' ? (
          <InvoiceScreen
            showToast={showToast}
            navigateToAdmin={() => setActiveTab('admin')}
          />
        ) : (
          <AdminScreen showToast={showToast} />
        )}
      </main>

      {/* Custom Toast Toaster */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Inline Close Icon helper for toast
const XIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default App;
