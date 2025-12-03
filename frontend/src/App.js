// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MapView from './components/MapView';
import Login from './components/Login';
import Register from './components/Register';
import ReportGenerator from './components/ReportGenerator';
import ReportViewer from './components/ReportViewer';
import UserProfile from './components/UserProfile';
import AdminPanel from './components/AdminPanel';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import './styles.css';

function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div>
              <h1>OpenBudget Viewer</h1>
              <p className="app-subtitle">
                Візуалізація видатків місцевих бюджетів на основі OpenBudget API
              </p>
            </div>
          </Link>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isAuthenticated ? (
            <>
              <Link to="/reports" className="nav-link">
                Генератор звітів
              </Link>
              <Link to="/viewer" className="nav-link">
                Перегляд звітів
              </Link>
              <Link to="/profile" className="nav-link">
                Профіль
              </Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="nav-link" style={{ color: '#dc2626', fontWeight: '600' }}>
                  Адмін панель
                </Link>
              )}
              <span className="user-name">{user?.full_name || user?.email}</span>
              <button onClick={handleLogout} className="btn-secondary btn-small">
                Вийти
              </button>
            </>
          ) : (
            <>
              <Link to="/viewer" className="nav-link">
                Перегляд звітів
              </Link>
              <Link to="/login" className="nav-link">
                Увійти
              </Link>
              <Link to="/register" className="nav-link">
                Реєстрація
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <AppHeader />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<MapView />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/viewer" element={<ReportViewer />} />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <ReportGenerator />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UserProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminPanel />
                  </AdminRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
