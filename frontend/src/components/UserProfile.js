import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function UserProfile() {
  const { user, isAuthenticated, getAuthHeaders, login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'user',
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Load user profile
    loadProfile();
  }, [isAuthenticated, navigate]);

  const loadProfile = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/me`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFormData({
          email: data.user.email || '',
          full_name: data.user.full_name || '',
          role: data.user.role || 'user',
        });
      } else {
        throw new Error('Failed to load profile');
      }
    } catch (err) {
      setError(err.message || 'Помилка завантаження профілю');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setSuccess('');
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/profile`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка оновлення профілю');
      }

      const data = await response.json();
      setSuccess('Профіль успішно оновлено!');
      
      // Update user in context if email changed (might need re-login)
      if (data.user.email !== user.email) {
        // Optionally refresh the auth context
        window.location.reload();
      }
    } catch (err) {
      setError(err.message || 'Помилка оновлення профілю');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('Нові паролі не співпадають');
      return;
    }

    if (passwordData.new_password.length < 6) {
      setPasswordError('Новий пароль повинен містити принаймні 6 символів');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/password`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            current_password: passwordData.current_password,
            new_password: passwordData.new_password,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка зміни паролю');
      }

      setPasswordSuccess('Пароль успішно змінено!');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      setPasswordError(err.message || 'Помилка зміни паролю');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>Мій профіль</h1>
        <p>Керуйте своїм обліковим записом та налаштуваннями</p>
      </div>

      <div className="profile-content">
        <div className="profile-section">
          <h2>Інформація профілю</h2>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="full_name">Повне ім'я</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                required
                placeholder="Іван Іванов"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your@email.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Роль</label>
              <input
                id="role"
                name="role"
                type="text"
                value={formData.role}
                disabled
                className="input-disabled"
              />
              <small className="form-hint">
                Роль може змінити тільки адміністратор
              </small>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </form>
        </div>

        <div className="profile-section">
          <h2>Зміна паролю</h2>

          {passwordError && (
            <div className="error-message">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="success-message">{passwordSuccess}</div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label htmlFor="current_password">Поточний пароль</label>
              <input
                id="current_password"
                name="current_password"
                type="password"
                value={passwordData.current_password}
                onChange={handlePasswordChange}
                required
                placeholder="••••••••"
              />
            </div>

            <div className="form-group">
              <label htmlFor="new_password">Новий пароль</label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                required
                placeholder="Мінімум 6 символів"
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">Підтвердіть новий пароль</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                value={passwordData.confirm_password}
                onChange={handlePasswordChange}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={passwordLoading}
            >
              {passwordLoading ? 'Зміна...' : 'Змінити пароль'}
            </button>
          </form>
        </div>

        <div className="profile-section">
          <h2>Інформація про обліковий запис</h2>
          <div className="account-info">
            <div className="info-item">
              <span className="info-label">ID користувача:</span>
              <span className="info-value">{user?.id}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Дата реєстрації:</span>
              <span className="info-value">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('uk-UA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Невідомо'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

