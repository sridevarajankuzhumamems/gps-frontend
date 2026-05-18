import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState('');
  const [ipAddress, setIpAddress] = useState('Fetching...');
  
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  // Initialize Socket.io on mount
  useEffect(() => {
    // In production, this should be your server URL
    socketRef.current = io('https://api.sridevarajankuzhumam.in', {
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

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === '1234') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid credentials');
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
          startTime: new Date().toLocaleString()
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

  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="panel">
          <h2>Admin Login</h2>
          <p className="data-label" style={{marginBottom: "2rem"}}>Secure Access Portal</p>
          <form onSubmit={handleLogin}>
            <input 
              type="text" 
              placeholder="Username" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
            />
            <button className="primary" type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="panel">
        <h2>Admin Dashboard</h2>
        <div style={{marginBottom: '2rem'}}>
          <p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>{status || 'Ready to broadcast'}</p>
        </div>
        
        {!isSharing ? (
          <button className="primary" onClick={startSharing}>Share Location</button>
        ) : (
          <div>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem'}}>
              <span className="status-indicator"></span>
              <span style={{color: 'var(--success)', fontWeight: 'bold'}}>Live Sharing Active</span>
            </div>
            <button className="danger" onClick={stopSharing}>Stop Location Sharing</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
