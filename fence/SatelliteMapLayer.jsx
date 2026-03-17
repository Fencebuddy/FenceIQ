import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Component to handle map fitBounds when address changes
function MapController({ center, zoom, onMapReady }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 18);
    }
    if (onMapReady) {
      onMapReady(map);
    }
  }, [center, zoom, map, onMapReady]);
  
  return null;
}

// Component to capture map bounds for coordinate conversion
function MapBoundsTracker({ onBoundsChange }) {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      onBoundsChange({ bounds, zoom });
    },
    zoomend: () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      onBoundsChange({ bounds, zoom });
    }
  });
  
  return null;
}

export default function SatelliteMapLayer({ 
  latitude, 
  longitude, 
  visible = false,
  onMapReady,
  onBoundsChange,
  children
}) {
  const containerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

  if (!visible || !latitude || !longitude) {
    return null;
  }

  const center = [latitude, longitude];

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <MapContainer
        center={center}
        zoom={18}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* Satellite imagery from Esri */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          maxZoom={20}
        />
        
        {/* Optional: Street overlay for labels */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          opacity={0.3}
          maxZoom={20}
        />
        
        <MapController 
          center={center} 
          zoom={18} 
          onMapReady={(map) => {
            setMapInstance(map);
            if (onMapReady) onMapReady(map);
          }}
        />
        
        <MapBoundsTracker onBoundsChange={onBoundsChange} />
        
        {children}
      </MapContainer>
    </div>
  );
}