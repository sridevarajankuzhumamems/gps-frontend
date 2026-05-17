import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to dynamically update map center
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], 16);
    }
  }, [center, map]);
  return null;
}

const User = () => {
  const [adminState, setAdminState] = useState({
    isSharing: false,
    location: null,
    battery: null,
    ip: null,
    startTime: null,
    markerPhoto: null
  });

  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:4000');

    socketRef.current.on('admin_status', (data) => {
      setAdminState(data);
    });

    socketRef.current.on('location_update', (data) => {
      setAdminState(prev => ({
        ...prev,
        location: data.location,
        battery: data.battery
      }));
    });

    socketRef.current.on('stop_sharing', () => {
      setAdminState(prev => ({
        ...prev,
        isSharing: false
      }));
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const defaultPosition = [11.1271, 78.6569]; // Default center (e.g., Tamil Nadu)

  // Custom marker icon creation
  const createCustomIcon = () => {
    if (!adminState.markerPhoto) {
      return new L.Icon.Default();
    }
    
    return L.divIcon({
      className: 'custom-icon-wrapper',
      html: `<img src="${adminState.markerPhoto}" class="custom-marker" alt="Marker" />`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  return (
    <div className="map-container">
      {/* Floating Tracking HUD */}
      <div className="overlay-panel" style={{ left: '20px', right: 'auto' }}>
        <h3>Live GPS Tracking</h3>
        
        {adminState.isSharing ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.2rem' }}>
              <span className="status-indicator"></span>
              <span style={{ color: 'var(--success)', fontWeight: 'bold', letterSpacing: '0.5px' }}>LIVE STREAMING</span>
            </div>
            
            <div className="data-row">
              <span className="data-label">Started Tracking:</span>
              <span className="data-value">{adminState.startTime ? new Date(adminState.startTime).toLocaleTimeString() : 'Unknown'}</span>
            </div>

            {adminState.location && (
              <div className="data-row">
                <span className="data-label">Coordinates:</span>
                <span className="data-value" style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--primary)' }}>
                  {adminState.location.lat.toFixed(6)}, {adminState.location.lng.toFixed(6)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span className="status-indicator" style={{ backgroundColor: 'var(--danger)', boxShadow: 'none', animation: 'none' }}></span>
              <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>STREAM OFFLINE</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0' }}>
              Waiting for admin to share location...
            </p>
          </div>
        )}
      </div>

      {/* Map View */}
      <MapContainer 
        center={adminState.location ? [adminState.location.lat, adminState.location.lng] : defaultPosition} 
        zoom={13} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {adminState.isSharing && adminState.location && (
          <>
            <ChangeView center={adminState.location} />
            <Marker 
              position={[adminState.location.lat, adminState.location.lng]} 
              icon={createCustomIcon()}
            >
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ color: '#0f172a' }}>Live Device Position</strong>
                  <br />
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Admin is currently here.</span>
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default User;
