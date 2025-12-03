import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function BudgetStructureModeration() {
  const { getAuthHeaders } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [filters, setFilters] = useState({
    cod_budget: '',
    rep_period: '',
    cod_cons_mb_pk: '',
    classification_type: ''
  });
  const [editingRecord, setEditingRecord] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    rep_period: '',
    fund_typ: '',
    cod_budget: '',
    cod_cons_mb_pk: '',
    cod_cons_mb_pk_name: '',
    zat_amt: '',
    plans_amt: '',
    fakt_amt: '',
    classification_type: ''
  });

  useEffect(() => {
    loadRecords();
  }, [page, filters]);

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (filters.cod_budget) params.append('cod_budget', filters.cod_budget);
      if (filters.rep_period) params.append('rep_period', filters.rep_period);
      if (filters.cod_cons_mb_pk) params.append('cod_cons_mb_pk', filters.cod_cons_mb_pk);
      if (filters.classification_type) params.append('classification_type', filters.classification_type);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/budget-structure?${params}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Помилка завантаження записів');
      }

      const data = await response.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Помилка завантаження записів');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record.id);
    setFormData({
      rep_period: record.rep_period || '',
      fund_typ: record.fund_typ || '',
      cod_budget: record.cod_budget || '',
      cod_cons_mb_pk: record.cod_cons_mb_pk || '',
      cod_cons_mb_pk_name: record.cod_cons_mb_pk_name || '',
      zat_amt: record.zat_amt || '',
      plans_amt: record.plans_amt || '',
      fakt_amt: record.fakt_amt || '',
      classification_type: record.classification_type || ''
    });
    setShowCreateForm(false);
  };

  const handleCancel = () => {
    setEditingRecord(null);
    setShowCreateForm(false);
    setFormData({
      rep_period: '',
      fund_typ: '',
      cod_budget: '',
      cod_cons_mb_pk: '',
      cod_cons_mb_pk_name: '',
      zat_amt: '',
      plans_amt: '',
      fakt_amt: '',
      classification_type: ''
    });
  };

  const handleSave = async () => {
    if (!formData.rep_period || !formData.cod_budget || !formData.cod_cons_mb_pk) {
      setError('rep_period, cod_budget та cod_cons_mb_pk обов\'язкові');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const url = editingRecord
        ? `${process.env.REACT_APP_API_URL}/admin/budget-structure/${editingRecord}`
        : `${process.env.REACT_APP_API_URL}/admin/budget-structure`;
      const method = editingRecord ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        zat_amt: parseFloat(formData.zat_amt) || 0,
        plans_amt: parseFloat(formData.plans_amt) || 0,
        fakt_amt: parseFloat(formData.fakt_amt) || 0,
        classification_type: formData.classification_type || null
      };

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка збереження запису');
      }

      setSuccess(editingRecord ? 'Запис оновлено успішно' : 'Запис створено успішно');
      setEditingRecord(null);
      setShowCreateForm(false);
      loadRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Помилка збереження запису');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('УВАГА! Ви збираєтесь змінити дані з API. Ви впевнені, що хочете видалити цей запис?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/budget-structure/${id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка видалення запису');
      }

      setSuccess('Запис видалено успішно');
      loadRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Помилка видалення запису');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <h2>Модерація даних про бюджети</h2>
      <p className="warning-text">
        ⚠️ Увага! Ви збираєтесь змінити дані з API. Будьте обережні при редагуванні, видаленні або додаванні записів.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="admin-actions">
        <button onClick={() => setShowCreateForm(true)} className="btn-primary">
          + Додати запис
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Фільтр по cod_budget..."
          value={filters.cod_budget}
          onChange={(e) => setFilters({ ...filters, cod_budget: e.target.value })}
          className="form-input"
        />
        <input
          type="text"
          placeholder="Фільтр по rep_period..."
          value={filters.rep_period}
          onChange={(e) => setFilters({ ...filters, rep_period: e.target.value })}
          className="form-input"
        />
        <input
          type="text"
          placeholder="Фільтр по cod_cons_mb_pk..."
          value={filters.cod_cons_mb_pk}
          onChange={(e) => setFilters({ ...filters, cod_cons_mb_pk: e.target.value })}
          className="form-input"
        />
        <select
          value={filters.classification_type}
          onChange={(e) => setFilters({ ...filters, classification_type: e.target.value })}
          className="form-input"
        >
          <option value="">Всі типи</option>
          <option value="PROGRAM">PROGRAM</option>
          <option value="FUNCTIONAL">FUNCTIONAL</option>
          <option value="ECONOMIC">ECONOMIC</option>
        </select>
      </div>

      {(showCreateForm || editingRecord) && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h3>{editingRecord ? 'Редагування запису' : 'Створення запису'}</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>rep_period *:</label>
                <input
                  type="text"
                  value={formData.rep_period}
                  onChange={(e) => setFormData({ ...formData, rep_period: e.target.value })}
                  className="form-input"
                  placeholder="Наприклад: 2024-01"
                />
              </div>
              <div className="form-group">
                <label>fund_typ:</label>
                <input
                  type="text"
                  value={formData.fund_typ}
                  onChange={(e) => setFormData({ ...formData, fund_typ: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>cod_budget *:</label>
                <input
                  type="text"
                  value={formData.cod_budget}
                  onChange={(e) => setFormData({ ...formData, cod_budget: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>cod_cons_mb_pk *:</label>
                <input
                  type="text"
                  value={formData.cod_cons_mb_pk}
                  onChange={(e) => setFormData({ ...formData, cod_cons_mb_pk: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>cod_cons_mb_pk_name:</label>
                <input
                  type="text"
                  value={formData.cod_cons_mb_pk_name}
                  onChange={(e) => setFormData({ ...formData, cod_cons_mb_pk_name: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>zat_amt:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.zat_amt}
                  onChange={(e) => setFormData({ ...formData, zat_amt: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>plans_amt:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.plans_amt}
                  onChange={(e) => setFormData({ ...formData, plans_amt: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>fakt_amt:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.fakt_amt}
                  onChange={(e) => setFormData({ ...formData, fakt_amt: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>classification_type:</label>
                <select
                  value={formData.classification_type}
                  onChange={(e) => setFormData({ ...formData, classification_type: e.target.value })}
                  className="form-input"
                >
                  <option value="">Не вказано</option>
                  <option value="PROGRAM">PROGRAM</option>
                  <option value="FUNCTIONAL">FUNCTIONAL</option>
                  <option value="ECONOMIC">ECONOMIC</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={handleSave} className="btn-primary" disabled={loading}>
                Зберегти
              </button>
              <button onClick={handleCancel} className="btn-secondary">
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && !records.length && <div className="loading">Завантаження...</div>}

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>rep_period</th>
              <th>cod_budget</th>
              <th>cod_cons_mb_pk</th>
              <th>Назва</th>
              <th>zat_amt</th>
              <th>plans_amt</th>
              <th>fakt_amt</th>
              <th>Тип</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                {editingRecord === record.id ? (
                  <>
                    <td>{record.id}</td>
                    <td colSpan="8">
                      <div className="form-grid">
                        <div className="form-group">
                          <label>rep_period:</label>
                          <input
                            type="text"
                            value={formData.rep_period}
                            onChange={(e) => setFormData({ ...formData, rep_period: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>cod_budget:</label>
                          <input
                            type="text"
                            value={formData.cod_budget}
                            onChange={(e) => setFormData({ ...formData, cod_budget: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>cod_cons_mb_pk:</label>
                          <input
                            type="text"
                            value={formData.cod_cons_mb_pk}
                            onChange={(e) => setFormData({ ...formData, cod_cons_mb_pk: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Назва:</label>
                          <input
                            type="text"
                            value={formData.cod_cons_mb_pk_name}
                            onChange={(e) => setFormData({ ...formData, cod_cons_mb_pk_name: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>zat_amt:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.zat_amt}
                            onChange={(e) => setFormData({ ...formData, zat_amt: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>plans_amt:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.plans_amt}
                            onChange={(e) => setFormData({ ...formData, plans_amt: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>fakt_amt:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.fakt_amt}
                            onChange={(e) => setFormData({ ...formData, fakt_amt: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Тип:</label>
                          <select
                            value={formData.classification_type}
                            onChange={(e) => setFormData({ ...formData, classification_type: e.target.value })}
                            className="form-input"
                          >
                            <option value="">Не вказано</option>
                            <option value="PROGRAM">PROGRAM</option>
                            <option value="FUNCTIONAL">FUNCTIONAL</option>
                            <option value="ECONOMIC">ECONOMIC</option>
                          </select>
                        </div>
                      </div>
                      <div className="action-buttons">
                        <button onClick={handleSave} className="btn-primary btn-small">
                          Зберегти
                        </button>
                        <button onClick={handleCancel} className="btn-secondary btn-small">
                          Скасувати
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{record.id}</td>
                    <td>{record.rep_period}</td>
                    <td>{record.cod_budget}</td>
                    <td>{record.cod_cons_mb_pk}</td>
                    <td title={record.cod_cons_mb_pk_name}>
                      {record.cod_cons_mb_pk_name ? (record.cod_cons_mb_pk_name.length > 30 
                        ? record.cod_cons_mb_pk_name.substring(0, 30) + '...' 
                        : record.cod_cons_mb_pk_name) : '-'}
                    </td>
                    <td>{parseFloat(record.zat_amt || 0).toLocaleString('uk-UA')}</td>
                    <td>{parseFloat(record.plans_amt || 0).toLocaleString('uk-UA')}</td>
                    <td>{parseFloat(record.fakt_amt || 0).toLocaleString('uk-UA')}</td>
                    <td>{record.classification_type || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEdit(record)}
                          className="btn-primary btn-small"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="btn-danger btn-small"
                        >
                          Видалити
                        </button>
                      </div>
                    </td>
                  </>
                )}
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
  );
}

