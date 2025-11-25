import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import axios from 'axios';

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setUser({ token });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await axios.post('/api/auth/login', { email, password });
    const { token } = response.data;
    localStorage.setItem('token', token);
    setUser({ token });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
};

// Navbar Component
const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <h1>ECCS Email System</h1>
      <nav>
        {user ? (
          <>
            <Link to="/">Dashboard</Link>
            <Link to="/compose">Compose</Link>
            <Link to="/emails">Emails</Link>
            <button className="btn btn-secondary" onClick={logout}>Logout</button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </nav>
    </header>
  );
};

// Login Page
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user } = useAuth();

  if (user) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Login to ECCS</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Login
        </button>
      </form>
    </div>
  );
};

// Dashboard Page
const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalEmails: 0,
    sentToday: 0,
    pending: 0,
    failed: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/emails/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(response.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="container">
      <h2>Dashboard</h2>
      <div className="dashboard">
        <div className="card">
          <h2>Total Emails</h2>
          <div className="card-stat">{stats.totalEmails}</div>
        </div>
        <div className="card">
          <h2>Sent Today</h2>
          <div className="card-stat">{stats.sentToday}</div>
        </div>
        <div className="card">
          <h2>Pending</h2>
          <div className="card-stat">{stats.pending}</div>
        </div>
        <div className="card">
          <h2>Failed</h2>
          <div className="card-stat">{stats.failed}</div>
        </div>
      </div>
    </div>
  );
};

// Compose Email Page
const ComposePage = () => {
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    body: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/emails/send', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Email queued for sending!' });
      setFormData({ to: '', subject: '', body: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to send email' });
    }
  };

  return (
    <div className="container">
      <form className="email-form" onSubmit={handleSubmit}>
        <h2>Compose Email</h2>
        {message.text && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}
        <div className="form-group">
          <label>To</label>
          <input
            type="email"
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            placeholder="recipient@example.com"
            required
          />
        </div>
        <div className="form-group">
          <label>Subject</label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Email subject"
            required
          />
        </div>
        <div className="form-group">
          <label>Message</label>
          <textarea
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            placeholder="Write your message..."
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Send Email</button>
      </form>
    </div>
  );
};

// Email List Page
const EmailListPage = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/emails', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEmails(response.data);
      } catch (err) {
        console.error('Failed to fetch emails:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmails();
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="container">
      <h2>Email History</h2>
      <div className="email-list">
        {emails.length === 0 ? (
          <div className="email-item">No emails found</div>
        ) : (
          emails.map((email) => (
            <div key={email.id} className="email-item">
              <div className="email-subject">{email.subject}</div>
              <div className="email-preview">To: {email.to}</div>
              <div className="email-meta">
                {new Date(email.createdAt).toLocaleString()} 
                <span className={`status-badge status-${email.status}`}>
                  {email.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/compose" element={
              <ProtectedRoute>
                <ComposePage />
              </ProtectedRoute>
            } />
            <Route path="/emails" element={
              <ProtectedRoute>
                <EmailListPage />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
