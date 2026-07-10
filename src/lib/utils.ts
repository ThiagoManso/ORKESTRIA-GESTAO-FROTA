import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const ADMIN_EMAILS = [
  'thiago.altriman.man@gmail.com'
];

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: any) {
  if (!date) return 'N/A';
  
  let validDate: Date;
  
  if (date instanceof Date) {
    validDate = date;
  } else if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    validDate = date.toDate();
  } else if (typeof date === 'object' && 'seconds' in date) {
    // Basic fallback for some timestamp-like objects
    validDate = new Date(date.seconds * 1000);
  } else {
    validDate = new Date(date);
  }

  if (isNaN(validDate.getTime())) {
    return 'Data Inválida';
  }

  return new Intl.DateTimeFormat('pt-BR').format(validDate);
}
