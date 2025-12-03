// src/components/MapView.js
import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import RegionPanel from './RegionPanel';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

export default function MapView() {
  const [mapObj, setMapObj] = useState(null);
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/regions`)
      .then((r) => r.json())
      .then(setRegions)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapObj) {
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v10',
        center: [31.0, 49.0],
        zoom: 5,
      });

      map.on('load', () => setMapObj(map));

      map.on('click', (e) => {
        if (!regions.length) return;
        const nearest = regions.reduce((acc, r) => {
          const dist = Math.hypot(
            r.center_lng - e.lngLat.lng,
            r.center_lat - e.lngLat.lat
          );
          return !acc || dist < acc.dist ? { region: r, dist } : acc;
        }, null);
        if (nearest) setSelectedRegion(nearest.region);
      });
    }
  }, [mapObj, regions]);

  const isRegionSelected = !!selectedRegion;

  return (
  <div
    className={
      'map-layout' + (isRegionSelected ? ' map-layout--focused' : '')
    }
  >
    {/* Мапа — ТУТ МАЄ БУТИ ПІДКАЗКА */}
    <div id="map" className="map-box">
      {!selectedRegion && (
        <div className="empty-panel">
          <h2>Оберіть регіон на мапі</h2>
          <p>
            Клікніть по області або місту, щоб переглянути детальну статистику.
          </p>
          <p className="hint">
            Підтримуються дані OpenBudget для обласних центрів.
          </p>
        </div>
      )}
    </div>

    {/* бокова панель */}
    <div className="sidebar">
      <div className="side-panel">
        {selectedRegion ? (
          <RegionPanel
            region={selectedRegion}
            onClose={() => setSelectedRegion(null)}
          />
        ) : null}
      </div>
    </div>
  </div>
);


}
