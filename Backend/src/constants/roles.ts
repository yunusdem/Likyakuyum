export const UserRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  CASHIER: "cashier",
  USER: "user",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];
