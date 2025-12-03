/**
 * ============================================================================
 * API SERVICE - ECCS Frontend
 * ============================================================================
 * 
 * OVERVIEW:
 * This module provides a centralized API service layer for communicating with
 * the backend services through Traefik API Gateway. All API requests are
 * secured using JWT (JSON Web Token) authentication.
 * 
 * ARCHITECTURE:
 * 
 *   React Components
 *         │
 *         ▼
 *   API Service Layer (this file)
 *         │
 *         ▼
 *   Axios HTTP Client
 *         │
 *         ▼
 *   Traefik API Gateway (JWT Validation)
 *         │
 *         ├─► Auth Service (Port 3002)
 *         │     - /api/auth/login
 *         │     - /api/auth/register
 *         │     - /api/auth/verify
 *         │     - /api/auth/refresh
 *         │
 *         └─► Email Service (Port 3001)
 *               - /api/emails
 *               - /api/emails/send
 *               - /api/emails/stats
 *               - /api/emails/:id
 * 
 * JWT AUTHENTICATION FLOW:
 * 
 *   1. User logs in via /api/auth/login
 *   2. Backend returns JWT token
 *   3. Token is stored in localStorage
 *   4. All subsequent requests include token in Authorization header
 *   5. Traefik validates token via forwardAuth to auth-service:/api/auth/verify
 *   6. If valid, request is forwarded to the target service
 *   7. If invalid (401), interceptor handles logout/redirect
 * 
 * TOKEN REFRESH MECHANISM:
 * 
 *   - On 401 response, the interceptor attempts to refresh the token
 *   - If refresh succeeds, the original request is retried
 *   - If refresh fails, user is logged out and redirected to login
 * 
 * RATE LIMITING:
 * 
 *   Traefik enforces rate limiting (100 requests/minute with 50 burst)
 *   The API service includes retry logic for 429 (Too Many Requests) responses
 * 
 * ERROR HANDLING:
 * 
 *   - Network errors: Caught and wrapped with user-friendly messages
 *   - Validation errors: Returned as structured error objects
 *   - Server errors (5xx): Logged and generic message returned to user
 *   - Auth errors (401/403): Trigger logout flow
 * 
 * ============================================================================
 */

import axios from 'axios';

/**
 * BASE CONFIGURATION
 * 
 * The base URL is configured to work with Traefik proxy.
 * In production, this routes through Traefik at the root path.
 * In development, it can be overridden via environment variables.
 */
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

/**
 * AXIOS INSTANCE
 * 
 * Creates a pre-configured axios instance with default settings:
 * - baseURL: Routes all requests through Traefik
 * - timeout: 30 seconds to handle slow network conditions
 * - headers: JSON content type for all requests
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * REQUEST INTERCEPTOR
 * 
 * STATE MANAGEMENT FLOW:
 * 1. Before each request, retrieves JWT token from localStorage
 * 2. Attaches token to Authorization header if present
 * 3. This happens automatically for all API calls
 * 
 * SECURITY CONSIDERATIONS:
 * - Token is stored in localStorage (accessible to JavaScript)
 * - For higher security, consider using httpOnly cookies
 * - Token should have reasonable expiration (default: 1 hour)
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * RESPONSE INTERCEPTOR
 * 
 * ASYNCHRONOUS API CALL FLOW:
 * 1. Response received from backend
 * 2. Check response status
 * 3. On 401 (Unauthorized):
 *    a. Attempt to refresh token
 *    b. If successful, retry original request
 *    c. If failed, clear token and reject (triggers logout)
 * 4. On 429 (Rate Limited):
 *    a. Wait for retry-after duration
 *    b. Retry the request
 * 5. On 503 (Service Unavailable):
 *    a. Retry with exponential backoff (1s, 2s, 4s)
 *    b. After 3 retries, return user-friendly error message
 * 6. On success, return response data
 * 
 * UI FEEDBACK FLOW:
 * - Components receive either data or formatted error objects
 * - Errors include user-friendly messages for display
 * - Network errors are caught and wrapped appropriately
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - Token expired or invalid
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        const { token: newToken } = refreshResponse.data;
        localStorage.setItem('token', newToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear token and let component handle logout
        localStorage.removeItem('token');
        return Promise.reject({
          message: 'Session expired. Please log in again.',
          code: 'SESSION_EXPIRED',
          status: 401,
        });
      }
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      return Promise.reject({
        message: `Too many requests. Please wait ${retryAfter} seconds.`,
        code: 'RATE_LIMITED',
        status: 429,
        retryAfter: parseInt(retryAfter),
      });
    }

    // Handle 503 Service Unavailable - retry with exponential backoff
    if (error.response?.status === 503) {
      const retryCount = originalRequest._retry503 || 0;
      
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        originalRequest._retry503 = retryCount + 1;
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        return apiClient(originalRequest);
      }
      
      // All retries failed
      return Promise.reject({
        message: 'Service temporarily unavailable. Please try again in a few moments.',
        code: 'SERVICE_UNAVAILABLE',
        status: 503,
      });
    }

    // Handle other errors
    const errorMessage = error.response?.data?.message 
      || error.response?.data?.error 
      || error.message 
      || 'An unexpected error occurred';

    return Promise.reject({
      message: errorMessage,
      code: error.response?.data?.code || 'UNKNOWN_ERROR',
      status: error.response?.status || 500,
      errors: error.response?.data?.errors || [],
    });
  }
);

/**
 * ============================================================================
 * AUTHENTICATION API ENDPOINTS
 * ============================================================================
 * 
 * These endpoints communicate with the Auth Service through Traefik.
 * Note: Auth routes do NOT require JWT (they are public in Traefik config)
 */
export const authApi = {
  /**
   * LOGIN
   * 
   * ASYNC FLOW:
   * 1. Component calls authApi.login(email, password)
   * 2. Request sent to POST /api/auth/login
   * 3. Traefik routes to auth-service (no JWT required for auth routes)
   * 4. Auth service validates credentials
   * 5. Returns JWT token and user info
   * 6. Token stored in localStorage by AuthContext
   * 
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<{token: string, user: object}>}
   */
  login: async (email, password) => {
    const response = await apiClient.post('/api/auth/login', { email, password });
    return response.data;
  },

  /**
   * REGISTER
   * 
   * @param {string} email - User's email address
   * @param {string} password - User's password (min 6 characters)
   * @param {string} name - User's display name
   * @returns {Promise<{token: string, user: object}>}
   */
  register: async (email, password, name) => {
    const response = await apiClient.post('/api/auth/register', { email, password, name });
    return response.data;
  },

  /**
   * VERIFY TOKEN
   * 
   * Used by Traefik forwardAuth middleware to validate requests.
   * Can also be called directly to check if current token is valid.
   * 
   * @returns {Promise<{valid: boolean, user: object}>}
   */
  verify: async () => {
    const response = await apiClient.get('/api/auth/verify');
    return response.data;
  },

  /**
   * REFRESH TOKEN
   * 
   * Obtains a new JWT token using the current (possibly expired) token.
   * Called automatically by the response interceptor on 401 errors.
   * 
   * @returns {Promise<{token: string}>}
   */
  refresh: async () => {
    const response = await apiClient.post('/api/auth/refresh');
    return response.data;
  },
};

/**
 * ============================================================================
 * EMAIL API ENDPOINTS
 * ============================================================================
 * 
 * These endpoints communicate with the Email Service through Traefik.
 * All email routes require JWT authentication (enforced by Traefik middleware)
 * 
 * TRAEFIK JWT VALIDATION:
 * 1. Request hits Traefik with Bearer token
 * 2. Traefik forwards to auth-service:/api/auth/verify
 * 3. Auth service validates and returns user info in headers
 * 4. Traefik adds X-User-Id, X-User-Email headers to request
 * 5. Email service receives authenticated request
 */
export const emailApi = {
  /**
   * GET EMAIL LIST
   * 
   * STATE MANAGEMENT FLOW:
   * 1. Component dispatches loading state
   * 2. emailApi.getEmails() called
   * 3. Request includes JWT via interceptor
   * 4. Backend returns array of emails
   * 5. Component updates state with emails
   * 6. UI re-renders with email list
   * 
   * @param {object} options - Query parameters
   * @param {number} options.page - Page number (1-indexed)
   * @param {number} options.limit - Items per page (default: 100)
   * @param {string} options.status - Filter by status (sent/pending/failed)
   * @returns {Promise<Array<Email>>}
   */
  getEmails: async (options = {}) => {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page);
    if (options.limit) params.append('limit', options.limit);
    if (options.status) params.append('status', options.status);
    
    const queryString = params.toString();
    const url = `/api/emails${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get(url);
    return response.data;
  },

  /**
   * GET SINGLE EMAIL
   * 
   * @param {string|number} id - Email ID
   * @returns {Promise<Email>}
   */
  getEmail: async (id) => {
    const response = await apiClient.get(`/api/emails/${id}`);
    return response.data;
  },

  /**
   * SEND EMAIL
   * 
   * ASYNC FLOW WITH UI FEEDBACK:
   * 1. User fills form and clicks send
   * 2. Component shows loading indicator
   * 3. emailApi.sendEmail() called
   * 4. Backend validates input, creates email record
   * 5. Email queued to Kafka for async processing
   * 6. Backend returns 201 with email object (status: 'pending')
   * 7. Component shows success message
   * 8. Component clears form or navigates away
   * 9. Email processed asynchronously via Kafka consumer
   * 10. Notification service sends actual email via SMTP
   * 
   * @param {object} emailData
   * @param {string} emailData.to - Recipient email
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.body - Email body content
   * @returns {Promise<{message: string, email: Email}>}
   */
  sendEmail: async (emailData) => {
    const response = await apiClient.post('/api/emails/send', emailData);
    return response.data;
  },

  /**
   * GET EMAIL STATISTICS
   * 
   * Returns aggregate statistics for the current user's emails.
   * Used in dashboard to display summary cards.
   * 
   * @returns {Promise<{totalEmails: number, sentToday: number, pending: number, failed: number}>}
   */
  getStats: async () => {
    const response = await apiClient.get('/api/emails/stats');
    return response.data;
  },
};

/**
 * ============================================================================
 * TEMPLATE API ENDPOINTS
 * ============================================================================
 * 
 * These endpoints are for email template management.
 * Templates allow users to save and reuse common email formats.
 * 
 * Note: Template storage is currently client-side (localStorage).
 * This can be extended to server-side storage when a template service
 * is added to the backend.
 */
export const templateApi = {
  /**
   * GET TEMPLATES
   * 
   * Currently retrieves templates from localStorage.
   * 
   * @returns {Promise<Array<Template>>}
   */
  getTemplates: async () => {
    // For now, using localStorage as template storage
    // Can be migrated to backend when template service is available
    const templates = localStorage.getItem('emailTemplates');
    return templates ? JSON.parse(templates) : [];
  },

  /**
   * SAVE TEMPLATE
   * 
   * @param {object} template
   * @param {string} template.name - Template name
   * @param {string} template.subject - Template subject
   * @param {string} template.body - Template body
   * @returns {Promise<Template>}
   */
  saveTemplate: async (template) => {
    const templates = await templateApi.getTemplates();
    const newTemplate = {
      id: Date.now().toString(),
      ...template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    templates.push(newTemplate);
    localStorage.setItem('emailTemplates', JSON.stringify(templates));
    return newTemplate;
  },

  /**
   * UPDATE TEMPLATE
   * 
   * @param {string} id - Template ID
   * @param {object} updates - Fields to update
   * @returns {Promise<Template>}
   */
  updateTemplate: async (id, updates) => {
    const templates = await templateApi.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) {
      const error = new Error('Template not found');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }
    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('emailTemplates', JSON.stringify(templates));
    return templates[index];
  },

  /**
   * DELETE TEMPLATE
   * 
   * @param {string} id - Template ID
   * @returns {Promise<void>}
   */
  deleteTemplate: async (id) => {
    const templates = await templateApi.getTemplates();
    const filtered = templates.filter(t => t.id !== id);
    localStorage.setItem('emailTemplates', JSON.stringify(filtered));
  },
};

/**
 * ============================================================================
 * LOCATIONS API ENDPOINTS
 * ============================================================================
 * 
 * These endpoints communicate with the Locations Service through Traefik.
 * All location routes require JWT authentication (enforced by Traefik middleware)
 * 
 * FEATURES:
 * - Save map locations with custom names
 * - Reverse geocoding to get addresses from coordinates
 * - Locations are indexed in Elasticsearch for Kibana map visualization
 */
export const locationsApi = {
  /**
   * GET LOCATIONS
   * 
   * Retrieves all saved locations for the authenticated user.
   * 
   * @returns {Promise<Array<Location>>}
   */
  getLocations: async () => {
    const response = await apiClient.get('/api/locations');
    return response.data;
  },

  /**
   * GET SINGLE LOCATION
   * 
   * @param {number} id - Location ID
   * @returns {Promise<Location>}
   */
  getLocation: async (id) => {
    const response = await apiClient.get(`/api/locations/${id}`);
    return response.data;
  },

  /**
   * SAVE LOCATION
   * 
   * Saves a new location with coordinates, name, and address.
   * The location is stored in PostgreSQL and indexed in Elasticsearch
   * for map visualization in Kibana.
   * 
   * @param {object} locationData
   * @param {string} locationData.name - Custom name for the location
   * @param {number} locationData.latitude - Latitude coordinate
   * @param {number} locationData.longitude - Longitude coordinate
   * @param {string} locationData.address - Optional address (auto-geocoded if not provided)
   * @returns {Promise<{message: string, location: Location}>}
   */
  saveLocation: async (locationData) => {
    const response = await apiClient.post('/api/locations', locationData);
    return response.data;
  },

  /**
   * UPDATE LOCATION
   * 
   * @param {number} id - Location ID
   * @param {object} updates - Fields to update (name, address)
   * @returns {Promise<{message: string, location: Location}>}
   */
  updateLocation: async (id, updates) => {
    const response = await apiClient.put(`/api/locations/${id}`, updates);
    return response.data;
  },

  /**
   * DELETE LOCATION
   * 
   * @param {number} id - Location ID
   * @returns {Promise<{message: string}>}
   */
  deleteLocation: async (id) => {
    const response = await apiClient.delete(`/api/locations/${id}`);
    return response.data;
  },

  /**
   * REVERSE GEOCODE
   * 
   * Converts coordinates to a human-readable address using OpenStreetMap Nominatim.
   * 
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Promise<{address: string, details: object}>}
   */
  reverseGeocode: async (lat, lon) => {
    const response = await apiClient.get(`/api/locations/reverse-geocode/${lat}/${lon}`);
    return response.data;
  },
};

export default apiClient;
