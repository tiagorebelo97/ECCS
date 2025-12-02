import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSearch, FiServer, FiDatabase, FiActivity, FiBox, FiShield, FiX, FiExternalLink } from 'react-icons/fi'
import { services, architectureLayers } from '../data/services'

// Service Card Component
function ServiceCard({ service, onClick }) {
  return (
    <motion.div
      className="card card-interactive"
      onClick={onClick}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      style={{ 
        padding: 'var(--space-lg)',
        borderLeft: `4px solid ${service.color}`,
        height: '100%'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <span style={{ fontSize: '2rem' }}>{service.icon}</span>
        <span className={`badge badge-${service.type === 'backend' ? 'success' : service.type === 'database' ? 'info' : service.type === 'observability' ? 'warning' : 'primary'}`}>
          {service.category}
        </span>
      </div>
      
      <h3 style={{ marginBottom: 'var(--space-xs)', fontSize: '1.125rem' }}>{service.name}</h3>
      <p style={{ 
        color: 'var(--color-text-secondary)', 
        fontSize: '0.875rem', 
        marginBottom: 'var(--space-md)',
        lineHeight: 1.5
      }}>
        {service.description}
      </p>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingTop: 'var(--space-md)',
        borderTop: '1px solid var(--color-border)'
      }}>
        <code style={{ 
          fontSize: '0.75rem', 
          padding: '4px 8px',
          backgroundColor: 'var(--color-bg)',
          borderRadius: 'var(--radius-sm)'
        }}>
          Port: {service.port}
        </code>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{service.technology}</span>
      </div>
    </motion.div>
  )
}

// Service Detail Modal
function ServiceDetailModal({ service, onClose }) {
  if (!service) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-lg)'
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="card"
        style={{
          maxWidth: 800,
          maxHeight: '90vh',
          overflow: 'auto',
          width: '100%',
          padding: 'var(--space-xl)'
        }}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: 'var(--space-xl)',
          paddingBottom: 'var(--space-lg)',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <span style={{ fontSize: '3rem' }}>{service.icon}</span>
            <div>
              <h2 style={{ margin: 0, marginBottom: 'var(--space-xs)' }}>{service.name}</h2>
              <span className="badge badge-primary">{service.category}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: 'var(--space-sm)' }}
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Description */}
        <p style={{ fontSize: '1.125rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)' }}>
          {service.description}
        </p>

        {/* Key Info Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)'
        }}>
          <div style={{ 
            padding: 'var(--space-md)',
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Port</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{service.port}</div>
          </div>
          <div style={{ 
            padding: 'var(--space-md)',
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Technology</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{service.technology}</div>
          </div>
          <div style={{ 
            padding: 'var(--space-md)',
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Type</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'capitalize' }}>{service.type}</div>
          </div>
          {service.metrics && (
            <div style={{ 
              padding: 'var(--space-md)',
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Metrics</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-success)' }}>✓ Enabled</div>
            </div>
          )}
        </div>

        {/* Features */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>Features</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            {service.features.map(feature => (
              <span 
                key={feature}
                style={{
                  padding: 'var(--space-xs) var(--space-md)',
                  backgroundColor: `${service.color}20`,
                  color: service.color,
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.875rem'
                }}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Endpoints (if any) */}
        {service.endpoints && service.endpoints.length > 0 && (
          <div style={{ marginBottom: 'var(--space-xl)' }}>
            <h4 style={{ marginBottom: 'var(--space-md)' }}>API Endpoints</h4>
            <div style={{ 
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden'
            }}>
              {service.endpoints.map((endpoint, i) => (
                <div 
                  key={i}
                  style={{
                    padding: 'var(--space-md)',
                    borderBottom: i < service.endpoints.length - 1 ? '1px solid var(--color-border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)'
                  }}
                >
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: endpoint.method === 'GET' ? 'rgba(16, 185, 129, 0.2)' : 
                                   endpoint.method === 'POST' ? 'rgba(59, 130, 246, 0.2)' : 
                                   'rgba(99, 102, 241, 0.2)',
                    color: endpoint.method === 'GET' ? 'var(--color-success)' : 
                           endpoint.method === 'POST' ? 'var(--color-info)' : 
                           'var(--color-primary-light)'
                  }}>
                    {endpoint.method}
                  </span>
                  <code style={{ fontSize: '0.875rem', flexShrink: 0 }}>{endpoint.path}</code>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    {endpoint.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {service.dependencies && service.dependencies.length > 0 && (
          <div style={{ marginBottom: 'var(--space-xl)' }}>
            <h4 style={{ marginBottom: 'var(--space-md)' }}>Dependencies</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
              {service.dependencies.map(dep => (
                <span 
                  key={dep}
                  style={{
                    padding: 'var(--space-xs) var(--space-md)',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.875rem'
                  }}
                >
                  {dep}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Container Details */}
        {service.details && (
          <div>
            <h4 style={{ marginBottom: 'var(--space-md)' }}>Container Configuration</h4>
            <div style={{ 
              backgroundColor: 'var(--color-bg)',
              padding: 'var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem'
            }}>
              {Object.entries(service.details).map(([key, value]) => (
                <div key={key} style={{ marginBottom: 'var(--space-sm)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{key}:</span>{' '}
                  <span style={{ color: 'var(--color-primary-light)' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// Category Filter
function CategoryFilter({ categories, activeCategory, onChange }) {
  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: 'var(--space-sm)',
      marginBottom: 'var(--space-xl)'
    }}>
      <button
        className={`btn ${activeCategory === null ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => onChange(null)}
        style={{ fontSize: '0.875rem' }}
      >
        All Services
      </button>
      {categories.map(cat => (
        <button
          key={cat}
          className={`btn ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onChange(cat)}
          style={{ fontSize: '0.875rem' }}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

function ServicesPage() {
  const [selectedService, setSelectedService] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)

  // Get unique categories
  const categories = [...new Set(Object.values(services).map(s => s.category))]

  // Filter services
  const filteredServices = Object.entries(services).filter(([key, service]) => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.technology.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !activeCategory || service.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div style={{ maxWidth: 1200 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 'var(--space-sm)' }}>Services</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', fontSize: '1.125rem' }}>
          Detailed documentation for all {Object.keys(services).length} containers and services in the ECCS ecosystem.
        </p>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 'var(--space-lg)' }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          padding: 'var(--space-md) var(--space-lg)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)'
        }}>
          <FiSearch size={20} style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              color: 'var(--color-text)',
            }}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="btn btn-ghost"
              style={{ padding: 'var(--space-xs)' }}
            >
              <FiX size={16} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <CategoryFilter 
          categories={categories}
          activeCategory={activeCategory}
          onChange={setActiveCategory}
        />
      </motion.div>

      {/* Results Count */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-muted)' }}
      >
        Showing {filteredServices.length} of {Object.keys(services).length} services
        {activeCategory && ` in ${activeCategory}`}
        {searchQuery && ` matching "${searchQuery}"`}
      </motion.div>

      {/* Services Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 'var(--space-lg)'
      }}>
        <AnimatePresence mode="popLayout">
          {filteredServices.map(([key, service], i) => (
            <motion.div
              key={key}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05 }}
            >
              <ServiceCard 
                service={service}
                onClick={() => setSelectedService(service)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* No Results */}
      {filteredServices.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
          style={{ 
            padding: 'var(--space-3xl)', 
            textAlign: 'center',
            marginTop: 'var(--space-xl)'
          }}
        >
          <FiSearch size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }} />
          <h3>No services found</h3>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Try adjusting your search or filter criteria
          </p>
          <button 
            className="btn btn-secondary"
            onClick={() => { setSearchQuery(''); setActiveCategory(null); }}
            style={{ marginTop: 'var(--space-md)' }}
          >
            Clear Filters
          </button>
        </motion.div>
      )}

      {/* Service Detail Modal */}
      <AnimatePresence>
        {selectedService && (
          <ServiceDetailModal 
            service={selectedService}
            onClose={() => setSelectedService(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ServicesPage
