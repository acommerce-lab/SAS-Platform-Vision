import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';

import Login from './pages/auth/Login';
import RegisterCarrier from './pages/auth/RegisterCarrier';
import RegisterShipper from './pages/auth/RegisterShipper';

import { Shell } from './components/layout/Shell';
import { AuthGuard } from './components/auth/AuthGuard';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import { AdminCarriers } from './pages/admin/Carriers';
import { AdminCarrierDetail } from './pages/admin/CarrierDetail';
import { AdminShippers } from './pages/admin/Shippers';
import { AdminShipments } from './pages/admin/Shipments';
import { AdminShipmentDetail } from './pages/admin/ShipmentDetail';

// Carrier
import CarrierDashboard from './pages/carrier/Dashboard';
import { CarrierShipments } from './pages/carrier/Shipments';
import { CarrierShipmentDetail } from './pages/carrier/ShipmentDetail';
import { CarrierVehicles } from './pages/carrier/Vehicles';
import { CarrierDrivers } from './pages/carrier/Drivers';

// Shipper
import ShipperDashboard from './pages/shipper/Dashboard';
import { ShipperShipments } from './pages/shipper/Shipments';
import { ShipperShipmentDetail } from './pages/shipper/ShipmentDetail';
import { ShipperCustomers } from './pages/shipper/Customers';
import { ShipperProducts } from './pages/shipper/Products';

// Shared
import Notifications from './pages/shared/Notifications';
import Conversations from './pages/shared/Conversations';
import Support from './pages/shared/Support';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Switch>
            {/* Public */}
            <Route path="/login" component={Login} />
            <Route path="/register/carrier" component={RegisterCarrier} />
            <Route path="/register/shipper" component={RegisterShipper} />

            {/* Admin redirects */}
            <Route path="/admin">
              <Redirect to="/admin/dashboard" />
            </Route>

            {/* Admin */}
            <Route path="/admin/dashboard">
              <AuthGuard requireRole="admin"><Shell><AdminDashboard /></Shell></AuthGuard>
            </Route>
            <Route path="/admin/carriers">
              <AuthGuard requireRole="admin"><Shell><AdminCarriers /></Shell></AuthGuard>
            </Route>
            <Route path="/admin/carriers/:id">
              {(params) => <AuthGuard requireRole="admin"><Shell><AdminCarrierDetail id={params.id!} /></Shell></AuthGuard>}
            </Route>
            <Route path="/admin/shippers">
              <AuthGuard requireRole="admin"><Shell><AdminShippers /></Shell></AuthGuard>
            </Route>
            <Route path="/admin/shipments">
              <AuthGuard requireRole="admin"><Shell><AdminShipments /></Shell></AuthGuard>
            </Route>
            <Route path="/admin/shipments/:id">
              {(params) => <AuthGuard requireRole="admin"><Shell><AdminShipmentDetail id={params.id!} /></Shell></AuthGuard>}
            </Route>

            {/* Carrier redirects */}
            <Route path="/carrier">
              <Redirect to="/carrier/dashboard" />
            </Route>

            {/* Carrier */}
            <Route path="/carrier/dashboard">
              <AuthGuard requireRole="carrier"><Shell><CarrierDashboard /></Shell></AuthGuard>
            </Route>
            <Route path="/carrier/shipments">
              <AuthGuard requireRole="carrier"><Shell><CarrierShipments /></Shell></AuthGuard>
            </Route>
            <Route path="/carrier/shipments/:id">
              {(params) => <AuthGuard requireRole="carrier"><Shell><CarrierShipmentDetail id={params.id!} /></Shell></AuthGuard>}
            </Route>
            <Route path="/carrier/vehicles">
              <AuthGuard requireRole="carrier"><Shell><CarrierVehicles /></Shell></AuthGuard>
            </Route>
            <Route path="/carrier/drivers">
              <AuthGuard requireRole="carrier"><Shell><CarrierDrivers /></Shell></AuthGuard>
            </Route>

            {/* Shipper redirects */}
            <Route path="/shipper">
              <Redirect to="/shipper/dashboard" />
            </Route>

            {/* Shipper */}
            <Route path="/shipper/dashboard">
              <AuthGuard requireRole="shipper"><Shell><ShipperDashboard /></Shell></AuthGuard>
            </Route>
            <Route path="/shipper/shipments">
              <AuthGuard requireRole="shipper"><Shell><ShipperShipments /></Shell></AuthGuard>
            </Route>
            <Route path="/shipper/shipments/:id">
              {(params) => <AuthGuard requireRole="shipper"><Shell><ShipperShipmentDetail id={params.id!} /></Shell></AuthGuard>}
            </Route>
            <Route path="/shipper/customers">
              <AuthGuard requireRole="shipper"><Shell><ShipperCustomers /></Shell></AuthGuard>
            </Route>
            <Route path="/shipper/products">
              <AuthGuard requireRole="shipper"><Shell><ShipperProducts /></Shell></AuthGuard>
            </Route>

            {/* Shared (all roles) */}
            <Route path="/notifications">
              <AuthGuard><Shell><Notifications /></Shell></AuthGuard>
            </Route>
            <Route path="/conversations">
              <AuthGuard><Shell><Conversations /></Shell></AuthGuard>
            </Route>
            <Route path="/support">
              <AuthGuard><Shell><Support /></Shell></AuthGuard>
            </Route>

            {/* Root redirect */}
            <Route path="/">
              <Redirect to="/login" />
            </Route>

            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
