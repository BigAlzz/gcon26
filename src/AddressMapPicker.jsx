import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const GAUTENG_CENTER = [-26.2041, 28.0473];
const DEFAULT_ZOOM = 9;
const OSM_TILE_URL = import.meta.env.VITE_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const NOMINATIM_URL = import.meta.env.VITE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/reverse';
let lastReverseRequestAt = 0;

function waitForNominatimWindow() {
  const wait = Math.max(0, 1000 - (Date.now() - lastReverseRequestAt));
  return new Promise((resolve) => window.setTimeout(resolve, wait));
}

function isGautengAddress(address = {}) {
  return String(address.state || '').toLowerCase().includes('gauteng') || address['ISO3166-2-lvl4'] === 'ZA-GP';
}

function addressFields(result) {
  const address = result?.address || {};
  const street = [address.house_number, address.road].filter(Boolean).join(' ').trim();
  const suburb = address.suburb || address.neighbourhood || address.city_district || address.town || address.city || '';
  return {
    streetAddress: street || result?.display_name || '',
    suburb,
    province: isGautengAddress(address) ? 'Gauteng' : address.state || 'Other province',
    postcode: address.postcode || '',
    mapAddress: result?.display_name || '',
  };
}

export function AddressMapPicker({ profile, setProfile, addressConfirmed, setAddressConfirmed }) {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const requestRef = useRef(null);
  const [status, setStatus] = useState(addressConfirmed
    ? 'Gauteng location confirmed. Check the filled address before continuing.'
    : 'Click the map to choose your Gauteng location.');
  const [busy, setBusy] = useState(false);

  const updatePin = async (latlng) => {
    const lat = Number(latlng.lat.toFixed(6));
    const lon = Number(latlng.lng.toFixed(6));
    setProfile((current) => ({ ...current, latitude: lat, longitude: lon }));
    setAddressConfirmed(false);
    setStatus('Looking up the selected address…');
    setBusy(true);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      await waitForNominatimWindow();
      if (controller.signal.aborted) return;
      lastReverseRequestAt = Date.now();
      const query = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lon), zoom: '18', addressdetails: '1' });
      const response = await fetch(`${NOMINATIM_URL}?${query}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('Address lookup failed');
      const result = await response.json();
      const fields = addressFields(result);
      const withinGauteng = isGautengAddress(result.address);
      setProfile((current) => ({ ...current, ...fields, latitude: lat, longitude: lon }));
      setAddressConfirmed(withinGauteng);
      setStatus(withinGauteng ? 'Gauteng location confirmed. Check the filled address before continuing.' : 'This pin is outside Gauteng. Choose another location.');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setStatus('We could not fill the address from this pin. You can enter the address manually and try again.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined;
    const initial = Number.isFinite(Number(profile.latitude)) && Number.isFinite(Number(profile.longitude))
      ? [Number(profile.latitude), Number(profile.longitude)]
      : GAUTENG_CENTER;
    const map = L.map(mapNode.current, { center: initial, zoom: profile.latitude ? 15 : DEFAULT_ZOOM, minZoom: 7, maxZoom: 18 });
    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on('click', (event) => updatePin(event.latlng));
    mapRef.current = map;
    if (profile.latitude && profile.longitude) {
      markerRef.current = L.marker(initial, { icon: L.divIcon({ className: 'address-map-marker', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] }), draggable: true }).addTo(map);
      markerRef.current.on('dragend', (event) => updatePin(event.target.getLatLng()));
    }
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      requestRef.current?.abort();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Number.isFinite(Number(profile.latitude)) || !Number.isFinite(Number(profile.longitude))) return;
    const position = [Number(profile.latitude), Number(profile.longitude)];
    if (!markerRef.current) {
      markerRef.current = L.marker(position, { icon: L.divIcon({ className: 'address-map-marker', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] }), draggable: true }).addTo(map);
      markerRef.current.on('dragend', (event) => updatePin(event.target.getLatLng()));
    } else {
      markerRef.current.setLatLng(position);
    }
    map.panTo(position);
  }, [profile.latitude, profile.longitude]);

  return <div className="address-map-shell">
    <div className="address-map" ref={mapNode} role="application" aria-label="OpenStreetMap address picker" />
    <div className="address-map-footer">
      <span className={addressConfirmed ? 'map-status confirmed' : 'map-status'} aria-live="polite">{busy ? 'Looking up address…' : status}</span>
      <small>Click or drag the pin. Address lookup uses only the selected map location.</small>
    </div>
  </div>;
}
