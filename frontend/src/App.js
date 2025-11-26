/**
 * ============================================================================
 * ECCS Frontend Application - Main Entry Point
 * ============================================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * 
 *   This is the main React application component that orchestrates:
 *   - Authentication state management via Context API
 *   - Routing configuration with protected routes
 *   - Navigation between different views
 * 
 * REACT STATE MANAGEMENT:
 * 
 *   The app uses React's Context API for global auth state:
 *   
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    AuthContext (Global State)                   │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │  user: object | null   - Current authenticated user             │
 *   │  loading: boolean      - Initial auth check in progress         │
 *   │  login: function       - Authenticate and store token           │
 *   │  logout: function      - Clear token and reset state            │
 *   └─────────────────────────────────────────────────────────────────┘
 *                              │
 *              ┌───────────────┼───────────────┐
 *              ▼               ▼               ▼
 *         ┌─────────┐    ┌─────────┐    ┌─────────┐
 *         │ Navbar  │    │Protected│    │  Other  │
 *         │         │    │ Routes  │    │ Comps   │
 *         └─────────┘    └─────────┘    └─────────┘
 * 
 * API COMMUNICATION:
 * 
 *   All API calls go through Traefik API Gateway:
 *   - Auth routes (/api/auth/*) are public
 *   - Email routes (/api/emails/*) require JWT authentication
 *   - JWT is validated via Traefik's forwardAuth middleware
 * 
 * COMPONENT HIERARCHY:
 * 
 *   App
 *   ├── AuthProvider (Context)
 *   │   └── Router (React Router)
 *   │       ├── Navbar
 *   │       └── Routes
 *   │           ├── /login → LoginPage
 *   │           ├── / → DashboardPage (protected)
 *   │           ├── /compose → ComposePage (protected)
 *   │           ├── /emails → EmailListPage (protected)
 *   │           └── /templates → TemplatesPage (protected)
 * 
 * ============================================================================
 */

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { authApi } from './services/api';
import { EmailListView, TemplateEditor, SendEmailButton } from './components';

/**
 * ============================================================================
 * AUTH CONTEXT
 * ============================================================================
 * 
 * REACT STATE MANAGEMENT EXPLANATION:
 * 
 * Context API provides a way to pass data through the component tree without
 * having to pass props down manually at every level. This is ideal for:
 * - User authentication state
 * - Theme preferences
 * - Language settings
 * 
 * AUTH FLOW:
 * 1. On app load, check localStorage for existing token
 * 2. If token exists, set user as authenticated
 * 3. On login, call API, store token, update context
 * 4. On logout, clear token, reset context
 * 5. All components can access auth state via useAuth hook
 */
// Auth Context
const AuthContext = createContext(null);

/**
 * useAuth Hook
 * 
 * Custom hook to access auth context.
 * Must be used within AuthProvider.
 */
const useAuth = () => useContext(AuthContext);

/**
 * AuthProvider Component
 * 
 * ASYNCHRONOUS API CALL FLOW FOR LOGIN:
 * 
 *   User submits credentials
 *          │
 *          ▼
 *   ┌─────────────────┐
 *   │ Set loading     │
 *   │ Call API        │
 *   └────────┬────────┘
 *            │
 *   ┌────────┴────────┐
 *   ▼                 ▼
 * Success           Error
 *   │                 │
 *   ▼                 ▼
 * Store token     Show error
 * Update context  Keep form
 * Redirect user
 * 
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 */
const AuthProvider = ({ children }) => {
  /**
   * STATE:
   * - user: null when not authenticated, object with token when authenticated
   * - loading: true during initial token check, prevents flash of login page
   */
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * INITIAL TOKEN CHECK
   * 
   * On component mount, check if a token exists in localStorage.
   * This allows users to stay logged in across page refreshes.
   * 
   * SECURITY NOTE:
   * Token in localStorage is accessible to JavaScript.
   * For production, consider:
   * - httpOnly cookies for token storage
   * - Token validation on load
   * - Refresh token mechanism
   */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setUser({ token });
    }
    setLoading(false);
  }, []);

  /**
   * LOGIN FUNCTION
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<object>} API response with token and user data
   */
  const login = useCallback(async (email, password) => {
    const response = await authApi.login(email, password);
    const { token } = response;
    localStorage.setItem('token', token);
    setUser({ token });
    return response;
  }, []);

  /**
   * LOGOUT FUNCTION
   * 
   * Clears token and resets auth state.
   * Components will react to user becoming null.
   */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * ProtectedRoute Component
 * 
 * Higher-order component that wraps routes requiring authentication.
 * 
 * UI FEEDBACK FLOW:
 * 1. Check loading state → Show spinner
 * 2. Check user state → If null, redirect to login
 * 3. If authenticated → Render children
 * 
 * ACCESSIBILITY:
 * - Loading state includes aria-label for screen readers
 * - Redirect is handled by React Router (focus management)
 * 
 * @param {object} props
 * @param {React.ReactNode} props.children - Protected content
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading" role="status" aria-label="Loading, please wait">
        <div className="spinner" aria-hidden="true"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
};

/**
 * Navbar Component
 * 
 * ACCESSIBILITY FEATURES:
 * - Semantic header element
 * - Navigation wrapped in nav element
 * - Skip link could be added for keyboard users
 * - Logout button is a proper button element
 * 
 * RESPONSIVE DESIGN:
 * - CSS handles responsive layout (see index.css)
 * - Links adapt to available space
 */
const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="navbar" role="banner">
      <h1>ECCS Email System</h1>
      <nav aria-label="Main navigation">
        {user ? (
          <>
            <Link to="/">Dashboard</Link>
            <Link to="/compose">Compose</Link>
            <Link to="/emails">Emails</Link>
            <Link to="/templates">Templates</Link>
            <button 
              className="btn btn-secondary" 
              onClick={logout}
              aria-label="Log out of your account"
            >
              Logout
            </button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </nav>
    </header>
  );
};

/**
 * LoginPage Component
 * 
 * STATE MANAGEMENT:
 * - email, password: Controlled form inputs
 * - error: Display validation/API errors
 * 
 * ACCESSIBILITY:
 * - Form has proper label associations
 * - Error messages are announced to screen readers
 * - Required fields are marked
 */
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();

  if (user) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit} aria-label="Login form">
        <h2>Login to ECCS</h2>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-group">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            autoComplete="email"
            aria-required="true"
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            aria-required="true"
            disabled={isLoading}
          />
        </div>
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

/**
 * DashboardPage Component
 * 
 * ASYNC API FLOW:
 * 1. Component mounts → useEffect triggers
 * 2. Fetch stats from API
 * 3. Update state with response
 * 4. Component re-renders with data
 * 
 * Uses the useEmailStats hook for data fetching.
 */
const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalEmails: 0,
    sentToday: 0,
    pending: 0,
    failed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { emailApi } = await import('./services/api');
        const data = await emailApi.getStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="container">
        <div className="loading" role="status" aria-label="Loading dashboard">
          <div className="spinner" aria-hidden="true"></div>
        </div>
      </div>
    );
  }

  return (
    <main className="container" aria-labelledby="dashboard-title">
      <h2 id="dashboard-title">Dashboard</h2>
      <div className="dashboard" role="region" aria-label="Email statistics">
        <div className="card">
          <h3>Total Emails</h3>
          <div className="card-stat" aria-label={`${stats.totalEmails} total emails`}>
            {stats.totalEmails}
          </div>
        </div>
        <div className="card">
          <h3>Sent Today</h3>
          <div className="card-stat" aria-label={`${stats.sentToday} emails sent today`}>
            {stats.sentToday}
          </div>
        </div>
        <div className="card">
          <h3>Pending</h3>
          <div className="card-stat" aria-label={`${stats.pending} pending emails`}>
            {stats.pending}
          </div>
        </div>
        <div className="card">
          <h3>Failed</h3>
          <div className="card-stat" aria-label={`${stats.failed} failed emails`}>
            {stats.failed}
          </div>
        </div>
      </div>
    </main>
  );
};

/**
 * ComposePage Component
 * 
 * INTEGRATION OF NEW COMPONENTS:
 * Uses SendEmailButton for sending emails with proper
 * async handling, loading states, and feedback.
 * 
 * STATE MANAGEMENT:
 * - formData: Controlled inputs for email composition
 * - message: Success/error feedback
 * 
 * ACCESSIBILITY:
 * - Form labels linked to inputs
 * - Error states announced to screen readers
 * - Clear success feedback
 */
const ComposePage = () => {
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    body: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  /**
   * VALIDATION CALLBACK
   * Called by SendEmailButton before sending
   */
  const validateForm = () => {
    if (!formData.to || !formData.subject || !formData.body) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return false;
    }
    return true;
  };

  /**
   * SUCCESS HANDLER
   * Called when email is successfully queued
   */
  const handleSuccess = () => {
    setMessage({ type: 'success', text: 'Email queued for sending!' });
    setFormData({ to: '', subject: '', body: '' });
  };

  /**
   * ERROR HANDLER
   * Called when email sending fails
   */
  const handleError = (err) => {
    setMessage({ 
      type: 'error', 
      text: err.message || 'Failed to send email. Please try again.' 
    });
  };

  return (
    <main className="container" aria-labelledby="compose-title">
      <form 
        className="email-form" 
        onSubmit={(e) => e.preventDefault()}
        aria-label="Compose email form"
      >
        <h2 id="compose-title">Compose Email</h2>
        
        {message.text && (
          <div 
            className={`alert alert-${message.type}`} 
            role={message.type === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="email-to">To</label>
          <input
            id="email-to"
            type="email"
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            placeholder="recipient@example.com"
            required
            aria-required="true"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email-subject">Subject</label>
          <input
            id="email-subject"
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Email subject"
            required
            aria-required="true"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email-body">Message</label>
          <textarea
            id="email-body"
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            placeholder="Write your message..."
            required
            aria-required="true"
          />
        </div>
        
        {/* 
          SendEmailButton Component
          
          Demonstrates the complete async API flow:
          1. User clicks button
          2. Validation callback runs
          3. Button shows loading state
          4. API call via useSendEmail hook
          5. Success/error feedback displayed
        */}
        <SendEmailButton
          emailData={formData}
          onValidate={validateForm}
          onSuccess={handleSuccess}
          onError={handleError}
          requireConfirmation={true}
        />
        
        <div style={{ marginTop: '1rem' }}>
          <Link to="/templates" className="btn btn-secondary">
            Use Template
          </Link>
        </div>
      </form>
    </main>
  );
};

/**
 * EmailListPage Component
 * 
 * INTEGRATION OF EmailListView COMPONENT:
 * Demonstrates the new EmailListView component with:
 * - Async data fetching via custom hooks
 * - Filtering and refresh functionality
 * - Accessible list rendering
 * - Responsive design
 * 
 * The EmailListView component handles all the complexity
 * of loading states, error handling, and empty states.
 */
const EmailListPage = () => {
  const [selectedEmail, setSelectedEmail] = useState(null);

  /**
   * EMAIL SELECT HANDLER
   * Called when user selects an email from the list
   */
  const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    console.log('Selected email:', email);
  };

  return (
    <main className="container" aria-labelledby="emails-title">
      <h2 id="emails-title">Email History</h2>
      
      {/* 
        EmailListView Component
        
        This component demonstrates:
        - useEmails hook for async data fetching
        - Loading, error, and empty states
        - Filtering by status
        - Keyboard navigation
        - Screen reader announcements
      */}
      <EmailListView onEmailSelect={handleEmailSelect} />
      
      {/* Selected email preview */}
      {selectedEmail && (
        <div 
          className="card" 
          style={{ marginTop: '1.5rem' }}
          role="region"
          aria-label="Selected email details"
        >
          <h3>Selected Email</h3>
          <p><strong>To:</strong> {selectedEmail.to || selectedEmail.recipient}</p>
          <p><strong>Subject:</strong> {selectedEmail.subject}</p>
          <p><strong>Status:</strong> {selectedEmail.status}</p>
          <p><strong>Date:</strong> {new Date(selectedEmail.createdAt).toLocaleString()}</p>
        </div>
      )}
    </main>
  );
};

/**
 * TemplatesPage Component
 * 
 * INTEGRATION OF TemplateEditor COMPONENT:
 * Provides a page for managing email templates.
 * 
 * STATE MANAGEMENT:
 * - templates: List of saved templates
 * - selectedTemplate: Currently editing template
 * - isCreating: Whether creating new vs editing
 */
const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  /**
   * LOAD TEMPLATES ON MOUNT
   */
  useEffect(() => {
    const loadTemplates = async () => {
      const { templateApi } = await import('./services/api');
      const data = await templateApi.getTemplates();
      setTemplates(data);
    };
    loadTemplates();
  }, []);

  /**
   * SAVE HANDLER
   * Called when template is saved
   */
  const handleSave = (savedTemplate) => {
    if (selectedTemplate) {
      // Update existing
      setTemplates(prev => 
        prev.map(t => t.id === savedTemplate.id ? savedTemplate : t)
      );
    } else {
      // Add new
      setTemplates(prev => [...prev, savedTemplate]);
    }
    setSelectedTemplate(null);
    setIsCreating(false);
  };

  /**
   * DELETE HANDLER
   */
  const handleDelete = (deletedTemplate) => {
    setTemplates(prev => prev.filter(t => t.id !== deletedTemplate.id));
    setSelectedTemplate(null);
  };

  /**
   * USE TEMPLATE
   * Navigate to compose with template data
   */
  const handleUseTemplate = (template) => {
    // Store template in sessionStorage for ComposePage to use
    sessionStorage.setItem('emailTemplate', JSON.stringify(template));
    navigate('/compose');
  };

  return (
    <main className="container" aria-labelledby="templates-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 id="templates-title">Email Templates</h2>
        {!isCreating && !selectedTemplate && (
          <button 
            className="btn btn-primary"
            onClick={() => setIsCreating(true)}
          >
            + New Template
          </button>
        )}
      </div>

      {/* Editor - shown when creating or editing */}
      {(isCreating || selectedTemplate) && (
        <TemplateEditor
          template={selectedTemplate}
          onSave={handleSave}
          onCancel={() => {
            setSelectedTemplate(null);
            setIsCreating(false);
          }}
          onDelete={handleDelete}
        />
      )}

      {/* Template List - shown when not editing */}
      {!isCreating && !selectedTemplate && (
        <div className="email-list" role="list" aria-label="Email templates">
          {templates.length === 0 ? (
            <div className="email-item" style={{ textAlign: 'center' }}>
              <p>No templates yet. Create your first template to get started!</p>
            </div>
          ) : (
            templates.map((template) => (
              <div 
                key={template.id} 
                className="email-item"
                role="listitem"
              >
                <div className="email-subject">{template.name}</div>
                <div className="email-preview">Subject: {template.subject}</div>
                <div className="email-meta">
                  Created: {new Date(template.createdAt).toLocaleDateString()}
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setSelectedTemplate(template)}
                    style={{ padding: '0.5rem 1rem', minHeight: 'auto' }}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleUseTemplate(template)}
                    style={{ padding: '0.5rem 1rem', minHeight: 'auto' }}
                  >
                    Use
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
};

/**
 * ============================================================================
 * MAIN APP COMPONENT
 * ============================================================================
 * 
 * The root component that sets up:
 * - AuthProvider for global authentication state
 * - Router for client-side routing
 * - Route configuration with protected routes
 * 
 * ROUTING STRUCTURE:
 * 
 *   /login      → Public, redirects to / if authenticated
 *   /           → Protected, Dashboard with stats
 *   /compose    → Protected, Email composition with SendEmailButton
 *   /emails     → Protected, Email history with EmailListView
 *   /templates  → Protected, Template management with TemplateEditor
 * 
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          {/* Skip to main content link for keyboard users */}
          <a href="#main-content" className="visually-hidden-focusable">
            Skip to main content
          </a>
          
          <Navbar />
          
          <div id="main-content">
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Protected routes */}
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
              
              <Route path="/templates" element={
                <ProtectedRoute>
                  <TemplatesPage />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
