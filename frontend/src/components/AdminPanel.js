import React, { useState } from 'react';
import UserManagement from './admin/UserManagement';
import SyncManagement from './admin/SyncManagement';
import BudgetStructureModeration from './admin/BudgetStructureModeration';
import './admin/AdminPanel.css';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Панель адміністратора</h1>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Управління користувачами
        </button>
        <button
          className={`admin-tab ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveTab('sync')}
        >
          Синхронізація
        </button>
        <button
          className={`admin-tab ${activeTab === 'budget' ? 'active' : ''}`}
          onClick={() => setActiveTab('budget')}
        >
          Модерація бюджетів
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'sync' && <SyncManagement />}
        {activeTab === 'budget' && <BudgetStructureModeration />}
      </div>
    </div>
  );
}

