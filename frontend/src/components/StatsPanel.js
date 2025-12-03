import React, { useEffect, useState } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function StatsPanel({ budgetCode, type, year }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!budgetCode || !type || !year) return;

    setLoading(true);
    fetch(
      `${process.env.REACT_APP_API_URL}/stats/${budgetCode}/${type.toLowerCase()}/${year}`
    )
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [budgetCode, type, year]);

  if (loading) return <p>Завантаження статистики…</p>;
  if (!stats) return null;

  const CustomLegend = ({ payload }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {payload.map((entry, i) => {
        const full = entry.value;
        const short = full.length > 40 ? full.slice(0, 37) + "…" : full;
        return (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}
            title={full} // показує повну назву при наведенні
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: entry.color,
                marginRight: 6,
                borderRadius: 2
              }}
            />
            <span>{short}</span>
          </div>
        );
      })}
    </div>
  );
};
  const COLORS = [
    "#4c1d95", "#6d28d9", "#7c3aed", "#8b5cf6",
    "#a855f7", "#c084fc", "#ddd6fe", "#1e40af",
    "#2563eb", "#3b82f6"
  ];

  return (
    <div className="stats-card">
      <h3 className="stats-title">Статистика бюджету</h3>

      {/* === 1. ПОМІСЯЧНА ДИНАМІКА === */}
      <h4 className="stats-subtitle">Динаміка за місяцями</h4>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={stats.monthly}>
            <XAxis dataKey="rep_period" />
            <YAxis width={90} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="plan" name="План" stroke="#7c3aed" />
            <Line type="monotone" dataKey="fact" name="Факт" stroke="#10b981" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* === 2. КВАРТАЛИ === */}
      <h4 className="stats-subtitle">Поквартальна статистика</h4>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={stats.quarterly}>
            <XAxis dataKey="quarter" />
            <YAxis width={90} />
            <Tooltip />
            <Legend />
            <Bar dataKey="plan" fill="#7c3aed" name="План" />
            <Bar dataKey="fact" fill="#10b981" name="Факт" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* === 3. СТРУКТУРА ВИДАТКІВ === */}
      <h4 className="stats-subtitle">Структура видатків (%)</h4>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie
                data={stats.structure}
                dataKey="percent"
                nameKey="name"
                cx="40%"
                cy="50%"
                outerRadius={90}
                label
                >
                {stats.structure.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                </Pie>

                <Tooltip />

                {/* ⭐ НОВА КОМПАКТНА ЛЕГЕНДА */}
                <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                content={<CustomLegend />}
                />
            </PieChart>
            </ResponsiveContainer>

      </div>

      {/* === 4. ТОП-10 === */}
      <h4 className="stats-subtitle">ТОП-10 за видатками</h4>
      <div className="chart-box">
        
        <ResponsiveContainer width="100%" height={Math.max(stats.top10.length * 38, 280)}>
            <BarChart layout="vertical" data={stats.top10}>
                <XAxis type="number" />
                <YAxis
                type="category"
                dataKey="name"
                width={260}                 // ← збільшено з ~100
                tickFormatter={(v) =>
                    v.length > 35 ? v.slice(0, 35) + "…" : v
                }                           // ← обрізаємо довгі назви
                />
                <Tooltip
                formatter={(value) => new Intl.NumberFormat('uk-UA').format(value) + " ₴"}
                />
                <Bar dataKey="total" fill="#4c1d95" />
            </BarChart>
            </ResponsiveContainer>

      </div>

      {/* === 5. РОКИ === */}
      <h4 className="stats-subtitle">Динаміка за роками</h4>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats.dynamics}>
            <XAxis dataKey="year" />
            <YAxis width={90} />
            <Tooltip />
            <Line type="monotone" dataKey="fact" stroke="#f59e0b" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
