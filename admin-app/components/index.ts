/**
 * Aurora Components Index
 * Centralized export for all Aurora components
 */

// Primitives
export type { ButtonProps } from './ui/Button';
export { Button } from './ui/Button';
export type { CheckboxProps } from './ui/Checkbox';
export { Checkbox } from './ui/Checkbox';
export type { InputProps } from './ui/Input';
export { Input } from './ui/Input';
export type { SelectProps } from './ui/Select';
export { Select } from './ui/Select';
export type { TextareaProps } from './ui/Textarea';
export { Textarea } from './ui/Textarea';
export type { ToggleProps } from './ui/Toggle';
export { Toggle } from './ui/Toggle';

// Layout
export { PageHeader } from './layout/PageHeader';

// Data Display
export { Badge } from './data-display/Badge';
export { Card, CardContent, CardDescription, CardFooter,CardHeader, CardTitle } from './data-display/Card';
export { KpiCard } from './data-display/KpiCard';

// Feedback
export { Skeleton, SkeletonText } from './feedback/Skeleton';
export { Spinner } from './feedback/Spinner';
export { ToastProvider, useToast } from './feedback/Toast';

// Overlay
export type { ModalProps } from './overlay/Modal';
export { Modal, ModalFooter } from './overlay/Modal';
export type { TooltipProps } from './overlay/Tooltip';
export { Tooltip } from './overlay/Tooltip';

// Navigation
export type { BreadcrumbItem,BreadcrumbsProps } from './navigation/Breadcrumbs';
export { Breadcrumbs } from './navigation/Breadcrumbs';
export type { PaginationProps } from './navigation/Pagination';
export { Pagination } from './navigation/Pagination';
export { Tabs, TabsContent,TabsList, TabsTrigger } from './navigation/Tabs';

// Data Display (Advanced)
export type { Column,DataTableProps } from './data-display/DataTable';
export { DataTable } from './data-display/DataTable';

// Overlay (Advanced)
export type { DropdownMenuItem,DropdownMenuProps } from './overlay/DropdownMenu';
export { DropdownMenu } from './overlay/DropdownMenu';

// Features
export type { PageTransitionProps } from './features/PageTransition';
export { PageTransition } from './features/PageTransition';
export type { ThemeSwitcherProps } from './features/ThemeSwitcher';
export { ThemeSwitcher } from './features/ThemeSwitcher';
