import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RetailPOS from "./pages/pos/RetailPOS";
import RestaurantPOS from "./pages/pos/RestaurantPOS";
import KitchenDisplay from "./pages/pos/KitchenDisplay";
import WaiterMobile from "./pages/pos/WaiterMobile";
import StockOverview from "./pages/inventory/StockOverview";
import Products from "./pages/inventory/Products";
import Suppliers from "./pages/inventory/Suppliers";
import PurchaseOrders from "./pages/inventory/PurchaseOrders";
import Customers from "./pages/customers/Customers";
import Reports from "./pages/reports/Reports";
import GeneralSettings from "./pages/settings/GeneralSettings";
import UserManagement from "./pages/settings/UserManagement";
import RoleManagement from "./pages/settings/RoleManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />

              {/* POS routes */}
              <Route element={<PermissionGuard module="pos.retail" />}>
                <Route path="/pos" element={<RetailPOS />} />
              </Route>
              <Route element={<PermissionGuard module="pos.restaurant" />}>
                <Route path="/pos/restaurant" element={<RestaurantPOS />} />
              </Route>
              <Route element={<PermissionGuard module="pos.kitchen" />}>
                <Route path="/pos/kitchen" element={<KitchenDisplay />} />
              </Route>
              <Route element={<PermissionGuard module="pos.waiter" />}>
                <Route path="/pos/waiter" element={<WaiterMobile />} />
              </Route>

              {/* Inventory routes */}
              <Route element={<PermissionGuard module="inventory.stock" />}>
                <Route path="/inventory" element={<StockOverview />} />
              </Route>
              <Route element={<PermissionGuard module="inventory.products" />}>
                <Route path="/inventory/products" element={<Products />} />
              </Route>
              <Route element={<PermissionGuard module="inventory.suppliers" />}>
                <Route path="/inventory/suppliers" element={<Suppliers />} />
              </Route>
              <Route element={<PermissionGuard module="inventory.orders" />}>
                <Route path="/inventory/orders" element={<PurchaseOrders />} />
              </Route>

              {/* Other routes */}
              <Route element={<PermissionGuard module="customers" />}>
                <Route path="/customers" element={<Customers />} />
              </Route>
              <Route element={<PermissionGuard module="reports" />}>
                <Route path="/reports" element={<Reports />} />
              </Route>

              {/* Settings routes */}
              <Route element={<PermissionGuard module="settings.general" />}>
                <Route path="/settings" element={<GeneralSettings />} />
              </Route>
              <Route element={<PermissionGuard module="settings.users" />}>
                <Route path="/settings/users" element={<UserManagement />} />
              </Route>
              <Route element={<PermissionGuard module="settings.roles" />}>
                <Route path="/settings/roles" element={<RoleManagement />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
