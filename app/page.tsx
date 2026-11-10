import { auth } from "@/auth"
import { db } from "@/lib/db"
import LoginPage from "@/components/login-page"
import StudentDashboard from "@/components/student-dashboard"
import EmployeeDashboard from "@/components/employee-dashboard"
import AdminDashboard from "@/components/admin-dashboard"
import { logout } from "@/app/actions/login"

export default async function Home() {
  const session = await auth()

  if (!session || !session.user) {
    return <LoginPage />
  }

  const { user } = session
  const role = user.role?.toLowerCase() || ""

  // Refresh permissions from DB to reflect changes immediately without re-login
  if (role !== "student") {
    try {
      const freshUser = await db.users.findUnique({
        where: { university_id: user.university_id },
        select: { custom_permissions: true, roles: { select: { permissions: true } } }
      })
      if (freshUser) {
        if (role === 'admin') {
          const ALL_ADMIN_PERMS = ['review_requests', 'manage_forms', 'manage_users', 'manage_departments', 'view_reports', 'manage_workflows', 'grant_delegations', 'audit_access', 'can_manage_absences', 'manage_terms', 'manage_levels']
          const storedPerms = freshUser.custom_permissions ? JSON.parse(freshUser.custom_permissions) : []
          const isFullAccess = storedPerms.length === 0 || storedPerms.includes('all') || storedPerms.length < 5
          user.permissions = isFullAccess ? ALL_ADMIN_PERMS : storedPerms
        } else {
          user.permissions = freshUser.custom_permissions 
            ? JSON.parse(freshUser.custom_permissions) 
            : (freshUser.roles?.permissions as string[] || [])
        }
      }
    } catch (e) {
      console.error("Failed to refresh permissions:", e)
    }
  }

  // Prepare userData object strictly compatible with dashboard prop types
  const dashboardUserData = {
    university_id: user.university_id || "",
    full_name: user.name || "",
    role: user.role || "",
    user_status: user.user_status || "active",
  }

  switch (true) {
    case role === "student":
    case role === "user":
      return <StudentDashboard userData={dashboardUserData} onLogout={logout} />

    case role === "employee":
    case role === "dean":
    case role === "head_of_department":
    case role === "manager":
    case role === "vice_dean":
    case role === "hr":
      return <EmployeeDashboard permissions={user.permissions || []} userData={dashboardUserData} onLogout={logout} />

    case role === "admin":
      return <AdminDashboard permissions={user.permissions || []} userData={dashboardUserData} onLogout={logout} />

    default:
      if (user.permissions && user.permissions.length > 0) {
        return <EmployeeDashboard permissions={user.permissions} userData={dashboardUserData} onLogout={logout} />
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4" dir="rtl">
          <div className="text-xl text-destructive font-bold">عذراً، هذا الحساب ليس لديه صلاحيات للدخول أو دوره غير معروف.</div>
          <form action={logout}>
            <button type="submit" className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              العودة وتسجيل الخروج
            </button>
          </form>
        </div>
      )
  }
}


