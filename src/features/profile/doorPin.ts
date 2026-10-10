// src/features/profile/doorPin.ts
// Port of web lib/doorLock.ts `needsDoorPin`: true for instructors and coordinators who are not also admins, the people who must have a door PIN.
// M9a ports the rest of lib/doorLock.ts (the unlock timer); when it does it can re-export this instead of redefining it.
import type { RoleRow } from "@/core/auth";

export const needsDoorPin = (roles: Pick<RoleRow, "role">[]) =>
  !roles.some((r) => r.role === "admin" || r.role === "super_admin") && roles.some((r) => r.role === "instructor" || r.role === "coordinator");
