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

const SuperAdmin = () => {
  const [adminState, setAdminState] = useState({
    isSharing: false,
    location: null,
    battery: null,
    ip: null,
    startTime: null,
    markerPhoto: null
  });
  const [photoUrl, setPhotoUrl] = useState('');

  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:4000');

    socketRef.current.on('admin_status', (data) => {
      setAdminState(data);
      if (data.markerPhoto) {
        setPhotoUrl(data.markerPhoto);
      }
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

  const handleApplyPhoto = (e) => {
    e.preventDefault();
    if (socketRef.current) {
      socketRef.current.emit('update_marker_photo', photoUrl);
    }
  };

  const defaultPosition = [11.1271, 78.6569]; // Default center (e.g., Tamil Nadu)

  // Custom marker icon creation
  const createCustomIcon = () => {
    if (!adminState.markerPhoto) {
      // Default leaflet icon
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
      {/* Overlay Panel */}
      <div className="overlay-panel">
        <h3>Super Admin Console</h3>
        
        <div style={{marginBottom: '1.5rem'}}>
          <form onSubmit={handleApplyPhoto}>
            <input 
              type="url" 
              placeholder="Paste Photo URL here" 
              value={photoUrl}
              onChange={e => setPhotoUrl(e.target.value)}
              style={{padding: '8px', fontSize: '0.9rem', marginBottom: '8px'}}
            />
            <button className="primary" type="submit" style={{padding: '8px'}}>Set Map Marker</button>
          </form>
        </div>

        {adminState.isSharing ? (
          <div>
            <div style={{display: 'flex', alignItems: 'center', marginBottom: '1rem'}}>
              <span className="status-indicator"></span>
              <span style={{color: 'var(--success)', fontWeight: 'bold'}}>Admin is Live</span>
            </div>
            
            <div className="data-row">
              <span className="data-label">IP Address:</span>
              <span className="data-value">{adminState.ip || 'Unknown'}</span>
            </div>
            
            <div className="data-row">
              <span className="data-label">Battery:</span>
              <span className="data-value">{adminState.battery || 'Unknown'}</span>
            </div>
            
            <div className="data-row">
              <span className="data-label">Started at:</span>
              <span className="data-value">{adminState.startTime ? new Date(adminState.startTime).toLocaleTimeString() : 'Unknown'}</span>
            </div>

            {adminState.location && (
              <div className="data-row">
                <span className="data-label">Coords:</span>
                <span className="data-value" style={{fontSize: '0.8rem'}}>
                  {adminState.location.lat.toFixed(4)}, {adminState.location.lng.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{color: 'var(--danger)', textAlign: 'center', padding: '1rem 0'}}>
            Admin is not sharing location
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
              <Popup>Admin is here!</Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default SuperAdmin;
