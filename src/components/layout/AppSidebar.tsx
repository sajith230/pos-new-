import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  ChefHat,
  Smartphone,
  Package,
  Tags,
  Truck,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  UserCog,
  Shield,
  LogOut,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  module: string;
}

const mainNavItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
];

const posNavItems: NavItem[] = [
  { title: 'Retail POS', url: '/pos', icon: ShoppingCart, module: 'pos.retail' },
  { title: 'Restaurant POS', url: '/pos/restaurant', icon: UtensilsCrossed, module: 'pos.restaurant' },
  { title: 'Waiter Mode', url: '/pos/waiter', icon: Smartphone, module: 'pos.waiter' },
  { title: 'Kitchen Display', url: '/pos/kitchen', icon: ChefHat, module: 'pos.kitchen' },
];

const inventoryNavItems: NavItem[] = [
  { title: 'Stock Overview', url: '/inventory', icon: Package, module: 'inventory.stock' },
  { title: 'Products', url: '/inventory/products', icon: Tags, module: 'inventory.products' },
  { title: 'Suppliers', url: '/inventory/suppliers', icon: Truck, module: 'inventory.suppliers' },
  { title: 'Purchase Orders', url: '/inventory/orders', icon: ClipboardList, module: 'inventory.orders' },
];

const crmNavItems: NavItem[] = [
  { title: 'Customers', url: '/customers', icon: Users, module: 'customers' },
];

const reportsNavItems: NavItem[] = [
  { title: 'Reports', url: '/reports', icon: BarChart3, module: 'reports' },
];

const settingsNavItems: NavItem[] = [
  { title: 'General', url: '/settings', icon: Settings, module: 'settings.general' },
  { title: 'Users', url: '/settings/users', icon: UserCog, module: 'settings.users' },
  { title: 'Roles', url: '/settings/roles', icon: Shield, module: 'settings.roles' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const currentPath = location.pathname;
  const { profile, signOut, business, isAdmin } = useAuth();
  const { canView } = usePermissions();

  const admin = isAdmin();

  const filterItems = (items: NavItem[]) =>
    admin ? items : items.filter((item) => canView(item.module));

  const filteredPos = filterItems(posNavItems);
  const filteredInventory = filterItems(inventoryNavItems);
  const filteredCrm = filterItems(crmNavItems);
  const filteredReports = filterItems(reportsNavItems);
  const filteredSettings = filterItems(settingsNavItems);

  const renderNavItems = (items: (typeof mainNavItems[0] | NavItem)[]) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  const renderGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider px-3">
          {!collapsed && label}
        </SidebarGroupLabel>
        <SidebarGroupContent>{renderNavItems(items)}</SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="py-4">
        {/* Logo/Brand */}
        <div className="px-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-semibold text-sidebar-foreground">
                  {business?.name || 'ERP System'}
                </span>
                <span className="text-xs text-sidebar-foreground/60">
                  Business Suite
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation - always visible */}
        <SidebarGroup>
          <SidebarGroupContent>{renderNavItems(mainNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        {renderGroup('Point of Sale', filteredPos)}
        {renderGroup('Inventory', filteredInventory)}
        {renderGroup('CRM', filteredCrm)}
        {renderGroup('Analytics', filteredReports)}
        {renderGroup('Settings', filteredSettings)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || 'User'}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
