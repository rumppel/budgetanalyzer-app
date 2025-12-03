import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function UserManagement() {
  const { getAuthHeaders } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [editingUser, setEditingUser] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'user'
  });
  const [passwordData, setPasswordData] = useState({
    password: ''
  });
  const [showReportsModal, setShowReportsModal] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [selectedReports, setSelectedReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [page]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/users?page=${page}&limit=${limit}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Помилка завантаження користувачів');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Помилка завантаження користувачів');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user.id);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role
    });
    setShowPasswordForm(null);
  };

  const handleCancel = () => {
    setEditingUser(null);
    setShowPasswordForm(null);
    setFormData({ email: '', full_name: '', role: 'user' });
    setPasswordData({ password: '' });
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/users/${editingUser}`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(formData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка оновлення користувача');
      }

      setSuccess('Користувача оновлено успішно');
      setEditingUser(null);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Помилка оновлення користувача');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.password || passwordData.password.length < 6) {
      setError('Пароль повинен містити мінімум 6 символів');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/users/${showPasswordForm}/password`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ password: passwordData.password })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка зміни пароля');
      }

      setSuccess('Пароль змінено успішно');
      setShowPasswordForm(null);
      setPasswordData({ password: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Помилка зміни пароля');
    } finally {
      setLoading(false);
    }
  };

  const loadUserReports = async (userId) => {
    setLoadingReports(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/users/${userId}/reports`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Помилка завантаження звітів');
      }

      const data = await response.json();
      setUserReports(data.reports || []);
      setSelectedReports([]);
    } catch (err) {
      setError(err.message || 'Помилка завантаження звітів');
    } finally {
      setLoadingReports(false);
    }
  };

  const handleShowReports = async (userId) => {
    setShowReportsModal(userId);
    await loadUserReports(userId);
  };

  const handleToggleReportSelection = (reportId) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleSelectAllReports = () => {
    if (selectedReports.length === userReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(userReports.map(r => r.id));
    }
  };

  const handleDeleteSelectedReports = async (userId) => {
    if (selectedReports.length === 0) {
      setError('Виберіть звіти для видалення');
      return;
    }

    if (!window.confirm(`Ви впевнені, що хочете видалити ${selectedReports.length} обраних звітів?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/users/${userId}/reports`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
          body: JSON.stringify({ report_ids: selectedReports })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка видалення звітів');
      }

      const data = await response.json();
      setSuccess(`Видалено ${data.deleted} звітів`);
      await loadUserReports(userId);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Помилка видалення звітів');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllReports = async (userId) => {
    if (!window.confirm('Ви впевнені, що хочете видалити всі звіти цього користувача?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/users/${userId}/reports`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка видалення звітів');
      }

      const data = await response.json();
      setSuccess(`Видалено ${data.deleted} звітів`);
      await loadUserReports(userId);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Помилка видалення звітів');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('УВАГА! Ви збираєтесь видалити користувача та всі його звіти. Продовжити?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/admin/users/${userId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка видалення користувача');
      }

      setSuccess('Користувача видалено успішно');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Помилка видалення користувача');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <h2>Управління користувачами</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading && !users.length && <div className="loading">Завантаження...</div>}

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Ім'я</th>
              <th>Роль</th>
              <th>Звітів</th>
              <th>Дата створення</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                {editingUser === user.id ? (
                  <>
                    <td>{user.id}</td>
                    <td>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="form-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="form-input"
                      />
                    </td>
                    <td>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="form-input"
                      >
                        <option value="user">Користувач</option>
                        <option value="admin">Адміністратор</option>
                      </select>
                    </td>
                    <td>{user.reports_count || 0}</td>
                    <td>{new Date(user.created_at).toLocaleDateString('uk-UA')}</td>
                    <td>
                      <button onClick={handleSave} className="btn-primary btn-small">
                        Зберегти
                      </button>
                      <button onClick={handleCancel} className="btn-secondary btn-small">
                        Скасувати
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{user.id}</td>
                    <td>{user.email}</td>
                    <td>{user.full_name}</td>
                    <td>
                      <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                        {user.role === 'admin' ? 'Адмін' : 'Користувач'}
                      </span>
                    </td>
                    <td>{user.reports_count || 0}</td>
                    <td>{new Date(user.created_at).toLocaleDateString('uk-UA')}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEdit(user)}
                          className="btn-primary btn-small"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => setShowPasswordForm(user.id)}
                          className="btn-secondary btn-small"
                        >
                          Пароль
                        </button>
                        <button
                          onClick={() => handleShowReports(user.id)}
                          className="btn-secondary btn-small"
                        >
                          Звіти ({user.reports_count || 0})
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
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

      {showPasswordForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Зміна пароля</h3>
            <div className="form-group">
              <label>Новий пароль:</label>
              <input
                type="password"
                value={passwordData.password}
                onChange={(e) => setPasswordData({ password: e.target.value })}
                className="form-input"
                placeholder="Мінімум 6 символів"
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleChangePassword} className="btn-primary">
                Змінити пароль
              </button>
              <button onClick={handleCancel} className="btn-secondary">
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportsModal && (
        <div className="modal-overlay" onClick={() => setShowReportsModal(null)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h3>Звіти користувача</h3>
            {loadingReports ? (
              <div className="loading">Завантаження...</div>
            ) : (
              <>
                {userReports.length > 0 && (
                  <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleSelectAllReports}
                      className="btn-secondary btn-small"
                    >
                      {selectedReports.length === userReports.length ? 'Зняти вибір' : 'Вибрати всі'}
                    </button>
                    <span>
                      Обрано: {selectedReports.length} з {userReports.length}
                    </span>
                    {selectedReports.length > 0 && (
                      <button
                        onClick={() => handleDeleteSelectedReports(showReportsModal)}
                        className="btn-danger btn-small"
                      >
                        Видалити обрані ({selectedReports.length})
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAllReports(showReportsModal)}
                      className="btn-warning btn-small"
                    >
                      Видалити всі
                    </button>
                  </div>
                )}
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={selectedReports.length === userReports.length && userReports.length > 0}
                            onChange={handleSelectAllReports}
                          />
                        </th>
                        <th>ID</th>
                        <th>Назва</th>
                        <th>Код бюджету</th>
                        <th>Рік</th>
                        <th>Публічний</th>
                        <th>Дата створення</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userReports.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                            Немає звітів
                          </td>
                        </tr>
                      ) : (
                        userReports.map((report) => (
                          <tr key={report.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedReports.includes(report.id)}
                                onChange={() => handleToggleReportSelection(report.id)}
                              />
                            </td>
                            <td>{report.id}</td>
                            <td>{report.report_name || '-'}</td>
                            <td>{report.budget_code || '-'}</td>
                            <td>{report.year || '-'}</td>
                            <td>
                              <span className={`badge ${report.is_public ? 'badge-success' : 'badge-user'}`}>
                                {report.is_public ? 'Так' : 'Ні'}
                              </span>
                            </td>
                            <td>{new Date(report.created_at).toLocaleString('uk-UA')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button onClick={() => setShowReportsModal(null)} className="btn-secondary">
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

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

