/**
 * Aurora Components Index
 * Centralized export for all Aurora components
 */

// Primitives
export { Button } from './primitives/Button';
export type { ButtonProps } from './primitives/Button';

export { Input } from './primitives/Input';
export type { InputProps } from './primitives/Input';

export { Select } from './primitives/Select';
export type { SelectProps } from './primitives/Select';

export { Textarea } from './primitives/Textarea';
export type { TextareaProps } from './primitives/Textarea';

export { Toggle } from './primitives/Toggle';
export type { ToggleProps } from './primitives/Toggle';

export { Checkbox } from './primitives/Checkbox';
export type { CheckboxProps } from './primitives/Checkbox';

// Layout
export { PageHeader } from './layout/PageHeader';

// Data Display
export { KpiCard } from './data-display/KpiCard';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './data-display/Card';
export { Badge } from './data-display/Badge';

// Feedback
export { Spinner } from './feedback/Spinner';
export { Skeleton, SkeletonText } from './feedback/Skeleton';
export { ToastProvider, useToast } from './feedback/Toast';

// Overlay
export { Modal, ModalFooter } from './overlay/Modal';
export type { ModalProps } from './overlay/Modal';

export { Tooltip } from './overlay/Tooltip';
export type { TooltipProps } from './overlay/Tooltip';

// Navigation
export { Tabs, TabsList, TabsTrigger, TabsContent } from './navigation/Tabs';

export { Breadcrumbs } from './navigation/Breadcrumbs';
export type { BreadcrumbsProps, BreadcrumbItem } from './navigation/Breadcrumbs';

export { Pagination } from './navigation/Pagination';
export type { PaginationProps } from './navigation/Pagination';

// Data Display (Advanced)
export { DataTable } from './data-display/DataTable';
export type { DataTableProps, Column } from './data-display/DataTable';

// Overlay (Advanced)
export { DropdownMenu } from './overlay/DropdownMenu';
export type { DropdownMenuProps, DropdownMenuItem } from './overlay/DropdownMenu';

// Features
export { ThemeSwitcher } from './features/ThemeSwitcher';
export type { ThemeSwitcherProps } from './features/ThemeSwitcher';

export { PageTransition } from './features/PageTransition';
export type { PageTransitionProps } from './features/PageTransition';
