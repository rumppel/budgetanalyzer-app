import React, { useEffect, useState } from "react";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export default function ForecastPanel({ budgetCode, type }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState("arithmeticGrowth");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadForecast = (force = false) => {
    if (!budgetCode) return;

    setLoading(true);
    fetch(
        `${process.env.REACT_APP_API_URL}/forecast/${budgetCode}/${type}?alpha=0.3&window=3${force ? "&force=1" : ""}`
    )
        .then(r => r.json())
        .then(json => setData(json))
        .finally(() => setLoading(false));
    };

  useEffect(() => {
    loadForecast(false);
    }, [budgetCode, type]);


  if (loading) return <p>Завантаження прогнозу…</p>;
  if (!data) return <p>Немає даних для прогнозу.</p>;

    if (!data.methods) {
        return <p>Немає методів прогнозу.</p>;
    }

    const methodsRoot = data.methods;
    if (!methodsRoot) {
        return <p>Немає даних методів.</p>;
    }

    const methodData = methodsRoot[selected];
    if (!methodData) {
        return <p>Метод не має достатньо даних.</p>;
    }

    const series = data.series || data.methods.series || [];

  // Функція форматування чисел (як в ReportsService.js)
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    const formatted = new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
    return formatted.replace(/\s/g, ' ');
  };

  // Формуємо графік
  const chartData = [
    ...series.map(item => ({ year: item.year, value: item.value, isForecast: false })),
    { year: methodData.forecastYear, value: methodData.forecastValue, isForecast: true }
  ];

  return (
    <div className="forecast-panel">

      {/* Перемикач методів */}
      <div className="panel-row forecast-row">
  
        <div className="forecast-method-group">
            <label className="field-label forecast-label">Метод прогнозування:</label>

            <select
            className="select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            >
            <option value="arithmeticGrowth">Середній приріст</option>
            <option value="movingAverage">Ковзне середнє</option>
            <option value="exponential">Експоненційне згладжування</option>
            <option value="regression">Лінійна регресія</option>
            </select>
        </div>

        {/* 🔄 кнопка оновлення */}
        <button
            className="refresh-btn"
            onClick={() => {
            setRefreshing(true);
            loadForecast(true);
            setTimeout(() => setRefreshing(false), 700);
            }}
        >
            {refreshing ? "Оновлення…" : "🔄 Оновити прогноз"}
        </button>

        </div>


      {/* Графік */}
      <div className="chart-box" style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#ddd" />
            <XAxis 
              dataKey="year" 
              tick={(props) => {
                const { x, y, payload } = props;
                const isForecast = payload.value === methodData.forecastYear;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={16}
                      textAnchor="middle"
                      fill={isForecast ? "#7c3aed" : "#666"}
                      fontSize={isForecast ? 14 : 12}
                      fontWeight={isForecast ? "bold" : "normal"}
                    >
                      {payload.value}
                    </text>
                  </g>
                );
              }}
            />
            <YAxis width={90} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#7c3aed"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Відображення прогнозу */}
      <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#faf5ff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: "14px", color: "#6d28d9", marginBottom: "8px", fontWeight: "600" }}>
          Прогноз на {methodData.forecastYear}:
        </div>
        <div style={{ fontSize: "18px", color: "#7c3aed", fontWeight: "bold" }}>
          {formatNumber(methodData.forecastValue)} грн
        </div>
      </div>
    </div>
  );
}
