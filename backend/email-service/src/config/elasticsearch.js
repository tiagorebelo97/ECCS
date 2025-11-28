/**
 * ============================================================================
 * Elasticsearch Client Configuration - Email Service
 * ============================================================================
 *
 * Centralized Elasticsearch client configuration for the email service.
 * Provides connection to Elasticsearch for centralized logging and search.
 *
 * FEATURES:
 * - Automatic reconnection on connection failure
 * - Configurable via environment variables
 * - Index template support for structured logging
 * - Health check support
 *
 * ENVIRONMENT VARIABLES:
 * - ELASTICSEARCH_NODE: Elasticsearch node URL (default: http://elasticsearch:9200)
 * - ELASTICSEARCH_INDEX_PREFIX: Index prefix for logs (default: eccs-logs)
 * - ELASTICSEARCH_ENABLED: Enable/disable Elasticsearch logging (default: true)
 *
 * USAGE:
 * const { elasticsearchClient, indexLog } = require('./config/elasticsearch');
 * await indexLog('info', 'Email sent', { emailId: '123', userId: '456' });
 */

const { Client } = require('@elastic/elasticsearch');
const logger = require('./logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://elasticsearch:9200';
const ELASTICSEARCH_INDEX_PREFIX = process.env.ELASTICSEARCH_INDEX_PREFIX || 'eccs-logs';
const ELASTICSEARCH_ENABLED = process.env.ELASTICSEARCH_ENABLED !== 'false';

// ============================================================================
// ELASTICSEARCH CLIENT INITIALIZATION
// ============================================================================

let elasticsearchClient = null;

if (ELASTICSEARCH_ENABLED) {
  elasticsearchClient = new Client({
    node: ELASTICSEARCH_NODE,
    // Retry configuration
    maxRetries: 3,
    requestTimeout: 30000,
    // Sniff on start to discover all nodes (disabled for single-node)
    sniffOnStart: false
  });
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check Elasticsearch cluster health.
 * @returns {Promise<Object>} Cluster health status
 */
async function checkHealth() {
  if (!ELASTICSEARCH_ENABLED || !elasticsearchClient) {
    return { status: 'disabled' };
  }

  try {
    const health = await elasticsearchClient.cluster.health();
    return {
      status: health.status,
      clusterName: health.cluster_name,
      numberOfNodes: health.number_of_nodes
    };
  } catch (error) {
    logger.error({
      message: 'Elasticsearch health check failed',
      error: error.message
    });
    return { status: 'error', error: error.message };
  }
}

// ============================================================================
// LOG INDEXING
// ============================================================================

/**
 * Get the index name for the current date.
 * Format: {prefix}-YYYY.MM.DD
 * @returns {string} Index name
 */
function getIndexName() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${ELASTICSEARCH_INDEX_PREFIX}-${year}.${month}.${day}`;
}

/**
 * Index a log entry to Elasticsearch.
 *
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata to include
 * @returns {Promise<Object|null>} Indexed document or null if disabled/failed
 */
async function indexLog(level, message, metadata = {}) {
  if (!ELASTICSEARCH_ENABLED || !elasticsearchClient) {
    return null;
  }

  try {
    const document = {
      '@timestamp': new Date().toISOString(),
      level,
      message,
      service: 'email-service',
      version: process.env.npm_package_version || '1.0.0',
      ...metadata
    };

    const result = await elasticsearchClient.index({
      index: getIndexName(),
      document
    });

    return result;
  } catch (error) {
    // Log to console but don't throw - Elasticsearch logging should not block the service
    logger.warn({
      message: 'Failed to index log to Elasticsearch',
      error: error.message
    });
    return null;
  }
}

/**
 * Bulk index multiple log entries to Elasticsearch.
 *
 * @param {Array<Object>} logs - Array of log entries
 * @returns {Promise<Object|null>} Bulk response or null if disabled/failed
 */
async function bulkIndexLogs(logs) {
  if (!ELASTICSEARCH_ENABLED || !elasticsearchClient || logs.length === 0) {
    return null;
  }

  try {
    const indexName = getIndexName();
    const operations = logs.flatMap(log => [
      { index: { _index: indexName } },
      {
        '@timestamp': log.timestamp || new Date().toISOString(),
        level: log.level || 'info',
        message: log.message,
        service: 'email-service',
        version: process.env.npm_package_version || '1.0.0',
        ...log.metadata
      }
    ]);

    const result = await elasticsearchClient.bulk({ operations });
    return result;
  } catch (error) {
    logger.warn({
      message: 'Failed to bulk index logs to Elasticsearch',
      error: error.message
    });
    return null;
  }
}

/**
 * Search logs in Elasticsearch.
 *
 * @param {Object} query - Elasticsearch query object
 * @param {Object} options - Search options (from, size, sort)
 * @returns {Promise<Object|null>} Search results or null if disabled/failed
 */
async function searchLogs(query, options = {}) {
  if (!ELASTICSEARCH_ENABLED || !elasticsearchClient) {
    return null;
  }

  try {
    const result = await elasticsearchClient.search({
      index: `${ELASTICSEARCH_INDEX_PREFIX}-*`,
      query,
      from: options.from || 0,
      size: options.size || 10,
      sort: options.sort || [{ '@timestamp': 'desc' }]
    });

    return result;
  } catch (error) {
    logger.warn({
      message: 'Failed to search logs in Elasticsearch',
      error: error.message
    });
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  elasticsearchClient,
  checkHealth,
  indexLog,
  bulkIndexLogs,
  searchLogs,
  getIndexName,
  ELASTICSEARCH_ENABLED,
  ELASTICSEARCH_NODE,
  ELASTICSEARCH_INDEX_PREFIX
};
