import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000'
  : 'https://api.sridevarajankuzhumam.in';

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminData, setAdminData] = useState(null);

  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState('');
  const [ipAddress, setIpAddress] = useState('Fetching...');
  
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  // Initialize Socket.io and check token auto-login on mount
  useEffect(() => {
    socketRef.current = io(API_BASE, {
      transports: ['websocket']
    });
    
    // Fetch IP address
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpAddress(data.ip))
      .catch(err => {
        console.error('Failed to fetch IP', err);
        setIpAddress('Unknown');
      });

    // Check token persistence
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsLoading(true);
      fetch(`${API_BASE}/api/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid token');
          return res.json();
        })
        .then(data => {
          if (data.success) {
            setAdminData(data.admin);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('adminToken');
          }
        })
        .catch(err => {
          console.warn('Auto-login session expired or server unreachable.', err.message);
          localStorage.removeItem('adminToken');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!name || !mobile || !email) {
      setError('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    setError('');
    setStatus('');

    try {
      const res = await fetch(`${API_BASE}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsOtpSent(true);
        setStatus('OTP sent! Please check your email.');
      } else {
        setError(data.error || 'Failed to send OTP. Try again.');
      }
    } catch (err) {
      setError('Network error. Server connection failed.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }
    setIsLoading(true);
    setError('');
    setStatus('');

    try {
      const res = await fetch(`${API_BASE}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, email, otp })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('adminToken', data.token);
        setAdminData(data.admin);
        setIsAuthenticated(true);
        setStatus('Logged in successfully!');
      } else {
        setError(data.error || 'Invalid OTP code. Please retry.');
      }
    } catch (err) {
      setError('Network error during validation.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('adminToken');
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setAdminData(null);
    setIsOtpSent(false);
    setOtp('');
    setError('');
    setStatus('');

    if (isSharing) {
      stopSharing();
    }

    if (token) {
      try {
        await fetch(`${API_BASE}/api/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch (err) {
        console.error('Logout request failed:', err);
      }
    }
  };

  const getBatteryLevel = async () => {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        return `${Math.round(battery.level * 100)}%`;
      }
      return 'Not supported';
    } catch (e) {
      return 'Error';
    }
  };

  const startSharing = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setStatus('Requesting location permission...');
    
    try {
      const battery = await getBatteryLevel();
      
      // Request one position first to trigger permission prompt
      navigator.geolocation.getCurrentPosition((pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        
        socketRef.current.emit('start_sharing', {
          ip: ipAddress,
          battery: battery,
          location: location,
          startTime: new Date().toISOString(),
          admin: adminData
        });

        setIsSharing(true);
        setStatus('Sharing location securely...');

        // Start watching position
        watchIdRef.current = navigator.geolocation.watchPosition(async (position) => {
          const newBattery = await getBatteryLevel();
          socketRef.current.emit('location_update', {
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            },
            battery: newBattery
          });
        }, (error) => {
          console.error("Error watching position", error);
          setStatus('Error reading location');
        }, {
          enableHighAccuracy: true,
          maximumAge: 0
        });

      }, (error) => {
        setStatus(`Permission denied or error: ${error.message}`);
      });
      
    } catch (error) {
      console.error(error);
      setStatus('An error occurred');
    }
  };

  const stopSharing = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    socketRef.current.emit('stop_sharing');
    setIsSharing(false);
    setStatus('Sharing stopped.');
  };

  if (isLoading && !isAuthenticated) {
    return (
      <div className="container">
        <div className="panel">
          <h2>Securing Connection</h2>
          <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
          <p className="data-label">Validating session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="panel">
          <h2>Admin Login Portal</h2>
          <p className="data-label" style={{ marginBottom: '1.5rem' }}>Secure Email OTP Access</p>
          
          {error && <div className="error-badge" style={{ marginBottom: '1rem' }}>{error}</div>}
          {status && <div className="status-badge" style={{ marginBottom: '1rem' }}>{status}</div>}

          {!isOtpSent ? (
            <form onSubmit={handleSendOtp}>
              <input 
                type="text" 
                placeholder="Full Name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required
              />
              <input 
                type="tel" 
                placeholder="Mobile Number" 
                value={mobile} 
                onChange={e => setMobile(e.target.value)} 
                required
              />
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
              />
              <button className="primary" type="submit" disabled={isLoading}>
                {isLoading ? 'Requesting OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <input 
                type="text" 
                placeholder="Enter 6-Digit OTP" 
                value={otp} 
                onChange={e => setOtp(e.target.value)} 
                maxLength={6}
                required
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontWeight: 'bold' }}
              />
              <button className="primary" type="submit" disabled={isLoading}>
                {isLoading ? 'Verifying OTP...' : 'Verify & Login'}
              </button>
              <button 
                className="secondary" 
                type="button" 
                onClick={() => setIsOtpSent(false)} 
                style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              >
                Back to Details
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Admin Dashboard</h2>
          <button className="logout-btn" onClick={handleLogout} style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem', margin: 0, background: 'rgba(239, 68, 110, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 110, 0.2)' }}>
            Logout
          </button>
        </div>
        
        <div className="admin-info-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem', textAlign: 'left' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}><strong style={{ color: 'var(--primary)' }}>Name:</strong> {adminData?.name}</p>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}><strong style={{ color: 'var(--primary)' }}>Mobile:</strong> {adminData?.mobile}</p>
          <p style={{ margin: '0', fontSize: '0.9rem' }}><strong style={{ color: 'var(--primary)' }}>Email:</strong> {adminData?.email}</p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{status || 'Ready to broadcast'}</p>
        </div>
        
        {!isSharing ? (
          <button className="primary" onClick={startSharing}>Share Location</button>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <span className="status-indicator"></span>
              <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Live Sharing Active</span>
            </div>
            <button className="danger" onClick={stopSharing}>Stop Location Sharing</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
