import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Permission } from '@/types/database';

type Action = 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_export';

export function usePermissions() {
  const { user, roles, isAdmin } = useAuth();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['permissions', roles],
    queryFn: async () => {
      if (!roles.length) return [];
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .in('role', roles);
      if (error) throw error;
      return (data as Permission[]) || [];
    },
    enabled: !!user && roles.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  function check(module: string, action: Action): boolean {
    if (isAdmin()) return true;
    // Check exact module match, then parent match (e.g. "pos" covers "pos.retail")
    return permissions.some(
      (p) => p.module === module && p[action] === true
    );
  }

  return {
    loading: isLoading,
    canView: (module: string) => check(module, 'can_view'),
    canCreate: (module: string) => check(module, 'can_create'),
    canEdit: (module: string) => check(module, 'can_edit'),
    canDelete: (module: string) => check(module, 'can_delete'),
    canExport: (module: string) => check(module, 'can_export'),
    permissions,
  };
}
