export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(value);

export const formatDateTime = (value: string) => new Date(value).toLocaleString();

export const formatDate = (value: string) => new Date(value).toLocaleDateString();
