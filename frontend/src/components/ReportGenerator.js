import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ReportGenerator() {
  const { user, isAuthenticated, getAuthHeaders } = useAuth();
  const [formData, setFormData] = useState({
    budget_code: '',
    type: 'program',
    year: new Date().getFullYear().toString(),
    report_name: '',
    is_public: false,
    includeMonthly: true,
    includeQuarterly: true,
    includeYearly: true,
    includeTop10: true,
    includeStructure: true,
    includeDynamics: true,
    includeForecast: false,
    forecastMethods: {
      arithmeticGrowth: false,
      movingAverage: false,
      exponential: false,
      regression: false,
    },
    alpha: 0.3,
    window: 3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myReports, setMyReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  
  // Budget selector state
  const [regions, setRegions] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingBudgets, setLoadingBudgets] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadMyReports();
    }
    loadRegions();
  }, [isAuthenticated]);

  // Load regions
  const loadRegions = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/regions`);
      if (response.ok) {
        const data = await response.json();
        setRegions(data || []);
      }
    } catch (err) {
      console.error('Failed to load regions:', err);
    }
  };

  // Load communities when region is selected
  useEffect(() => {
    if (selectedRegionId) {
      loadCommunities(selectedRegionId);
    } else {
      setCommunities([]);
      setSelectedCommunity(null);
    }
  }, [selectedRegionId]);

  const loadCommunities = async (regionId) => {
    setLoadingBudgets(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/communities`);
      if (response.ok) {
        const data = await response.json();
        const filtered = data.filter((c) => c.region_id === Number(regionId));
        
        // Find regional budget (code pattern: 3 digits + 7 zeros)
        const regionalBudget = filtered.find(
          (c) => /^...0000000$/.test(c.code)
        );
        
        let list = [];
        if (regionalBudget) {
          list = [regionalBudget, ...filtered.filter((c) => c.id !== regionalBudget.id)];
        } else {
          list = filtered;
        }
        
        setCommunities(list);
        if (list.length > 0 && !selectedCommunity) {
          setSelectedCommunity(list[0]);
          setFormData({ ...formData, budget_code: list[0].code });
        }
      }
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoadingBudgets(false);
    }
  };

  // Filter communities by search query
  const filteredCommunities = communities.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.code.includes(query)
    );
  });

  // Handle community selection
  const handleCommunitySelect = (community) => {
    setSelectedCommunity(community);
    setFormData({ ...formData, budget_code: community.code });
  };

  const loadMyReports = async () => {
    setLoadingReports(true);
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
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const truncateReportName = (name, maxLength = 35) => {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleGenerate = async () => {
    if (!formData.budget_code || !formData.year) {
      setError('Заповніть обов\'язкові поля (Код бюджету, Рік)');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/reports/generate`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка генерації звіту');
      }

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = formData.report_name
        ? `${formData.report_name.replace(/[^a-z0-9]/gi, '_')}.pdf`
        : `budget_report_${formData.budget_code}_${formData.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Звіт успішно згенеровано та завантажено!');
      loadMyReports();
    } catch (err) {
      setError(err.message || 'Помилка генерації звіту');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.budget_code || !formData.year || !formData.report_name) {
      setError('Заповніть обов\'язкові поля (Код бюджету, Рік, Назва звіту)');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/reports/create`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка створення звіту');
      }

      setSuccess('Звіт успішно створено!');
      loadMyReports();
      setFormData({
        ...formData,
        report_name: '',
      });
    } catch (err) {
      setError(err.message || 'Помилка створення звіту');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (reportId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/reports/${reportId}/download`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Помилка завантаження звіту');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const report = myReports.find((r) => r.id === reportId);
      a.download = report
        ? `${report.report_name.replace(/[^a-z0-9]/gi, '_')}.pdf`
        : `report_${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message || 'Помилка завантаження звіту');
    }
  };


  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Потрібна авторизація</h2>
          <p>Для генерації звітів потрібно увійти до системи.</p>
          <a href="/login" className="btn-primary">
            Увійти
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="report-generator-container">
      <div className="report-generator-header">
        <div>
          <h1>Генератор PDF звітів</h1>
          <p>Створюйте детальні звіти про бюджет у форматі PDF</p>
        </div>
        <div className="user-info">
          <span>Вітаємо, {user?.full_name || user?.email}!</span>
        </div>
      </div>

      <div className="report-generator-content">
        <div className="report-form-section">
          <h2>Параметри звіту</h2>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {/* Budget Selector */}
          <div className="form-section">
            <h3>Вибір бюджету</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="region">Регіон</label>
                <select
                  id="region"
                  value={selectedRegionId}
                  onChange={(e) => {
                    setSelectedRegionId(e.target.value);
                    setSelectedCommunity(null);
                    setFormData({ ...formData, budget_code: '' });
                  }}
                >
                  <option value="">Всі регіони</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="budget_search">Пошук за назвою або кодом</label>
                <input
                  id="budget_search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Введіть назву або код..."
                  disabled={!selectedRegionId && communities.length === 0}
                />
              </div>
            </div>

            {loadingBudgets ? (
              <p>Завантаження бюджетів...</p>
            ) : filteredCommunities.length > 0 ? (
              <div className="budget-selector">
                <label className="field-label">Оберіть бюджет:</label>
                <div className="budget-list">
                  {filteredCommunities.map((community) => (
                    <div
                      key={community.id}
                      className={`budget-item ${
                        selectedCommunity?.id === community.id ? 'selected' : ''
                      }`}
                      onClick={() => handleCommunitySelect(community)}
                    >
                      <div className="budget-item-name">{community.name}</div>
                      <div className="budget-item-code">{community.code}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedRegionId ? (
              <p className="empty-message">Бюджетів не знайдено для цього регіону</p>
            ) : (
              <p className="empty-message">Оберіть регіон для перегляду бюджетів</p>
            )}

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label htmlFor="budget_code">Або введіть код бюджету вручну *</label>
              <input
                id="budget_code"
                name="budget_code"
                type="text"
                value={formData.budget_code}
                onChange={handleChange}
                required
                placeholder="123456"
              />
            </div>
          </div>

          <div className="form-grid">

            <div className="form-group">
              <label htmlFor="type">Тип класифікації *</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
              >
                <option value="program">Програмна</option>
                <option value="economic">Економічна</option>
                <option value="functional">Функціональна</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="year">Рік *</label>
              <input
                id="year"
                name="year"
                type="number"
                value={formData.year}
                onChange={handleChange}
                required
                min="2000"
                max={new Date().getFullYear()}
              />
            </div>

            <div className="form-group">
              <label htmlFor="report_name">Назва звіту (для збереження)</label>
              <input
                id="report_name"
                name="report_name"
                type="text"
                value={formData.report_name}
                onChange={handleChange}
                placeholder="Звіт про бюджет 2024"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Включити статистику</h3>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="includeMonthly"
                  checked={formData.includeMonthly}
                  onChange={handleChange}
                />
                Помісячна статистика
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="includeQuarterly"
                  checked={formData.includeQuarterly}
                  onChange={handleChange}
                />
                Поквартальна статистика
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="includeYearly"
                  checked={formData.includeYearly}
                  onChange={handleChange}
                />
                Річна статистика
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="includeTop10"
                  checked={formData.includeTop10}
                  onChange={handleChange}
                />
                ТОП-10 кодів
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="includeStructure"
                  checked={formData.includeStructure}
                  onChange={handleChange}
                />
                Структура видатків (%)
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="includeDynamics"
                  checked={formData.includeDynamics}
                  onChange={handleChange}
                />
                Динаміка за роками
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="includeForecast"
                  checked={formData.includeForecast}
                  onChange={handleChange}
                />
                Прогноз
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Прогнозування</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="includeForecast"
                checked={formData.includeForecast}
                onChange={handleChange}
              />
              Включити прогноз
            </label>

            {formData.includeForecast && (
              <>
                <div style={{ marginTop: '16px', marginBottom: '12px' }}>
                  <label className="field-label">Оберіть методи прогнозування:</label>
                </div>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.forecastMethods.arithmeticGrowth}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          forecastMethods: {
                            ...formData.forecastMethods,
                            arithmeticGrowth: e.target.checked,
                          },
                        });
                      }}
                    />
                    Середній темп приросту
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.forecastMethods.movingAverage}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          forecastMethods: {
                            ...formData.forecastMethods,
                            movingAverage: e.target.checked,
                          },
                        });
                      }}
                    />
                    Ковзне середнє
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.forecastMethods.exponential}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          forecastMethods: {
                            ...formData.forecastMethods,
                            exponential: e.target.checked,
                          },
                        });
                      }}
                    />
                    Експоненційне згладжування
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.forecastMethods.regression}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          forecastMethods: {
                            ...formData.forecastMethods,
                            regression: e.target.checked,
                          },
                        });
                      }}
                    />
                    Лінійна регресія
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: '16px' }}>
                  <div className="form-group">
                    <label htmlFor="alpha">Alpha (0-1)</label>
                    <input
                      id="alpha"
                      name="alpha"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={formData.alpha}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="window">Вікно (років)</label>
                    <input
                      id="window"
                      name="window"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.window}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_public"
                checked={formData.is_public}
                onChange={handleChange}
              />
              Зробити звіт публічним
            </label>
          </div>

          <div className="form-actions">
            <button
              onClick={handleGenerate}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Генерація...' : 'Згенерувати та завантажити PDF'}
            </button>
            {formData.report_name && (
              <button
                onClick={handleCreate}
                className="btn-secondary"
                disabled={loading}
              >
                {loading ? 'Створення...' : 'Створити та зберегти'}
              </button>
            )}
          </div>
        </div>

        <div className="reports-list-section">
          <h2>Мої звіти</h2>
          {loadingReports ? (
            <p>Завантаження...</p>
          ) : myReports.length === 0 ? (
            <p className="empty-message">У вас поки немає збережених звітів</p>
          ) : (
            <div className="reports-list">
              {myReports.map((report) => (
                <div key={report.id} className="report-item">
                  <div className="report-item-info">
                    <h4 
                      title={report.report_name}
                      className="report-item-name"
                    >
                      {truncateReportName(report.report_name, 35)}
                    </h4>
                    <p>
                      Бюджет: {report.budget_code} | Рік: {report.year}
                    </p>
                    <p className="report-meta">
                      {new Date(report.created_at).toLocaleDateString('uk-UA')}
                      {report.is_public && (
                        <span className="public-badge">Публічний</span>
                      )}
                    </p>
                  </div>
                  <div className="report-item-actions">
                    <button
                      onClick={() => handleDownload(report.id)}
                      className="btn-small"
                    >
                      Завантажити
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

