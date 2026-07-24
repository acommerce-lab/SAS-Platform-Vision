/**
 * OSRM Distance Provider.
 * Uses the public OSRM demo server by default (configurable via OSRM_BASE_URL).
 * No API key required for OSRM.
 */

import { logger } from '../../lib/logger.js';
import { config } from '../../config/config.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/error-codes.js';

/**
 * Geocode a location string to coordinates using Nominatim.
 * For production, replace with a paid geocoding service.
 *
 * @param {string} locationString - e.g. "Riyadh, Saudi Arabia"
 * @returns {Promise<{lat: number, lon: number}>}
 */
export async function geocodeLocation(locationString) {
  const params = new URLSearchParams({
    q: locationString,
    format: 'json',
    limit: '1',
  });

  const url = `https://nominatim.openstreetmap.org/search?${params}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': config.maps.userAgent },
    signal: AbortSignal.timeout(config.maps.timeoutMs),
  });

  if (!res.ok) {
    throw new AppError(
      ErrorCodes.SHIPMENT_DISTANCE_CALCULATION_FAILED,
      `Geocoding failed: ${res.statusText}`,
    );
  }

  const data = await res.json();
  if (!data || data.length === 0) {
    throw new AppError(
      ErrorCodes.SHIPMENT_DISTANCE_CALCULATION_FAILED,
      `Could not geocode location: "${locationString}"`,
    );
  }

  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

/**
 * Calculate road distance in km between two location strings.
 *
 * @param {string} origin
 * @param {string} destination
 * @returns {Promise<number>} Distance in km
 */
export async function calculateDistanceKm(origin, destination) {
  try {
    const [from, to] = await Promise.all([
      geocodeLocation(origin),
      geocodeLocation(destination),
    ]);

    const url = `${config.maps.osrmBaseUrl}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;

    const res = await fetch(url, {
      headers: { 'User-Agent': config.maps.userAgent },
      signal: AbortSignal.timeout(config.maps.timeoutMs),
    });

    if (!res.ok) {
      throw new AppError(
        ErrorCodes.SHIPMENT_DISTANCE_CALCULATION_FAILED,
        `OSRM routing failed: ${res.statusText}`,
      );
    }

    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      throw new AppError(
        ErrorCodes.SHIPMENT_DISTANCE_CALCULATION_FAILED,
        `No route found between "${origin}" and "${destination}"`,
      );
    }

    const distanceMeters = data.routes[0].distance;
    const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;

    logger.debug({ origin, destination, distanceKm }, 'Distance calculated');
    return distanceKm;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err, origin, destination }, 'Distance calculation error');
    throw new AppError(
      ErrorCodes.SHIPMENT_DISTANCE_CALCULATION_FAILED,
      'Failed to calculate route distance',
    );
  }
}

/**
 * Simple flat-rate pricing based on distance.
 * Replace with actual pricing logic per business rules.
 *
 * @param {number} distanceKm
 * @param {string} vehicleCategory
 * @returns {number} Price in SAR
 */
export function calculatePrice(distanceKm, vehicleCategory) {
  const baseRates = {
    dyna: 2.5,
    single_truck: 4.0,
    trailer: 6.0,
    semi_trailer: 7.0,
    road_train: 9.0,
    other: 5.0,
  };
  const rate = baseRates[vehicleCategory] ?? 5.0;
  const base = 50;
  return Math.round((base + distanceKm * rate) * 100) / 100;
}
