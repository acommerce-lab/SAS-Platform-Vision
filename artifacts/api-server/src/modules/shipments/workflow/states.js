/**
 * Shipment Workflow States & Transitions
 * Official states as per Workflow Specification.
 */

export const ShipmentStatus = Object.freeze({
  REQUESTED: 'REQUESTED',
  CARRIER_ASSIGNED: 'CARRIER_ASSIGNED',
  PRICING_CALCULATED: 'PRICING_CALCULATED',
  PRICING_SENT: 'PRICING_SENT',
  PRICING_APPROVED: 'PRICING_APPROVED',
  PRICING_REJECTED: 'PRICING_REJECTED',
  WAYBILL_ISSUED: 'WAYBILL_ISSUED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

/**
 * Valid transitions: { [fromStatus]: Set<toStatus> }
 * Actor constraint is enforced in the service layer.
 */
export const VALID_TRANSITIONS = Object.freeze({
  [ShipmentStatus.REQUESTED]: new Set([
    ShipmentStatus.CARRIER_ASSIGNED,
    ShipmentStatus.CANCELLED,
  ]),
  [ShipmentStatus.CARRIER_ASSIGNED]: new Set([
    ShipmentStatus.PRICING_CALCULATED,
    ShipmentStatus.CANCELLED,
  ]),
  [ShipmentStatus.PRICING_CALCULATED]: new Set([
    ShipmentStatus.PRICING_SENT,
    ShipmentStatus.CANCELLED,
  ]),
  [ShipmentStatus.PRICING_SENT]: new Set([
    ShipmentStatus.PRICING_APPROVED,
    ShipmentStatus.PRICING_REJECTED,
    ShipmentStatus.CANCELLED,
  ]),
  [ShipmentStatus.PRICING_APPROVED]: new Set([
    ShipmentStatus.WAYBILL_ISSUED,
  ]),
  [ShipmentStatus.PRICING_REJECTED]: new Set([
    ShipmentStatus.CARRIER_ASSIGNED, // re-assignment after rejection
    ShipmentStatus.CANCELLED,
  ]),
  [ShipmentStatus.WAYBILL_ISSUED]: new Set([
    ShipmentStatus.IN_TRANSIT,
  ]),
  [ShipmentStatus.IN_TRANSIT]: new Set([
    ShipmentStatus.DELIVERED,
  ]),
  [ShipmentStatus.DELIVERED]: new Set([]),
  [ShipmentStatus.CANCELLED]: new Set([]),
});

/**
 * Who can trigger each transition.
 * 'any' means any of the listed roles can.
 */
export const TRANSITION_ACTORS = Object.freeze({
  [`${ShipmentStatus.REQUESTED}->${ShipmentStatus.CARRIER_ASSIGNED}`]: ['ADMIN'],
  [`${ShipmentStatus.REQUESTED}->${ShipmentStatus.CANCELLED}`]: ['ADMIN', 'SHIPPER'],
  [`${ShipmentStatus.CARRIER_ASSIGNED}->${ShipmentStatus.PRICING_CALCULATED}`]: ['ADMIN'],
  [`${ShipmentStatus.CARRIER_ASSIGNED}->${ShipmentStatus.CANCELLED}`]: ['ADMIN'],
  [`${ShipmentStatus.PRICING_CALCULATED}->${ShipmentStatus.PRICING_SENT}`]: ['ADMIN'],
  [`${ShipmentStatus.PRICING_CALCULATED}->${ShipmentStatus.CANCELLED}`]: ['ADMIN'],
  [`${ShipmentStatus.PRICING_SENT}->${ShipmentStatus.PRICING_APPROVED}`]: ['SHIPPER'],
  [`${ShipmentStatus.PRICING_SENT}->${ShipmentStatus.PRICING_REJECTED}`]: ['SHIPPER'],
  [`${ShipmentStatus.PRICING_SENT}->${ShipmentStatus.CANCELLED}`]: ['ADMIN', 'SHIPPER'],
  [`${ShipmentStatus.PRICING_APPROVED}->${ShipmentStatus.WAYBILL_ISSUED}`]: ['ADMIN'],
  [`${ShipmentStatus.PRICING_REJECTED}->${ShipmentStatus.CARRIER_ASSIGNED}`]: ['ADMIN'],
  [`${ShipmentStatus.PRICING_REJECTED}->${ShipmentStatus.CANCELLED}`]: ['ADMIN'],
  [`${ShipmentStatus.WAYBILL_ISSUED}->${ShipmentStatus.IN_TRANSIT}`]: ['CARRIER'],
  [`${ShipmentStatus.IN_TRANSIT}->${ShipmentStatus.DELIVERED}`]: ['CARRIER'],
});

/**
 * Check whether a transition is valid.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isValidTransition(from, to) {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Check whether a role can trigger a specific transition.
 * @param {string} from
 * @param {string} to
 * @param {string} role  - 'ADMIN' | 'CARRIER' | 'SHIPPER'
 * @returns {boolean}
 */
export function canActorTransition(from, to, role) {
  const actors = TRANSITION_ACTORS[`${from}->${to}`];
  if (!actors) return false;
  return actors.includes(role.toUpperCase());
}

/**
 * Get the list of actions available to a given role for the current status.
 * @param {string} currentStatus
 * @param {string} role
 * @returns {string[]}
 */
export function getAvailableActions(currentStatus, role) {
  const roleUpper = role.toUpperCase();
  const actions = [];

  const nextStates = VALID_TRANSITIONS[currentStatus] ?? new Set();
  for (const nextState of nextStates) {
    const actors = TRANSITION_ACTORS[`${currentStatus}->${nextState}`] ?? [];
    if (actors.includes(roleUpper)) {
      actions.push(nextState);
    }
  }
  return actions;
}
