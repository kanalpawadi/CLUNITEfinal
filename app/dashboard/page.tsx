import { redirect } from "next/navigation"
import { getStaffMemberships, requireAuthUser } from "@/lib/auth/server"

/** /dashboard picks the right home: club staff go to the organizer view, everyone else to the student view. */
export default async function DashboardIndex() {
  await requireAuthUser("/dashboard")
  const staff = await getStaffMemberships()
  redirect(staff.length > 0 ? "/dashboard/organizer" : "/dashboard/student")
}
