import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000'
  : 'https://api.sridevarajankuzhumam.in';

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
    markerPhoto: null,
    admin: null
  });
  const [photoUrl, setPhotoUrl] = useState('');
  const [history, setHistory] = useState([]);
  const [isServerOnline, setIsServerOnline] = useState(true);

  const socketRef = useRef(null);

  // Fetch location sharing history from MySQL
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchHistory();

    socketRef.current = io(API_BASE, {
      transports: ['websocket']
    });

    socketRef.current.on('connect', () => setIsServerOnline(true));
    socketRef.current.on('connect_error', () => setIsServerOnline(false));

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
        isSharing: false,
        admin: null
      }));
    });

    socketRef.current.on('history_update', () => {
      console.log('Location sharing history updated in DB, reloading list...');
      fetchHistory();
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

  const defaultPosition = [11.1271, 78.6569]; // Default center (Tamil Nadu)

  // Custom marker icon creation
  const createCustomIcon = () => {
    if (!adminState.markerPhoto) {
      return new L.Icon.Default();
    }
    
    return L.divIcon({
      className: 'custom-icon-wrapper',
      html: `<img src="${adminState.markerPhoto}" class="custom-marker" alt="Marker" style="width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.5); object-fit: cover;" />`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  // Format Duration helper
  const formatDuration = (start, end) => {
    if (!start) return '-';
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diffMs = endTime - startTime;
    if (diffMs < 0) return '0s';
    
    const diffSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    const hrs = Math.floor(mins / 60);
    
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="dashboard-container">
      {/* Dashboard Top Header */}
      <header className="dashboard-header">
        <div>
          <h1>Super Admin Console</h1>
          <p className="subtitle">Real-time Location Broadcast & History Control</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span className={`status-badge-solid ${isServerOnline ? 'online' : 'offline'}`}>
            Server: {isServerOnline ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="dashboard-grid">
        
        {/* Main Content Area: Logs and Status */}
        <div className="dashboard-col-main">
          
          {/* Quick Statistics Row */}
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-label">Active Admin Location Sharing</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <span className={`status-indicator-dot ${adminState.isSharing ? 'active' : 'inactive'}`}></span>
                <span className="stat-value">{adminState.isSharing ? adminState.admin?.name || 'Admin (Active)' : 'Offline'}</span>
              </div>
            </div>
            
            <div className="stat-card">
              <span className="stat-label">Total Sharing Sessions Logged</span>
              <span className="stat-value" style={{ display: 'block', marginTop: '10px' }}>{history.length}</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Device Battery / IP</span>
              <span className="stat-value" style={{ display: 'block', marginTop: '10px', fontSize: '1.25rem' }}>
                {adminState.isSharing ? `${adminState.battery || 'Unknown'} (${adminState.ip || 'Unknown'})` : 'No Stream'}
              </span>
            </div>
          </div>

          {/* Location Sharing History Panel */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2>Location Sharing History Logs (MySQL)</h2>
              <button className="btn-refresh" onClick={fetchHistory}>Refresh Logs</button>
            </div>
            <div className="table-responsive">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Admin Name</th>
                    <th>Email Address</th>
                    <th>Mobile</th>
                    <th>IP Address</th>
                    <th>Battery</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No location sharing history found in database.
                      </td>
                    </tr>
                  ) : (
                    history.map((log) => {
                      const isLive = !log.end_time;
                      return (
                        <tr key={log.id} className={isLive ? 'row-live' : ''}>
                          <td><strong>{log.name}</strong></td>
                          <td>{log.email}</td>
                          <td>{log.mobile}</td>
                          <td><span className="mono">{log.ip || '-'}</span></td>
                          <td>{log.battery || '-'}</td>
                          <td>{new Date(log.start_time).toLocaleString()}</td>
                          <td>{log.end_time ? new Date(log.end_time).toLocaleString() : '-'}</td>
                          <td>{formatDuration(log.start_time, log.end_time)}</td>
                          <td>
                            {isLive ? (
                              <span className="badge-live-pulse">LIVE NOW</span>
                            ) : (
                              <span className="badge-ended">Ended</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar: Map Preview and Managing Options */}
        <div className="dashboard-col-sidebar">
          
          {/* Small Map Container */}
          <div className="dashboard-card map-card">
            <div className="card-header">
              <h2>Live Positioning Map (Small Focus)</h2>
              {adminState.isSharing && <span className="badge-live-pulse" style={{ animationDuration: '1.5s' }}>LIVE</span>}
            </div>
            
            <div className="small-map-container" style={{ height: '280px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
              <MapContainer 
                center={adminState.location ? [adminState.location.lat, adminState.location.lng] : defaultPosition} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
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
                        <div style={{ color: '#0f172a' }}>
                          <strong>{adminState.admin?.name || 'Admin'}</strong>
                          <br />
                          Battery: {adminState.battery || 'Unknown'}
                        </div>
                      </Popup>
                    </Marker>
                  </>
                )}
              </MapContainer>

              {!adminState.isSharing && (
                <div className="map-offline-overlay">
                  <p>Stream Offline</p>
                  <span>No location being shared currently.</span>
                </div>
              )}
            </div>
            
            {adminState.isSharing && adminState.location && (
              <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Lat: {adminState.location.lat.toFixed(6)}</span>
                <span>Lng: {adminState.location.lng.toFixed(6)}</span>
              </div>
            )}
          </div>

          {/* Marker Asset Settings */}
          <div className="dashboard-card settings-card">
            <div className="card-header">
              <h2>Map Marker Management</h2>
            </div>
            <form onSubmit={handleApplyPhoto}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="input-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Set Custom Marker Photo URL
                </label>
                <input 
                  type="url" 
                  placeholder="Paste Photo URL here" 
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  style={{ marginBottom: '12px' }}
                />
              </div>
              <button className="primary" type="submit">Set Map Marker</button>
            </form>
            {adminState.markerPhoto && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Marker:</span>
                <img 
                  src={adminState.markerPhoto} 
                  alt="Custom Marker" 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SuperAdmin;
