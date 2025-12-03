// src/components/RegionPanel.js
import React, { useEffect, useState, useMemo } from 'react';
import StatsPanel from "./StatsPanel";
import ForecastPanel from "./ForecastPanel";
const YEAR_DEFAULT = 2024;

export default function RegionPanel({ region, onClose }) {
  const [communities, setCommunities] = useState([]);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [activeTab, setActiveTab] = useState("analytics"); 

  const [year, setYear] = useState(YEAR_DEFAULT);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);

  const [budgetType, setBudgetType] = useState("program"); // program | functional | economic
  const [sortMode, setSortMode] = useState("fact"); 
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const isCommunity = region.type === "community";

  // ------------------------------
  // 1) Завантаження громад або обласного бюджету
  // ------------------------------
  useEffect(() => {
    setPrograms([]);
    setSelectedCommunity(null);

    // Якщо це громада — одразу її показуємо
    if (isCommunity) {
      setCommunities([region]);
      setSelectedCommunity(region);
      return;
    }

    // Інакше — завантажуємо всі громади області
    fetch(`${process.env.REACT_APP_API_URL}/communities`)
      .then((r) => r.json())
      .then((data) => {
        const filtered = data.filter((c) => c.region_id === region.id);

        // Знаходимо ОБЛАСНИЙ БЮДЖЕТ
        const regionalBudget = filtered.find(
          (c) => /^...0000000$/.test(c.code) // код області = 3 цифри + 7 нулів
        );

        let list = [];
        if (regionalBudget) {
          list = [regionalBudget, ...filtered.filter((c) => c.id !== regionalBudget.id)];
        } else {
          list = filtered;
        }

        setCommunities(list);

        if (list.length) {
          setSelectedCommunity(list[0]); // спочатку показуємо обласний бюджет
        }
      })
      .catch(console.error);
  }, [region]);

  // ------------------------------
  // 2) Завантаження структури видатків
  // ------------------------------
  useEffect(() => {
    if (!selectedCommunity) return;

    const budgetCode = selectedCommunity.code;
    if (!budgetCode) return;

    const endpoint =
      budgetType === "program"
        ? "budget-program"
        : budgetType === "functional"
        ? "budget-functional"
        : "budget-economic"; // майбутній

    setLoading(true);
    setPrograms([]);

    const url = `${process.env.REACT_APP_API_URL}/${endpoint}/${budgetCode}?year=${year}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setPrograms(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCommunity, year, budgetType]);

  // ------------------------------
  // 3) Агрегація сум
  // ------------------------------
  const summary = useMemo(() => {
    if (!programs.length) return null;

    const totals = programs.reduce(
      (acc, p) => {
        const planYear = Number(p.zat || 0);
        const planRef = Number(p.plan || 0);
        const executed = Number(p.fact || 0);

        acc.planYear += planYear;
        acc.planRef += planRef;
        acc.executed += executed;
        return acc;
      },
      { planYear: 0, planRef: 0, executed: 0 }
    );

    const completion =
      totals.planRef > 0 ? (totals.executed / totals.planRef) * 100 : 0;

    return {
      ...totals,
      completion,
    };
  }, [programs]);

  const topPrograms = useMemo(() => {
  if (!programs.length) return [];

  let items = [...programs].map(p => {
    const plan = Number(p.plan || 0);
    const fact = Number(p.fact || 0);
    const zat = Number(p.zat || 0);
    const pct = plan > 0 ? (fact / plan) * 100 : 0;

    return { ...p, plan, fact, zat, pct };
  });

  // 🔎 Пошук
  if (search.trim() !== "") {
    const s = search.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.code.toLowerCase().includes(s)
    );
  }

  // 🔼🔽 Вибір метрики сортування
  items.sort((a, b) => {
    const fieldA = a[sortMode];
    const fieldB = b[sortMode];

    if (sortDir === "asc") return fieldA - fieldB;
    return fieldB - fieldA;
  });

  return items.slice(0, 10);
}, [programs, sortMode, sortDir, search]);



  const formatMoney = (v) =>
    new Intl.NumberFormat('uk-UA', {
      maximumFractionDigits: 2,
    }).format(Number(v || 0));

  const handleCommunityChange = (e) => {
    const id = Number(e.target.value);
    const found = communities.find((c) => c.id === id);
    setSelectedCommunity(found || null);
  };

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="region-panel">
      <div className="panel-header">
        <button className="back-btn" onClick={onClose}>← Назад до мапи</button>
        <h2>
          {isCommunity ? selectedCommunity?.name : region.name}
        </h2>
        <div className="tab-switcher">
          <button
            className={activeTab === "analytics" ? "tab active" : "tab"}
            onClick={() => setActiveTab("analytics")}
          >
            Аналітика
          </button>

          <button
            className={activeTab === "forecast" ? "tab active" : "tab"}
            onClick={() => setActiveTab("forecast")}
          >
            Прогноз
          </button>
        </div>

      </div>

      {/* Вибір громади */}
      <div className="panel-section">
        <label className="field-label">Громада / бюджет:</label>
        {communities.length ? (
          <select
            className="select"
            value={selectedCommunity?.id || ''}
            onChange={handleCommunityChange}
          >
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        ) : (
          <p>Для цього регіону ще немає громад у базі.</p>
        )}
      </div>

      {/* Тип бюджету */}
      <div className="panel-section">
        <label className="field-label">Тип класифікації:</label>
        <select
          className="select"
          value={budgetType}
          onChange={(e) => setBudgetType(e.target.value)}
        >
          <option value="program">Програмна</option>
          <option value="functional">Функціональна</option>
          <option value="economic">Економічна</option>
        </select>
      </div>

      {/* Рік */}
      <div className="panel-section panel-row">
        <div>
          <label className="field-label">Рік:</label>
          <input
            type="number"
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || YEAR_DEFAULT)}
            min="2015"
            max="2030"
          />
        </div>
      </div>

      {loading && <p>Завантаження структури видатків…</p>}

      {activeTab === "analytics" && !loading && selectedCommunity && summary && (
        <>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">План</span>
              <span className="summary-value">
                {formatMoney(summary.planYear)} ₴
              </span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Уточнений план</span>
              <span className="summary-value">
                {formatMoney(summary.planRef)} ₴
              </span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Виконано</span>
              <span className="summary-value">
                {formatMoney(summary.executed)} ₴
              </span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Виконання плану</span>
              <span className="summary-value">
                {summary.completion.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="panel-section">
              <div className="panel-section panel-row" style={{ alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                  
                  <label className="field-label" style={{ marginRight: "6px" }}>
                    Сортувати за:
                  </label>

                  {/* dropdown */}
                  <select
                    className="select"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value)}
                    style={{ width: "160px" }}
                  >
                    <option value="fact">Виконано</option>
                    <option value="plan">План</option>
                    <option value="pct">% виконання</option>
                    <option value="zat">Річний план</option>
                  </select>

                  {/* ASC/DESC кнопка */}
                  <button
                    className="sort-btn"
                    onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                    title={sortDir === "asc" ? "Сортувати за зростанням" : "Сортувати за спаданням"}
                  >
                    {sortDir === "asc" ? "▲" : "▼"}
                  </button>

                </div>
              </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
  
            

            {/* 🔎 пошук */}
            <input
              type="text"
              className="input"
              placeholder="Пошук..."
              style={{ flexGrow: 1 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

          </div>

            <h3>Топ програм за витратами</h3>

            {!topPrograms.length && <p>Немає даних по програмам.</p>}

            {topPrograms.length > 0 && (
              <div className="program-table">
                <div className="program-table-header">
                <span>Код</span>
                <span>Програма</span>
                <span>План</span>
                <span>Виконано</span>
                <span>% виконання</span>
              </div>

                {topPrograms.map((p) => {
                  const planRef = Number(p.plan || 0);
                  const executed = Number(p.fact || 0);
                  const pct = planRef > 0 ? (executed / planRef) * 100 : 0;

                  return (
                    <div key={p.code} className="program-row">
                      <span className="mono">{p.code}</span>
                      <span className="program-name" data-full={p.name}>
                        {p.name}
                      </span>
                      <span className="mono money">
                        {formatMoney(planRef)} ₴
                      </span>
                      <span className="mono money">
                        {formatMoney(executed)} ₴
                      </span>
                      {/* <span>{pct.toFixed(1)}%</span> */}
                      <span>
                        <div className="bar-wrapper">
                          <div
                            className="bar-fill"
                            style={{ width: `${Math.min(pct, 120)}%` }}
                          ></div>
                        </div>
                        <span className="mono small">{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {selectedCommunity && (
            <div className="panel-section">
              <StatsPanel
                budgetCode={selectedCommunity.code}
                type={budgetType}
                year={year}
              />
            </div>
          )}

        </>
      )}
      {activeTab === "forecast" && selectedCommunity && (
        <div className="panel-section">
          <ForecastPanel
            budgetCode={selectedCommunity.code}
            type={budgetType}
          />
        </div>
      )}

      {!loading && selectedCommunity && !summary && (
        <p>Немає даних по структурі видатків для цього бюджету.</p>
      )}
    </div>
  );
}
