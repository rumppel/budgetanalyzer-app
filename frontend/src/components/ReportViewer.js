import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ReportViewer() {
  const { isAuthenticated, user, getAuthHeaders } = useAuth();
  const [publicReports, setPublicReports] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [activeTab, setActiveTab] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPublicReports();
    if (isAuthenticated) {
      loadMyReports();
    }
  }, [isAuthenticated]);

  const loadPublicReports = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/reports/public?limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        setPublicReports(data.reports || []);
      } else {
        throw new Error('Failed to load public reports');
      }
    } catch (err) {
      setError(err.message || 'Помилка завантаження публічних звітів');
    } finally {
      setLoading(false);
    }
  };

  const loadMyReports = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/reports/my`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setMyReports(data.reports || []);
      } else {
        throw new Error('Failed to load your reports');
      }
    } catch (err) {
      setError(err.message || 'Помилка завантаження ваших звітів');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (reportId, reportName) => {
    try {
      const headers = isAuthenticated ? getAuthHeaders() : {};
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/reports/${reportId}/download`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Немає доступу до цього звіту');
        }
        throw new Error('Помилка завантаження звіту');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportName
        ? `${reportName.replace(/[^a-z0-9]/gi, '_')}.pdf`
        : `report_${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message || 'Помилка завантаження звіту');
    }
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей звіт? Цю дію неможливо скасувати.')) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/reports/${reportId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка видалення звіту');
      }

      // Reload reports list
      await loadMyReports();
      if (activeTab === 'public') {
        await loadPublicReports();
      }
    } catch (err) {
      console.error('Error deleting report:', err);
      setError(err.message || 'Помилка видалення звіту');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const truncateReportName = (name, maxLength = 40) => {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  const renderReportList = (reports) => {
    if (reports.length === 0) {
      return (
        <div className="empty-message">
          {activeTab === 'public'
            ? 'Публічних звітів поки немає'
            : 'У вас поки немає збережених звітів'}
        </div>
      );
    }

    return (
      <div className="reports-grid">
        {reports.map((report) => (
          <div key={report.id} className="report-card">
            <div className="report-card-header">
              <h3 
                title={report.report_name || `Звіт ${report.id}`}
                className="report-name"
              >
                {truncateReportName(report.report_name || `Звіт ${report.id}`, 40)}
              </h3>
              {report.is_public && (
                <span className="public-badge">Публічний</span>
              )}
            </div>
            <div className="report-card-body">
              <div className="report-info-item">
                <span className="report-info-label">Код бюджету:</span>
                <span className="report-info-value">{report.budget_code}</span>
              </div>
              <div className="report-info-item">
                <span className="report-info-label">Рік:</span>
                <span className="report-info-value">{report.year}</span>
              </div>
              <div className="report-info-item">
                <span className="report-info-label">Створено:</span>
                <span className="report-info-value">
                  {formatDate(report.created_at)}
                </span>
              </div>
              {report.params && typeof report.params === 'object' && (
                <div className="report-info-item">
                  <span className="report-info-label">Тип:</span>
                  <span className="report-info-value">
                    {report.params.type || 'economic'}
                  </span>
                </div>
              )}
            </div>
            <div className="report-card-footer">
              <button
                onClick={() => handleDownload(report.id, report.report_name)}
                className="btn-primary btn-small"
              >
                Завантажити PDF
              </button>
              {/* Show delete button only for own reports in "my" tab */}
              {activeTab === 'my' && isAuthenticated && (
                <button
                  onClick={() => handleDelete(report.id)}
                  className="btn-small btn-danger"
                  style={{ marginLeft: '8px' }}
                >
                  Видалити
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="report-viewer-container">
      <div className="report-viewer-header">
        <h1>Перегляд звітів</h1>
        <p>Переглядайте публічні звіти та свої збережені звіти</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tab-switcher">
        <button
          className={`tab ${activeTab === 'public' ? 'active' : ''}`}
          onClick={() => setActiveTab('public')}
        >
          Публічні звіти
        </button>
        {isAuthenticated && (
          <button
            className={`tab ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            Мої звіти
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Завантаження...</div>
      ) : (
        <div className="reports-content">
          {activeTab === 'public' && renderReportList(publicReports)}
          {activeTab === 'my' && isAuthenticated && renderReportList(myReports)}
        </div>
      )}

      {!isAuthenticated && activeTab === 'my' && (
        <div className="auth-prompt">
          <p>Для перегляду своїх звітів потрібно увійти до системи.</p>
          <a href="/login" className="btn-primary">
            Увійти
          </a>
        </div>
      )}
    </div>
  );
}

