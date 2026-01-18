export type Role = "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";

export const AdminRoles: Role[] = ["SUPER", "MAIN", "SUB"];

export function isAdmin(role: Role | null | undefined) {
  return role ? AdminRoles.includes(role) : false;
}
