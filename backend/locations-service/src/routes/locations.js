/**
 * ============================================================================
 * Locations Routes - ECCS Locations Service
 * ============================================================================
 * 
 * Provides REST API endpoints for managing saved locations.
 * Locations are saved with coordinates, addresses, and custom names.
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const axios = require('axios');
const router = express.Router();

// Simple in-memory cache for geocoding results
const geocodeCache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const GEOCODE_RATE_LIMIT_MS = 1000; // Minimum 1 second between requests (Nominatim requires this)
let lastGeocodeRequest = 0;

/**
 * Reverse geocode with caching and rate limiting
 * OpenStreetMap Nominatim requires max 1 request per second
 */
async function reverseGeocodeWithRateLimit(lat, lon, logger) {
  const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  
  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.address;
  }
  
  // Rate limiting - wait if needed
  const now = Date.now();
  const timeSinceLastRequest = now - lastGeocodeRequest;
  if (timeSinceLastRequest < GEOCODE_RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, GEOCODE_RATE_LIMIT_MS - timeSinceLastRequest));
  }
  
  lastGeocodeRequest = Date.now();
  
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'User-Agent': 'ECCS-Locations-Service/1.0'
        },
        timeout: 5000
      }
    );
    
    const address = response.data.display_name || 'Unknown address';
    
    // Cache the result
    geocodeCache.set(cacheKey, {
      address,
      details: response.data.address,
      timestamp: Date.now()
    });
    
    // Clean old cache entries periodically (keep cache size manageable)
    if (geocodeCache.size > 1000) {
      const keysToDelete = [];
      for (const [key, value] of geocodeCache.entries()) {
        if (Date.now() - value.timestamp > CACHE_TTL) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => geocodeCache.delete(key));
    }
    
    return address;
  } catch (error) {
    logger.warn('Geocoding failed:', error.message);
    return 'Address not available';
  }
}

/**
 * GET /api/locations
 * Get all locations for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, name, address, latitude, longitude, created_at, updated_at 
       FROM locations 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    req.app.get('logger').error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

/**
 * GET /api/locations/:id
 * Get a specific location by ID
 */
router.get('/:id', [
  param('id').isInt().withMessage('Location ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, name, address, latitude, longitude, created_at, updated_at 
       FROM locations 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    req.app.get('logger').error('Error fetching location:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

/**
 * POST /api/locations
 * Create a new location
 */
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('address').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = req.app.get('db');
    const logger = req.app.get('logger');
    const userId = req.user.id;
    const { name, latitude, longitude, address } = req.body;

    // If address is not provided, try to reverse geocode with rate limiting
    let resolvedAddress = address;
    if (!resolvedAddress) {
      resolvedAddress = await reverseGeocodeWithRateLimit(latitude, longitude, logger);
    }

    // Insert into PostgreSQL
    const result = await db.query(
      `INSERT INTO locations (user_id, name, address, latitude, longitude) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, address, latitude, longitude, created_at, updated_at`,
      [userId, name, resolvedAddress, latitude, longitude]
    );

    const location = result.rows[0];

    // Index in Elasticsearch for map visualization
    try {
      const esClient = req.app.get('elasticsearch');
      if (esClient) {
        await esClient.index({
          index: 'eccs-locations',
          id: `location-${location.id}`,
          document: {
            id: location.id,
            user_id: userId,
            name: location.name,
            address: location.address,
            location: {
              lat: parseFloat(location.latitude),
              lon: parseFloat(location.longitude)
            },
            created_at: location.created_at,
            updated_at: location.updated_at
          }
        });
        logger.info(`Location indexed in Elasticsearch: ${location.id}`);
      }
    } catch (esError) {
      logger.warn('Failed to index location in Elasticsearch:', esError.message);
      // Don't fail the request, ES indexing is best-effort
    }

    logger.info({
      message: 'Location created',
      locationId: location.id,
      userId,
      name: location.name
    });

    res.status(201).json({
      message: 'Location saved successfully',
      location
    });
  } catch (error) {
    req.app.get('logger').error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

/**
 * PUT /api/locations/:id
 * Update a location
 */
router.put('/:id', [
  param('id').isInt().withMessage('Location ID must be an integer'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('address').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = req.app.get('db');
    const logger = req.app.get('logger');
    const userId = req.user.id;
    const { id } = req.params;
    const { name, address } = req.body;

    // Check if location exists and belongs to user
    const existingResult = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(address);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, userId);

    const result = await db.query(
      `UPDATE locations SET ${updates.join(', ')} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex} 
       RETURNING id, name, address, latitude, longitude, created_at, updated_at`,
      values
    );

    const location = result.rows[0];

    // Update in Elasticsearch
    try {
      const esClient = req.app.get('elasticsearch');
      if (esClient) {
        await esClient.update({
          index: 'eccs-locations',
          id: `location-${location.id}`,
          doc: {
            name: location.name,
            address: location.address,
            updated_at: location.updated_at
          }
        });
      }
    } catch (esError) {
      logger.warn('Failed to update location in Elasticsearch:', esError.message);
    }

    logger.info({
      message: 'Location updated',
      locationId: location.id,
      userId
    });

    res.json({
      message: 'Location updated successfully',
      location
    });
  } catch (error) {
    req.app.get('logger').error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * DELETE /api/locations/:id
 * Delete a location
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Location ID must be an integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = req.app.get('db');
    const logger = req.app.get('logger');
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM locations WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Remove from Elasticsearch
    try {
      const esClient = req.app.get('elasticsearch');
      if (esClient) {
        await esClient.delete({
          index: 'eccs-locations',
          id: `location-${id}`
        });
      }
    } catch (esError) {
      logger.warn('Failed to delete location from Elasticsearch:', esError.message);
    }

    logger.info({
      message: 'Location deleted',
      locationId: id,
      userId
    });

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    req.app.get('logger').error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

/**
 * GET /api/locations/reverse-geocode
 * Reverse geocode coordinates to get address
 * Uses rate limiting and caching to comply with Nominatim usage policy
 */
router.get('/reverse-geocode/:lat/:lon', [
  param('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  param('lon').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { lat, lon } = req.params;
    const logger = req.app.get('logger');
    const cacheKey = `${parseFloat(lat).toFixed(6)},${parseFloat(lon).toFixed(6)}`;
    
    // Check cache first
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        address: cached.address,
        details: cached.details || {}
      });
    }
    
    // Rate limiting - wait if needed
    const now = Date.now();
    const timeSinceLastRequest = now - lastGeocodeRequest;
    if (timeSinceLastRequest < GEOCODE_RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, GEOCODE_RATE_LIMIT_MS - timeSinceLastRequest));
    }
    
    lastGeocodeRequest = Date.now();

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'User-Agent': 'ECCS-Locations-Service/1.0'
        },
        timeout: 5000
      }
    );
    
    // Cache the result
    geocodeCache.set(cacheKey, {
      address: response.data.display_name,
      details: response.data.address,
      timestamp: Date.now()
    });

    res.json({
      address: response.data.display_name,
      details: response.data.address
    });
  } catch (error) {
    req.app.get('logger').error('Error reverse geocoding:', error.message);
    res.status(500).json({ error: 'Failed to get address from coordinates' });
  }
});

module.exports = router;
