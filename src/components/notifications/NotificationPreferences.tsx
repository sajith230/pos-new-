import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Package, ShoppingCart, Monitor, ChefHat, XCircle } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { Skeleton } from '@/components/ui/skeleton';

const items = [
  { key: 'low_stock' as const, label: 'Low Stock Alerts', desc: 'Get notified when inventory falls below minimum', icon: Package },
  { key: 'new_order' as const, label: 'New Orders', desc: 'Get notified when a new order is placed', icon: ShoppingCart },
  { key: 'order_ready' as const, label: 'Order Ready', desc: 'Get notified when an order is ready to serve', icon: ChefHat },
  { key: 'order_cancelled' as const, label: 'Order Cancelled', desc: 'Get notified when an order is cancelled', icon: XCircle },
  { key: 'system' as const, label: 'System Notifications', desc: 'General system alerts and updates', icon: Bell },
  { key: 'browser_push' as const, label: 'Browser Push', desc: 'Show desktop notifications when tab is not focused', icon: Monitor },
];

export function NotificationPreferences() {
  const { preferences, loading, updatePreferences } = useNotificationPreferences();

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Choose which notifications you want to receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <Label htmlFor={key} className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
            <Switch
              id={key}
              checked={preferences[key]}
              onCheckedChange={(checked) => updatePreferences({ [key]: checked })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
