// One screen, two views (port of web pages/Cash.tsx @feaca5e): a centre's cash (coordinator, director) or the academy's (admin, super admin).
import { Redirect } from "expo-router";
import { useAuth } from "@/core/auth";
import AdminCash from "./AdminCash";
import CentreCash from "./CentreCash";

export default function Cash() {
  const { roles } = useAuth();
  if (roles.some((r) => r.role === "admin" || r.role === "super_admin")) return <AdminCash />;
  if (roles.some((r) => r.role === "coordinator" || r.role === "centre_director")) return <CentreCash />;
  return <Redirect href="/" />;
}
