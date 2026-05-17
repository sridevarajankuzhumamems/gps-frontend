import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Admin from './Admin';
import SuperAdmin from './SuperAdmin';
import User from './User';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<User />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
      </Routes>
    </Router>
  );
}

export default App;
