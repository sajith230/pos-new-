import * as React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PermissionButtonProps extends ButtonProps {
  permitted: boolean;
  tooltip?: string;
}

const PermissionButton = React.forwardRef<HTMLButtonElement, PermissionButtonProps>(
  ({ permitted, tooltip = "You don't have permission for this action", className, children, onClick, ...props }, ref) => {
    if (permitted) {
      return (
        <Button ref={ref} className={className} onClick={onClick} {...props}>
          {children}
        </Button>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block cursor-not-allowed">
              <Button
                ref={ref}
                className={cn('pointer-events-none opacity-50', className)}
                disabled
                tabIndex={-1}
                {...props}
              >
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

PermissionButton.displayName = 'PermissionButton';

export { PermissionButton };
