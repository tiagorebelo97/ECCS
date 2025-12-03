/**
 * ============================================================================
 * MapView Component - Interactive Map for Saving Locations
 * ============================================================================
 * 
 * This component provides an interactive world map where users can:
 * - Click on any point to get the address
 * - Save locations with custom names
 * - View saved locations on the map
 * - Manage (edit/delete) saved locations
 * 
 * INTEGRATION:
 * - Uses Leaflet for map rendering
 * - OpenStreetMap tiles for map display
 * - Nominatim API for reverse geocoding
 * - Backend locations-service for persistence
 * - Elasticsearch for geo-point indexing (visible in Kibana maps)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import PropTypes from 'prop-types';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

// Fix for default marker icons in React-Leaflet
// Import icons from the leaflet package
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom marker icon for selected location
const selectedIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'selected-marker'
});

// Custom marker icon for saved locations
const savedIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'saved-marker'
});

/**
 * MapClickHandler - Handles map click events
 */
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

MapClickHandler.propTypes = {
  onMapClick: PropTypes.func.isRequired
};

/**
 * MapView Component
 */
function MapView({ locationsApi }) {
  // State
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [locationName, setLocationName] = useState('');
  const [savedLocations, setSavedLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);

  // Default map center (world view)
  const defaultCenter = [20, 0];
  const defaultZoom = 2;

  /**
   * Fetch saved locations on mount
   */
  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoading(true);
      try {
        const locations = await locationsApi.getLocations();
        setSavedLocations(locations);
      } catch (err) {
        console.error('Failed to fetch locations:', err);
        setError('Failed to load saved locations');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, [locationsApi]);

  /**
   * Handle map click - get address from coordinates
   */
  const handleMapClick = useCallback(async (latlng) => {
    setSelectedPosition(latlng);
    setSelectedAddress('');
    setLocationName('');
    setError('');
    setSuccess('');
    setIsGeocodingLoading(true);

    try {
      const response = await locationsApi.reverseGeocode(latlng.lat, latlng.lng);
      setSelectedAddress(response.address);
    } catch (err) {
      console.error('Geocoding failed:', err);
      setSelectedAddress('Address not available');
    } finally {
      setIsGeocodingLoading(false);
    }
  }, [locationsApi]);

  /**
   * Save location
   */
  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!selectedPosition || !locationName.trim()) {
      setError('Please select a location and enter a name');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const newLocation = await locationsApi.saveLocation({
        name: locationName.trim(),
        latitude: selectedPosition.lat,
        longitude: selectedPosition.lng,
        address: selectedAddress
      });

      setSavedLocations(prev => [newLocation.location, ...prev]);
      setSuccess('Location saved successfully!');
      setSelectedPosition(null);
      setSelectedAddress('');
      setLocationName('');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save location:', err);
      setError(err.message || 'Failed to save location');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Delete location
   */
  const handleDeleteLocation = async (locationId) => {
    if (!window.confirm('Are you sure you want to delete this location?')) {
      return;
    }

    try {
      await locationsApi.deleteLocation(locationId);
      setSavedLocations(prev => prev.filter(loc => loc.id !== locationId));
      setSuccess('Location deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to delete location:', err);
      setError('Failed to delete location');
    }
  };

  /**
   * Cancel selection
   */
  const handleCancelSelection = () => {
    setSelectedPosition(null);
    setSelectedAddress('');
    setLocationName('');
    setError('');
  };

  return (
    <div className="map-view">
      {/* Messages */}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}

      <div className="map-container-wrapper">
        {/* Map */}
        <div className="map-section">
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            className="leaflet-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />

            {/* Selected position marker */}
            {selectedPosition && (
              <Marker position={selectedPosition} icon={selectedIcon}>
                <Popup>
                  <div className="marker-popup">
                    <strong>Selected Location</strong>
                    {isGeocodingLoading ? (
                      <p>Loading address...</p>
                    ) : (
                      <p>{selectedAddress || 'Address not available'}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Saved location markers */}
            {savedLocations.map((location) => (
              <Marker
                key={location.id}
                position={[parseFloat(location.latitude), parseFloat(location.longitude)]}
                icon={savedIcon}
              >
                <Popup>
                  <div className="marker-popup saved">
                    <strong>{location.name}</strong>
                    <p className="address">{location.address}</p>
                    <p className="date">
                      Saved: {new Date(location.created_at).toLocaleDateString()}
                    </p>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleDeleteLocation(location.id)}
                    >
                      Delete
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="map-sidebar">
          <h3>Save Location</h3>
          <p className="instructions">
            Click anywhere on the map to select a location. The address will be
            automatically retrieved. Enter a name and save to your collection.
          </p>

          {selectedPosition ? (
            <form onSubmit={handleSaveLocation} className="save-location-form">
              <div className="form-group">
                <label htmlFor="location-name">Location Name</label>
                <input
                  id="location-name"
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Enter a name for this location"
                  required
                  disabled={isSaving}
                />
              </div>

              <div className="form-group">
                <label>Coordinates</label>
                <p className="coordinates">
                  {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
                </p>
              </div>

              <div className="form-group">
                <label>Address</label>
                {isGeocodingLoading ? (
                  <p className="address-loading">Loading address...</p>
                ) : (
                  <p className="address-text">{selectedAddress || 'Address not available'}</p>
                )}
              </div>

              <div className="button-group">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || !locationName.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save Location'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelSelection}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="no-selection">
              No location selected. Click on the map to select a location.
            </p>
          )}

          {/* Saved locations list */}
          <div className="saved-locations-list">
            <h4>Saved Locations ({savedLocations.length})</h4>
            {isLoading ? (
              <p>Loading...</p>
            ) : savedLocations.length === 0 ? (
              <p className="no-locations">No saved locations yet.</p>
            ) : (
              <ul>
                {savedLocations.slice(0, 10).map((location) => (
                  <li key={location.id} className="saved-location-item">
                    <strong>{location.name}</strong>
                    <span className="location-address">{location.address}</span>
                  </li>
                ))}
                {savedLocations.length > 10 && (
                  <li className="more-locations">
                    +{savedLocations.length - 10} more locations
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

MapView.propTypes = {
  locationsApi: PropTypes.shape({
    getLocations: PropTypes.func.isRequired,
    saveLocation: PropTypes.func.isRequired,
    deleteLocation: PropTypes.func.isRequired,
    reverseGeocode: PropTypes.func.isRequired
  }).isRequired
};

export default MapView;
