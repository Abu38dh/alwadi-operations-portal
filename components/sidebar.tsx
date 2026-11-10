"use client"

import {
  FileText, Plus, Settings, BarChart3, Users, Zap,
  CheckCircle, Inbox, Building2, Share2, CalendarDays,
  UserCheck, CalendarMinus, ChevronRight
} from "lucide-react"

interface SidebarProps {
  currentView: string
  onViewChange: (view: string) => void
  userRole?: "student" | "admin" | "employee" | "reviewer"
  permissions?: string[]
  className?: string
  userStatus?: string
}

export default function Sidebar({
  currentView,
  onViewChange,
  userRole = "student",
  permissions = [],
  className,
  userStatus,
}: SidebarProps) {
  const hasPermission = (permission: string) =>
    permissions.includes("all") || permissions.includes(permission)

  const getEmployeeMenu = () => {
    const baseMenu = [
      { id: "requests", label: "طلباتي",      icon: FileText },
      { id: "submit",   label: "طلب جديد",    icon: Plus },
    ]
    if (hasPermission("review_requests"))
      baseMenu.push({ id: "inbox",      label: "صندوق الوارد",    icon: Inbox })
    if (hasPermission("manage_forms"))
      baseMenu.push({ id: "forms",      label: "إدارة النماذج",   icon: FileText })
    if (hasPermission("manage_users") || hasPermission("grant_delegations")) {
      baseMenu.push({
        id: "users",
        label: hasPermission("manage_users") ? "إدارة المستخدمين" : "الموظفين وتفويض الصلاحيات",
        icon: Users,
      })
    }
    if (hasPermission("manage_departments"))
      baseMenu.push({ id: "departments",label: "إدارة الأقسام",   icon: Building2 })
    if (hasPermission("view_reports"))
      baseMenu.push({ id: "reports",    label: "التقارير",         icon: BarChart3 })
    if (hasPermission("manage_workflows"))
      baseMenu.push({ id: "workflows",  label: "مسارات العمل",    icon: Zap })
    if (hasPermission("review_requests")) {
      baseMenu.push({ id: "history",    label: "سجل الإجراءات",   icon: CheckCircle })
    }
    if (hasPermission("grant_delegations") && !hasPermission("manage_users")) {
      // Optional self-delegation if desired
    }
    baseMenu.push({ id: "settings", label: "الإعدادات", icon: Settings })
    return baseMenu
  }

  const getAdminMenu = () => {
    const baseMenu = [
      { id: "home",         label: "لوحة التحكم",        icon: BarChart3 },
    ]
    if (hasPermission("review_requests")) {
      baseMenu.push({ id: "inbox",        label: "صندوق الوارد",        icon: Inbox })
    }
    if (hasPermission("manage_forms")) {
      baseMenu.push({ id: "forms",        label: "إدارة النماذج",       icon: FileText })
    }
    if (hasPermission("manage_workflows")) {
      baseMenu.push({ id: "workflows",    label: "مسارات العمل",        icon: Zap })
    }
    if (hasPermission("manage_departments")) {
      baseMenu.push({ id: "departments",  label: "إدارة الأقسام",       icon: Building2 })
    }
    if (hasPermission("manage_users")) {
      baseMenu.push({ id: "users",        label: "إدارة المستخدمين",    icon: Users })
    }
    if (hasPermission("view_reports")) {
      baseMenu.push({ id: "reports",      label: "التقارير",             icon: BarChart3 })
    }
    if (hasPermission("grant_delegations")) {
      baseMenu.push({ id: "delegation",   label: "تفويض الصلاحيات",    icon: Share2 })
    }
    if (hasPermission("review_requests")) {
      baseMenu.push({ id: "history",      label: "سجل الإجراءات",      icon: CheckCircle })
    }
    if (hasPermission("audit_access")) {
      baseMenu.push({ id: "employee-kpis",label: "أداء الموظفين",        icon: UserCheck })
    }
    return baseMenu
  }

  const menuConfig = {
    student: [
      { id: "requests",  label: "طلباتي",     icon: FileText },
      { id: "submit",    label: "طلب جديد",   icon: Plus },
      { id: "settings",  label: "الإعدادات",  icon: Settings },
    ],
    admin: getAdminMenu(),
    employee: getEmployeeMenu(),
    reviewer: [
      { id: "requests", label: "صندوق الوارد",     icon: Inbox },
      { id: "submit",   label: "الطلبات المعالجة", icon: CheckCircle },
      { id: "settings", label: "الإعدادات",         icon: Settings },
    ],
  }

  const roleLabels: Record<string, string> = {
    student:  "بوابة الطلبات",
    admin:    "لوحة التحكم الإدارية",
    employee: "نظام الموظف",
    reviewer: "نظام المراجع",
  }

  const menuItems = menuConfig[userRole as keyof typeof menuConfig] ?? []

  return (
    <aside
      dir="rtl"
      className={`
        w-64 h-screen flex flex-col
        bg-white border-l border-slate-200
        overflow-hidden
        ${className ?? ""}
      `}
    >
      {/* Role badge */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div
          className="
            inline-flex items-center gap-2 px-3 py-1.5 rounded-xl
            bg-[#0B2545]/5 border border-[#0B2545]/15
            max-w-[calc(100%-2.75rem)]
          "
        >
          <span
            className="
              w-2 h-2 rounded-full bg-[#C69214] shrink-0
              shadow-[0_0_0_3px_rgba(198,146,20,0.2)]
            "
          />
          <p className="text-xs font-semibold text-[#0B2545] truncate">
            {roleLabels[userRole]}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-slate-200" />

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`
                group w-full flex items-center gap-3
                px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 cursor-pointer
                ${isActive
                  ? "bg-[#0B2545] text-white shadow-sm shadow-[#0B2545]/25"
                  : "text-slate-700 hover:bg-slate-50 hover:text-[#0B2545]"
                }
              `}
            >
              {/* Active bar indicator */}
              <span
                className={`
                  shrink-0 w-0.5 h-5 rounded-full
                  transition-all duration-150
                  ${isActive ? "bg-[#C69214]" : "bg-transparent group-hover:bg-[#C69214]/50"}
                `}
              />

              <Icon
                className={`
                  w-4 h-4 shrink-0 transition-colors duration-150
                  ${isActive ? "text-[#C69214]" : "text-slate-400 group-hover:text-[#0B2545]"}
                `}
              />

              <span className="flex-1 text-right">{item.label}</span>

              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-white/70 shrink-0" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom accent strip */}
      <div className="h-1.5 bg-gradient-to-r from-[#0B2545] via-[#1B3B6F] to-[#C69214]" />
    </aside>
  )
}
