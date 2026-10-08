// Port of the `home` selection in web App.tsx. Each home lives in its owner module's feature folder; this file only chooses.
import { primaryRole, useAuth } from "@/core/auth";
import { AdminHome } from "@/features/admin-people/AdminHome";
import { InstructorHome } from "@/features/class/InstructorHome";
import { CoordinatorHome } from "@/features/staff/CoordinatorHome";
import { DirectorHome } from "@/features/staff/DirectorHome";
import { StaffHome } from "@/features/staff/StaffHome";
import { StudentHome } from "@/features/student/Home";
import { Screen } from "./Screen";

export function RoleHome() {
  const role = primaryRole(useAuth().roles);
  const home = role === "student" ? <StudentHome /> : role === "instructor" ? <InstructorHome /> : role === "admin" || role === "super_admin" ? <AdminHome /> : role === "coordinator" ? <CoordinatorHome /> : role === "centre_director" ? <DirectorHome /> : <StaffHome />;
  return <Screen>{home}</Screen>;
}
