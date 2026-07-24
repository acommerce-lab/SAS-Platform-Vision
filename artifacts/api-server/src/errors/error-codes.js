/**
 * Centralised error code catalog.
 * Codes are stable identifiers the frontend translates — never change a code.
 */
export const ErrorCodes = Object.freeze({
  // ─── Generic ──────────────────────────────────────────────────────────────
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNPROCESSABLE: 'UNPROCESSABLE',

  // ─── Auth ─────────────────────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_INACTIVE: 'AUTH_ACCOUNT_INACTIVE',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_EMAIL_ALREADY_EXISTS: 'AUTH_EMAIL_ALREADY_EXISTS',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',

  // ─── Carrier ──────────────────────────────────────────────────────────────
  CARRIER_NOT_FOUND: 'CARRIER_NOT_FOUND',
  CARRIER_ALREADY_ACTIVE: 'CARRIER_ALREADY_ACTIVE',
  CARRIER_ALREADY_DISABLED: 'CARRIER_ALREADY_DISABLED',

  // ─── Vehicle ──────────────────────────────────────────────────────────────
  VEHICLE_NOT_FOUND: 'VEHICLE_NOT_FOUND',
  VEHICLE_ASSIGNED_TO_SHIPMENT: 'VEHICLE_ASSIGNED_TO_SHIPMENT',

  // ─── Driver ───────────────────────────────────────────────────────────────
  DRIVER_NOT_FOUND: 'DRIVER_NOT_FOUND',
  DRIVER_ASSIGNED_TO_SHIPMENT: 'DRIVER_ASSIGNED_TO_SHIPMENT',

  // ─── Shipper ──────────────────────────────────────────────────────────────
  SHIPPER_NOT_FOUND: 'SHIPPER_NOT_FOUND',
  SHIPPER_ALREADY_ACTIVE: 'SHIPPER_ALREADY_ACTIVE',
  SHIPPER_ALREADY_DISABLED: 'SHIPPER_ALREADY_DISABLED',

  // ─── Shipment ─────────────────────────────────────────────────────────────
  SHIPMENT_NOT_FOUND: 'SHIPMENT_NOT_FOUND',
  SHIPMENT_INVALID_TRANSITION: 'SHIPMENT_INVALID_TRANSITION',
  SHIPMENT_CARRIER_NOT_ELIGIBLE: 'SHIPMENT_CARRIER_NOT_ELIGIBLE',
  SHIPMENT_DISTANCE_CALCULATION_FAILED: 'SHIPMENT_DISTANCE_CALCULATION_FAILED',

  // ─── Waybill ──────────────────────────────────────────────────────────────
  WAYBILL_NOT_FOUND: 'WAYBILL_NOT_FOUND',
  WAYBILL_ALREADY_ISSUED: 'WAYBILL_ALREADY_ISSUED',

  // ─── Conversation ─────────────────────────────────────────────────────────
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  CONVERSATION_ACCESS_DENIED: 'CONVERSATION_ACCESS_DENIED',

  // ─── Support ──────────────────────────────────────────────────────────────
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',

  // ─── Notification ─────────────────────────────────────────────────────────
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
});

/** HTTP status codes for each error code. */
export const ErrorHttpStatus = Object.freeze({
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.UNPROCESSABLE]: 422,
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCodes.AUTH_ACCOUNT_INACTIVE]: 403,
  [ErrorCodes.AUTH_ACCOUNT_DISABLED]: 403,
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.AUTH_TOKEN_INVALID]: 401,
  [ErrorCodes.AUTH_EMAIL_ALREADY_EXISTS]: 409,
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: 403,
  [ErrorCodes.CARRIER_NOT_FOUND]: 404,
  [ErrorCodes.CARRIER_ALREADY_ACTIVE]: 409,
  [ErrorCodes.CARRIER_ALREADY_DISABLED]: 409,
  [ErrorCodes.VEHICLE_NOT_FOUND]: 404,
  [ErrorCodes.VEHICLE_ASSIGNED_TO_SHIPMENT]: 409,
  [ErrorCodes.DRIVER_NOT_FOUND]: 404,
  [ErrorCodes.DRIVER_ASSIGNED_TO_SHIPMENT]: 409,
  [ErrorCodes.SHIPPER_NOT_FOUND]: 404,
  [ErrorCodes.SHIPPER_ALREADY_ACTIVE]: 409,
  [ErrorCodes.SHIPPER_ALREADY_DISABLED]: 409,
  [ErrorCodes.SHIPMENT_NOT_FOUND]: 404,
  [ErrorCodes.SHIPMENT_INVALID_TRANSITION]: 409,
  [ErrorCodes.SHIPMENT_CARRIER_NOT_ELIGIBLE]: 422,
  [ErrorCodes.SHIPMENT_DISTANCE_CALCULATION_FAILED]: 422,
  [ErrorCodes.WAYBILL_NOT_FOUND]: 404,
  [ErrorCodes.WAYBILL_ALREADY_ISSUED]: 409,
  [ErrorCodes.CONVERSATION_NOT_FOUND]: 404,
  [ErrorCodes.CONVERSATION_ACCESS_DENIED]: 403,
  [ErrorCodes.TICKET_NOT_FOUND]: 404,
  [ErrorCodes.NOTIFICATION_NOT_FOUND]: 404,
});
