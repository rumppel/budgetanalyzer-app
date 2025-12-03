import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Пароль повинен містити принаймні 6 символів');
      return;
    }

    setLoading(true);

    try {
      await register(formData.email, formData.password, formData.full_name, formData.role);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Помилка реєстрації');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Реєстрація</h2>
        <p className="auth-subtitle">Створіть новий обліковий запис</p>

        {error && <div className="error-message">{error}</div>}

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
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Мінімум 6 символів"
              minLength={6}
            />
          </div>

          {/* <div className="form-group">
            <label htmlFor="role">Роль</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="user">Користувач</option>
              <option value="admin">Адміністратор</option>
            </select>
          </div> */}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Реєстрація...' : 'Зареєструватися'}
          </button>
        </form>

        <p className="auth-footer">
          Вже маєте обліковий запис?{' '}
          <Link to="/login">Увійти</Link>
        </p>
      </div>
    </div>
  );
}

