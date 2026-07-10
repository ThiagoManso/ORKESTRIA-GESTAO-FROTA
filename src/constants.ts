export const ADMIN_EMAILS = [
  'thiago.altriman.man@gmail.com'
];

export const isDevEmail = (email: string | null | undefined) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
