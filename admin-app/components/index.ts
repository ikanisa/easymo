/**
 * Aurora Components Index
 * Centralized export for all Aurora components
 */

// Primitives
export { Button } from './ui/Button';
export type { ButtonProps } from './ui/Button';

export { Input } from './ui/Input';
export type { InputProps } from './ui/Input';

export { Select } from './ui/Select';
export type { SelectProps } from './ui/Select';

export { Textarea } from './ui/Textarea';
export type { TextareaProps } from './ui/Textarea';

export { Toggle } from './ui/Toggle';
export type { ToggleProps } from './ui/Toggle';

export { Checkbox } from './ui/Checkbox';
export type { CheckboxProps } from './ui/Checkbox';

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
