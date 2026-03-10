import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LowStockAlert } from '@/components/inventory/LowStockAlert';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 flex items-center gap-4 border-b bg-card px-4 lg:px-6">
            <SidebarTrigger className="-ml-2" />
            
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products, orders..."
                  className="pl-8 h-9 bg-muted/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <LowStockAlert />
              <NotificationPanel />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}