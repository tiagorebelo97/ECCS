import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlay, FiPause, FiRefreshCw, FiChevronRight, FiInfo } from 'react-icons/fi'
import { flowExamples, services } from '../data/services'

// Animated Flow Step Component
function FlowStep({ step, index, isActive, isCompleted, delay }) {
  const service = services[step.service]
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: 'var(--space-md)',
        backgroundColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 
                        isCompleted ? 'rgba(16, 185, 129, 0.1)' : 
                        'var(--color-bg)',
        borderRadius: 'var(--radius-md)',
        border: isActive ? '2px solid var(--color-primary)' : 
               isCompleted ? '2px solid var(--color-success)' : 
               '1px solid var(--color-border)',
        transition: 'all 0.3s ease',
        position: 'relative'
      }}
    >
      {/* Step Number */}
      <motion.div
        animate={{ 
          scale: isActive ? 1.1 : 1,
          backgroundColor: isCompleted ? 'var(--color-success)' : 
                          isActive ? 'var(--color-primary)' : 
                          'var(--color-bg-tertiary)'
        }}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.875rem',
          color: isActive || isCompleted ? 'white' : 'var(--color-text-secondary)',
          flexShrink: 0
        }}
      >
        {isCompleted ? '✓' : index + 1}
      </motion.div>

      {/* Icon */}
      <span style={{ fontSize: '1.5rem' }}>{step.icon}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontWeight: 600, 
          fontSize: '0.875rem',
          color: service?.color || 'var(--color-text)',
          marginBottom: '2px'
        }}>
          {service?.name || step.service}
        </div>
        <div style={{ 
          fontSize: '0.8125rem', 
          color: 'var(--color-text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {step.action}
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
          }}
        />
      )}
    </motion.div>
  )
}

// Flow Diagram Component
function FlowDiagram({ flow, isPlaying, currentStep }) {
  return (
    <div style={{ position: 'relative', padding: 'var(--space-lg) 0' }}>
      {/* Connection Lines */}
      <div style={{
        position: 'absolute',
        left: '28px',
        top: 'var(--space-lg)',
        bottom: 'var(--space-lg)',
        width: '2px',
        background: 'linear-gradient(to bottom, var(--color-primary), var(--color-accent))',
        opacity: 0.3,
        zIndex: 0
      }} />

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', position: 'relative', zIndex: 1 }}>
        {flow.steps.map((step, i) => (
          <React.Fragment key={i}>
            <FlowStep 
              step={step}
              index={i}
              isActive={isPlaying && currentStep === i}
              isCompleted={isPlaying && currentStep > i}
              delay={i * 0.1}
            />
            
            {/* Arrow between steps */}
            {i < flow.steps.length - 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                position: 'relative',
                left: '28px',
                width: 0
              }}>
                <motion.div
                  animate={{ 
                    y: isPlaying && currentStep === i ? [0, 5, 0] : 0,
                    opacity: isPlaying && currentStep === i ? 1 : 0.3
                  }}
                  transition={{ duration: 0.5, repeat: isPlaying && currentStep === i ? Infinity : 0 }}
                >
                  <FiChevronRight 
                    size={20} 
                    style={{ 
                      transform: 'rotate(90deg)',
                      color: 'var(--color-primary)'
                    }} 
                  />
                </motion.div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// SVG Flow Visualization
function FlowVisualization({ flow, currentStep, isPlaying }) {
  const width = 900
  const height = Math.max(300, flow.steps.length * 80 + 60)
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minHeight: 300 }}>
      <defs>
        <linearGradient id="flowLine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="glowEffect">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Background Grid */}
      <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(99, 102, 241, 0.05)" strokeWidth="0.5"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#smallGrid)" />

      {/* Flow Path */}
      {flow.steps.map((step, i) => {
        const y = 40 + i * 70
        const service = services[step.service]
        const isActive = isPlaying && currentStep === i
        const isCompleted = isPlaying && currentStep > i
        
        return (
          <g key={i}>
            {/* Connection line to next step */}
            {i < flow.steps.length - 1 && (
              <motion.line
                x1={450}
                y1={y + 25}
                x2={450}
                y2={y + 70}
                stroke={isCompleted ? 'var(--color-success)' : 'url(#flowLine)'}
                strokeWidth={2}
                strokeDasharray={isCompleted ? '0' : '5,5'}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: i * 0.2, duration: 0.5 }}
              />
            )}

            {/* Step box */}
            <motion.g
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                scale: isActive ? 1.02 : 1
              }}
              transition={{ delay: i * 0.1 }}
            >
              {/* Background rect */}
              <rect
                x={100}
                y={y}
                width={700}
                height={50}
                rx={8}
                fill={isActive ? 'rgba(99, 102, 241, 0.2)' : 
                      isCompleted ? 'rgba(16, 185, 129, 0.1)' : 
                      'rgba(30, 41, 59, 0.8)'}
                stroke={isActive ? '#6366f1' : 
                       isCompleted ? '#10b981' : 
                       'rgba(51, 65, 85, 0.8)'}
                strokeWidth={isActive ? 2 : 1}
                filter={isActive ? 'url(#glowEffect)' : 'none'}
              />

              {/* Step number */}
              <circle
                cx={140}
                cy={y + 25}
                r={15}
                fill={isCompleted ? '#10b981' : isActive ? '#6366f1' : '#334155'}
              />
              <text
                x={140}
                y={y + 30}
                textAnchor="middle"
                fill="white"
                fontSize={12}
                fontWeight={700}
              >
                {isCompleted ? '✓' : i + 1}
              </text>

              {/* Icon */}
              <text x={175} y={y + 32} fontSize={20}>{step.icon}</text>

              {/* Service name */}
              <text
                x={210}
                y={y + 22}
                fill={service?.color || '#f1f5f9'}
                fontSize={13}
                fontWeight={600}
              >
                {service?.name || step.service}
              </text>

              {/* Action */}
              <text
                x={210}
                y={y + 38}
                fill="#94a3b8"
                fontSize={11}
              >
                {step.action}
              </text>

              {/* Active pulse */}
              {isActive && (
                <motion.circle
                  cx={780}
                  cy={y + 25}
                  r={5}
                  fill="#6366f1"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.g>
          </g>
        )
      })}

      {/* Animated data packet */}
      <AnimatePresence>
        {isPlaying && (
          <motion.circle
            cx={450}
            r={8}
            fill="#6366f1"
            filter="url(#glowEffect)"
            initial={{ cy: 65, opacity: 0 }}
            animate={{ 
              cy: 40 + currentStep * 70 + 25,
              opacity: 1
            }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
    </svg>
  )
}

// Flow Card Component
function FlowCard({ flow, isSelected, onClick }) {
  return (
    <motion.div
      className={`card ${isSelected ? '' : 'card-interactive'}`}
      onClick={onClick}
      whileHover={isSelected ? {} : { y: -4 }}
      style={{
        padding: 'var(--space-lg)',
        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-surface)'
      }}
    >
      <h4 style={{ marginBottom: 'var(--space-xs)' }}>{flow.title}</h4>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
        {flow.description}
      </p>
      <div style={{ marginTop: 'var(--space-sm)', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
        {flow.steps.length} steps
      </div>
    </motion.div>
  )
}

function FlowsPage() {
  const [selectedFlow, setSelectedFlow] = useState(flowExamples[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)

  // Animation logic
  useEffect(() => {
    if (!isPlaying) {
      setCurrentStep(-1)
      return
    }

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= selectedFlow.steps.length - 1) {
          return 0 // Loop back to start
        }
        return prev + 1
      })
    }, 1500)

    return () => clearInterval(interval)
  }, [isPlaying, selectedFlow])

  // Reset when flow changes
  useEffect(() => {
    setIsPlaying(false)
    setCurrentStep(-1)
  }, [selectedFlow])

  return (
    <div style={{ maxWidth: 1200 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 'var(--space-sm)' }}>Flow Examples</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2xl)', fontSize: '1.125rem' }}>
          Interactive visualizations of data flows through the ECCS system. Select a flow and watch it animate.
        </p>
      </motion.div>

      {/* Flow Selection Grid */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 'var(--space-2xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: '1.25rem' }}>Select a Flow</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--space-md)'
        }}>
          {flowExamples.map((flow, i) => (
            <motion.div
              key={flow.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <FlowCard
                flow={flow}
                isSelected={selectedFlow?.id === flow.id}
                onClick={() => setSelectedFlow(flow)}
              />
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Selected Flow Visualization */}
      {selectedFlow && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="card" style={{ padding: 'var(--space-xl)' }}>
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: 'var(--space-xl)',
              flexWrap: 'wrap',
              gap: 'var(--space-md)'
            }}>
              <div>
                <h2 style={{ marginBottom: 'var(--space-sm)' }}>{selectedFlow.title}</h2>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                  {selectedFlow.description}
                </p>
              </div>
              
              {/* Controls */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <FiPause size={16} /> : <FiPlay size={16} />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setIsPlaying(false); setCurrentStep(-1); }}
                >
                  <FiRefreshCw size={16} />
                  Reset
                </button>
              </div>
            </div>

            {/* SVG Visualization */}
            <div style={{ 
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-xl)',
              overflow: 'auto'
            }}>
              <FlowVisualization 
                flow={selectedFlow}
                currentStep={currentStep}
                isPlaying={isPlaying}
              />
            </div>

            {/* Step Details */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 'var(--space-lg)'
            }}>
              <div>
                <h4 style={{ marginBottom: 'var(--space-md)' }}>Flow Steps</h4>
                <FlowDiagram 
                  flow={selectedFlow}
                  isPlaying={isPlaying}
                  currentStep={currentStep}
                />
              </div>

              {/* Current Step Info */}
              <div>
                <h4 style={{ marginBottom: 'var(--space-md)' }}>
                  {isPlaying && currentStep >= 0 ? 'Current Step' : 'Flow Information'}
                </h4>
                <div className="card" style={{ 
                  padding: 'var(--space-lg)',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)'
                }}>
                  {isPlaying && currentStep >= 0 ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                        <span style={{ fontSize: '2rem' }}>{selectedFlow.steps[currentStep].icon}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            Step {currentStep + 1} of {selectedFlow.steps.length}
                          </div>
                          <div style={{ 
                            color: services[selectedFlow.steps[currentStep].service]?.color || 'var(--color-primary-light)',
                            fontSize: '0.875rem'
                          }}>
                            {services[selectedFlow.steps[currentStep].service]?.name || selectedFlow.steps[currentStep].service}
                          </div>
                        </div>
                      </div>
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                        {selectedFlow.steps[currentStep].action}
                      </p>
                      {services[selectedFlow.steps[currentStep].service] && (
                        <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            Port: {services[selectedFlow.steps[currentStep].service].port} • 
                            Technology: {services[selectedFlow.steps[currentStep].service].technology}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                        <FiInfo size={20} style={{ color: 'var(--color-primary-light)' }} />
                        <span style={{ fontWeight: 600 }}>About this flow</span>
                      </div>
                      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                        {selectedFlow.description}
                      </p>
                      <div>
                        <div style={{ fontSize: '0.875rem', marginBottom: 'var(--space-sm)' }}>
                          <strong>Total Steps:</strong> {selectedFlow.steps.length}
                        </div>
                        <div style={{ fontSize: '0.875rem' }}>
                          <strong>Services Involved:</strong>{' '}
                          {[...new Set(selectedFlow.steps.map(s => services[s.service]?.name || s.service))].join(', ')}
                        </div>
                      </div>
                      <div style={{ marginTop: 'var(--space-lg)' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => setIsPlaying(true)}
                        >
                          <FiPlay size={16} />
                          Start Animation
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </div>
  )
}

export default FlowsPage
