// Placeholder components to resolve App.tsx imports until implemented fully

export default function EmptyState({ title }: { title: string }) {
  return <div className="p-8 text-center"><h1 className="text-2xl font-bold">{title}</h1><p>Work in progress.</p></div>;
}

export function AdminCarriers() { return <EmptyState title="Admin Carriers" />; }
export function AdminCarrierDetail({ id }: { id: string }) { return <EmptyState title={`Carrier ${id}`} />; }
export function AdminShippers() { return <EmptyState title="Admin Shippers" />; }
export function AdminShipments() { return <EmptyState title="Admin Shipments" />; }
export function AdminShipmentDetail({ id }: { id: string }) { return <EmptyState title={`Shipment ${id}`} />; }

export function CarrierShipments() { return <EmptyState title="Carrier Shipments" />; }
export function CarrierShipmentDetail({ id }: { id: string }) { return <EmptyState title={`Shipment ${id}`} />; }
export function CarrierVehicles() { return <EmptyState title="Carrier Vehicles" />; }
export function CarrierDrivers() { return <EmptyState title="Carrier Drivers" />; }

export function ShipperShipments() { return <EmptyState title="Shipper Shipments" />; }
export function ShipperShipmentDetail({ id }: { id: string }) { return <EmptyState title={`Shipment ${id}`} />; }
export function ShipperCustomers() { return <EmptyState title="Shipper Customers" />; }
export function ShipperProducts() { return <EmptyState title="Shipper Products" />; }
