import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { FiHome, FiBox, FiActivity, FiBook, FiGitBranch, FiServer, FiDatabase, FiShield, FiMenu, FiX } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

// Pages
import HomePage from './pages/HomePage'
import ArchitecturePage from './pages/ArchitecturePage'
import ServicesPage from './pages/ServicesPage'
import FlowsPage from './pages/FlowsPage'
import ApiPage from './pages/ApiPage'
import MonitoringPage from './pages/MonitoringPage'
import DeploymentPage from './pages/DeploymentPage'
import SecurityPage from './pages/SecurityPage'

// Navigation items
const navItems = [
  { path: '/', label: 'Overview', icon: FiHome },
  { path: '/architecture', label: 'Architecture', icon: FiGitBranch },
  { path: '/services', label: 'Services', icon: FiServer },
  { path: '/flows', label: 'Flow Examples', icon: FiActivity },
  { path: '/api', label: 'API Reference', icon: FiBook },
  { path: '/monitoring', label: 'Monitoring', icon: FiDatabase },
  { path: '/deployment', label: 'Deployment', icon: FiBox },
  { path: '/security', label: 'Security', icon: FiShield },
]

// Sidebar Component
function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sidebar-overlay"
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 90,
              display: 'none',
            }}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <NavLink to="/" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.875rem',
                color: 'white'
              }}>
                EC
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text)' }}>ECCS</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Documentation</div>
              </div>
            </div>
          </NavLink>
        </div>

        {/* Navigation */}
        <nav>
          <ul style={{ listStyle: 'none' }}>
            {navItems.map((item) => (
              <li key={item.path} style={{ marginBottom: 'var(--space-xs)' }}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    padding: 'var(--space-sm) var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    backgroundColor: isActive ? 'var(--color-surface-hover)' : 'transparent',
                    transition: 'all var(--transition-fast)',
                    textDecoration: 'none',
                  })}
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div style={{ 
          marginTop: 'auto', 
          paddingTop: 'var(--space-2xl)',
          borderTop: '1px solid var(--color-border)',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <p>ECCS v1.0.0</p>
            <p style={{ marginTop: 'var(--space-xs)' }}>Enterprise Cloud Communication System</p>
          </div>
        </div>
      </aside>
    </>
  )
}

// Mobile Header
function MobileHeader({ onMenuClick }) {
  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 60,
      backgroundColor: 'var(--color-bg-secondary)',
      borderBottom: '1px solid var(--color-border)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 var(--space-lg)',
      zIndex: 80,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '0.75rem',
          color: 'white'
        }}>
          EC
        </div>
        <span style={{ fontWeight: 600 }}>ECCS Docs</span>
      </div>
      <button 
        onClick={onMenuClick}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text)',
          cursor: 'pointer',
          padding: 'var(--space-sm)',
        }}
      >
        <FiMenu size={24} />
      </button>
    </header>
  )
}

// Page transition wrapper
function PageTransition({ children }) {
  const location = useLocation()
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// Main App
function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <Router>
      <div className="layout">
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="main-content">
          <div style={{ padding: 'var(--space-2xl)' }}>
            <PageTransition>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/architecture" element={<ArchitecturePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/flows" element={<FlowsPage />} />
                <Route path="/api" element={<ApiPage />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
                <Route path="/deployment" element={<DeploymentPage />} />
                <Route path="/security" element={<SecurityPage />} />
              </Routes>
            </PageTransition>
          </div>
        </main>
      </div>
    </Router>
  )
}

export default App
