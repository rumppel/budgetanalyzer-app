import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function SyncManagement() {
  const { getAuthHeaders } = useAuth();
  const [syncResults, setSyncResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [filters, setFilters] = useState({
    endpoint: '',
    status: ''
  });
  const [sortField, setSortField] = useState('last_synced');
  const [sortDirection, setSortDirection] = useState('desc');
  const [syncForm, setSyncForm] = useState({
    year: new Date().getFullYear(),
    types: ['program'],
    period: 'MONTH',
    budget_code: '',
    region_code: '',
    limit: ''
  });

  useEffect(() => {
    loadSyncResults();
  }, [page, filters, limit]);

  // Sort results using useMemo to avoid infinite loops
  const sortedResults = useMemo(() => {
    if (syncResults.length === 0) return syncResults;
    
    return [...syncResults].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'id':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'endpoint':
          aVal = (a.endpoint || '').toLowerCase();
          bVal = (b.endpoint || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        case 'total_records':
          aVal = a.total_records || 0;
          bVal = b.total_records || 0;
          break;
        case 'last_synced':
          aVal = new Date(a.last_synced || 0).getTime();
          bVal = new Date(b.last_synced || 0).getTime();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [syncResults, sortField, sortDirection]);

  const loadSyncResults = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (filters.endpoint) params.append('endpoint', filters.endpoint);
      if (filters.status) params.append('status', filters.status);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/sync/results?${params}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Помилка завантаження результатів синхронізації');
      }

      const data = await response.json();
      setSyncResults(data.results || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Помилка завантаження результатів');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleTriggerSync = async () => {
    if (!syncForm.year) {
      setError('Рік обов\'язковий');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        year: parseInt(syncForm.year),
        types: Array.isArray(syncForm.types) ? syncForm.types : [syncForm.types],
        period: syncForm.period
      };

      if (syncForm.budget_code) {
        payload.budget_code = syncForm.budget_code;
      }
      if (syncForm.region_code) {
        payload.region_code = syncForm.region_code;
      }
      if (syncForm.limit) {
        payload.limit = parseInt(syncForm.limit);
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/sync/trigger`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка запуску синхронізації');
      }

      setSuccess('Синхронізацію запущено. Результати з\'являться після завершення.');
      setTimeout(() => {
        setSuccess('');
        loadSyncResults();
      }, 3000);
    } catch (err) {
      setError(err.message || 'Помилка запуску синхронізації');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <h2>Синхронізація з API OpenBudget</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="sync-form-container">
        <h3>Запуск синхронізації</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Рік *:</label>
            <input
              type="number"
              value={syncForm.year}
              onChange={(e) => setSyncForm({ ...syncForm, year: e.target.value })}
              className="form-input"
              min="2020"
              max="2030"
            />
          </div>
          <div className="form-group">
            <label>Типи класифікації:</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={syncForm.types.includes('program')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSyncForm({ ...syncForm, types: [...syncForm.types, 'program'] });
                    } else {
                      setSyncForm({ ...syncForm, types: syncForm.types.filter(t => t !== 'program') });
                    }
                  }}
                />
                <span>Програмна</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={syncForm.types.includes('functional')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSyncForm({ ...syncForm, types: [...syncForm.types, 'functional'] });
                    } else {
                      setSyncForm({ ...syncForm, types: syncForm.types.filter(t => t !== 'functional') });
                    }
                  }}
                />
                <span>Функціональна</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={syncForm.types.includes('economic')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSyncForm({ ...syncForm, types: [...syncForm.types, 'economic'] });
                    } else {
                      setSyncForm({ ...syncForm, types: syncForm.types.filter(t => t !== 'economic') });
                    }
                  }}
                />
                <span>Економічна</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>Період:</label>
            <select
              value={syncForm.period}
              onChange={(e) => setSyncForm({ ...syncForm, period: e.target.value })}
              className="form-input"
            >
              <option value="MONTH">Місяць</option>
              <option value="QUARTER">Квартал</option>
            </select>
          </div>
          <div className="form-group">
            <label>Код бюджету (опціонально):</label>
            <input
              type="text"
              value={syncForm.budget_code}
              onChange={(e) => setSyncForm({ ...syncForm, budget_code: e.target.value, region_code: '' })}
              className="form-input"
              placeholder="Наприклад: 01000000000"
            />
          </div>
          <div className="form-group">
            <label>Код регіону (опціонально):</label>
            <input
              type="text"
              value={syncForm.region_code}
              onChange={(e) => setSyncForm({ ...syncForm, region_code: e.target.value, budget_code: '' })}
              className="form-input"
              placeholder="Наприклад: 01"
            />
          </div>
          <div className="form-group">
            <label>Ліміт (опціонально):</label>
            <input
              type="number"
              value={syncForm.limit}
              onChange={(e) => setSyncForm({ ...syncForm, limit: e.target.value })}
              className="form-input"
              placeholder="Кількість бюджетів"
            />
          </div>
        </div>
        <button onClick={handleTriggerSync} className="btn-primary" disabled={loading}>
          Запустити синхронізацію
        </button>
      </div>

      <div className="sync-results-container">
        <h3>Результати синхронізації</h3>
        <div className="filters">
          <input
            type="text"
            placeholder="Фільтр по endpoint..."
            value={filters.endpoint}
            onChange={(e) => setFilters({ ...filters, endpoint: e.target.value })}
            className="form-input"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="form-input"
          >
            <option value="">Всі статуси</option>
            <option value="success">Успішно</option>
            <option value="error">Помилка</option>
          </select>
        </div>

        {loading && !syncResults.length && <div className="loading">Завантаження...</div>}

        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th 
                  className="sortable-header"
                  onClick={() => handleSort('id')}
                  style={{ cursor: 'pointer' }}
                >
                  ID {getSortIcon('id')}
                </th>
                <th 
                  className="sortable-header"
                  onClick={() => handleSort('endpoint')}
                  style={{ cursor: 'pointer' }}
                >
                  Endpoint {getSortIcon('endpoint')}
                </th>
                <th 
                  className="sortable-header"
                  onClick={() => handleSort('status')}
                  style={{ cursor: 'pointer' }}
                >
                  Статус {getSortIcon('status')}
                </th>
                <th 
                  className="sortable-header"
                  onClick={() => handleSort('total_records')}
                  style={{ cursor: 'pointer' }}
                >
                  Записів {getSortIcon('total_records')}
                </th>
                <th 
                  className="sortable-header"
                  onClick={() => handleSort('last_synced')}
                  style={{ cursor: 'pointer' }}
                >
                  Дата синхронізації {getSortIcon('last_synced')}
                </th>
                <th>Деталі</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result) => (
                <tr key={result.id}>
                  <td>{result.id}</td>
                  <td>{result.endpoint}</td>
                  <td>
                    <span className={`badge ${result.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                      {result.status}
                    </span>
                  </td>
                  <td>{result.total_records || 0}</td>
                  <td>{new Date(result.last_synced).toLocaleString('uk-UA')}</td>
                  <td>
                    {result.details && (
                      <details>
                        <summary>Деталі</summary>
                        <pre>{JSON.stringify(result.details, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="btn-secondary"
          >
            Попередня
          </button>
          <span>Сторінка {page} з {Math.ceil(total / limit)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / limit) || loading}
            className="btn-secondary"
          >
            Наступна
          </button>
        </div>
      </div>
    </div>
  );
}

