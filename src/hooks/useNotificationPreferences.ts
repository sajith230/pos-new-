import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NotificationPreferences {
  low_stock: boolean;
  new_order: boolean;
  system: boolean;
  browser_push: boolean;
  order_ready: boolean;
  order_cancelled: boolean;
}

const DEFAULTS: NotificationPreferences = {
  low_stock: true,
  new_order: true,
  system: true,
  browser_push: true,
  order_ready: true,
  order_cancelled: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('low_stock, new_order, system, browser_push, order_ready, order_cancelled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch notification preferences', error);
        setLoading(false);
        return;
      }

      if (data) {
        setPreferences({
          low_stock: data.low_stock,
          new_order: data.new_order,
          system: data.system,
          browser_push: data.browser_push,
          order_ready: data.order_ready,
          order_cancelled: data.order_cancelled,
        });
      } else {
        // Auto-insert default row
        await supabase
          .from('notification_preferences')
          .insert({ user_id: user.id });
      }
      setLoading(false);
    })();
  }, [user]);

  const updatePreferences = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!user) return;
      const next = { ...preferences, ...patch };
      setPreferences(next);

      const { error } = await supabase
        .from('notification_preferences')
        .update(patch)
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to update preferences', error);
        // revert
        setPreferences(preferences);
      }
    },
    [user, preferences]
  );

  return { preferences, loading, updatePreferences };
}
