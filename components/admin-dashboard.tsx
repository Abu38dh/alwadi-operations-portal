"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Header from "@/components/header"
import Sidebar from "@/components/sidebar"
import AdminFormsPage from "@/components/admin/admin-forms-page"
import WorkflowsEditor from "@/components/admin/workflows-editor"
import AdminUsersPage from "@/components/admin/admin-users-page"
import AdminReportsPage from "@/components/admin/admin-reports-page"
import AdminDepartmentsPage from "@/components/admin/admin-departments-page"
import EmployeeKpiDashboard from "@/components/admin/employee-kpi-dashboard"
import DelegationRequest from "@/components/dashboard/delegation-request"
import RequestDetail from "@/components/request-detail"
import { InboxRequestList } from "@/components/dashboard/inbox-request-list"
import { DashboardSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import { getAdminStats } from "@/app/actions/admin"
import { getEmployeeInbox } from "@/app/actions/employee"
import { FileText, Users, Workflow, BarChart3, Building2, GraduationCap, CalendarDays, UserCheck, Search } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

interface AdminDashboardProps {
  onLogout: () => void
  userData?: {
    university_id: string
    full_name: string
    role: string
  }
  permissions?: string[]
}

const adminCards = [
  {
    id: "forms",
    title: "إدارة النماذج",
    description: "إنشاء وتعديل نماذج طلبات الموظفين",
    icon: FileText,
  },
  {
    id: "workflows",
    title: "مسارات العمل",
    description: "إدارة مسارات اعتماد الطلبات ومسؤولي الاعتماد",
    icon: Workflow,
  },
  {
    id: "users",
    title: "إدارة الموظفين والمستخدمين",
    description: "إضافة وتعديل بيانات الموظفين والصلاحيات",
    icon: Users,
  },
  {
    id: "reports",
    title: "التقارير وسجل العمليات",
    description: "عرض تقارير الإنجاز وسجل تدقيق الحركات",
    icon: BarChart3,
  },
  {
    id: "departments",
    title: "إدارة الأقسام والإدارات",
    description: "إضافة وتعديل أقسام وإدارات الشركة",
    icon: Building2,
  },
  {
    id: "employee-kpis",
    title: "مؤشرات أداء الموظفين",
    description: "إحصائيات تفصيلية لسرعة الإنجاز والإنتاجية",
    icon: UserCheck,
  },
]

export default function AdminDashboard({ onLogout, userData, permissions = [] }: AdminDashboardProps) {
  const [currentView, setCurrentView] = useState<string>("home")

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('adminDashboardView')
      if (saved) setCurrentView(saved)
    } catch (e) {}
  }, [])

  useEffect(() => {
    try {
      window.sessionStorage.setItem('adminDashboardView', currentView)
    } catch (e) {}
  }, [currentView])

  // Stats state
  const [stats, setStats] = useState({
    totalRequests: 0,
    activeRequests: 0,
    totalUsers: 0,
    totalForms: 0,
    completionRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inbox state
  const [inboxRequests, setInboxRequests] = useState<any[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
  const [historyRequests, setHistoryRequests] = useState<any[]>([])
  const [historySearch, setHistorySearch] = useState("")

  const fetchInbox = async () => {
    if (!userData?.university_id) return
    setInboxLoading(true)
    try {
      const result = await getEmployeeInbox(userData.university_id)
      if (result.success) {
        const mapped = (result.requests || []).map((r: any) => ({
          id: String(r.id || r.requestId || ""),
          type: r.type || r.requestType || "طلب",
          title: r.title || r.type || r.requestType || "طلب",
          applicant: r.applicant || r.applicantName || "",
          date: r.date || (r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('ar-SA') : ""),
          status: r.status || "pending",
          data: r,
        }))
        setInboxRequests(mapped)
        if (mapped.length > 0 && !selectedRequest) setSelectedRequest(mapped[0])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setInboxLoading(false)
    }
  }

  const fetchHistory = async () => {
    if (!userData?.university_id) return
    try {
      const { getEmployeeHistory } = await import("@/app/actions/employee")
      const result = await getEmployeeHistory(userData.university_id)
      if (result.success) setHistoryRequests(result.history || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (currentView === 'inbox') fetchInbox()
    if (currentView === 'history') fetchHistory()
  }, [currentView])

  useEffect(() => {
    fetchStats()

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStats()
      }
    }, 30000) // Poll every 30s instead of 5s to reduce database latency

    return () => clearInterval(intervalId)
  }, [])

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const fetchStats = async () => {
    setError(null)

    try {
      const result = await getAdminStats()
      setStats(result)
    } catch (err) {
      console.error("Failed to fetch admin stats:", err)
      setError("حدث خطأ في تحميل الإحصائيات")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <Header
        userType={userData?.role || "admin"}
        userName={userData?.full_name}
        onLogout={onLogout}
        onMenuClick={() => setIsMobileMenuOpen(true)}
        userId={userData?.university_id || ''}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block h-full">
          <Sidebar currentView={currentView} onViewChange={setCurrentView} userRole="admin" permissions={permissions} />
        </div>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="right" className="p-0 border-0 w-64">
            <div className="sr-only">
              <SheetTitle>قائمة لوحة التحكم</SheetTitle>
              <SheetDescription>قائمة التنقل الجانبية</SheetDescription>
            </div>
            <Sidebar
              currentView={currentView}
              onViewChange={(view) => {
                setCurrentView(view)
                setIsMobileMenuOpen(false)
              }}
              userRole="admin"
              permissions={permissions}
              className="h-full border-none w-full"
            />
          </SheetContent>
        </Sheet>

        <main className="flex-1 overflow-auto">
          {currentView === "home" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-3xl font-bold text-foreground">لوحة التحكم</h2>

                  </div>
                  <p className="text-muted-foreground">نظام إدارة المعاملات وطلبات الموظفين</p>
                </div>
              </div>

              {loading ? (
                <DashboardSkeleton />
              ) : error ? (
                <ErrorMessage error={error} onRetry={fetchStats} />
              ) : (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>إجمالي الطلبات</CardDescription>
                        <CardTitle className="text-3xl">{stats.totalRequests}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">جميع الطلبات في النظام</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>الطلبات النشطة</CardDescription>
                        <CardTitle className="text-3xl text-yellow-600">{stats.activeRequests}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">قيد المعالجة حالياً</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>المستخدمون</CardDescription>
                        <CardTitle className="text-3xl text-primary">{stats.totalUsers}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>معدل الإنجاز</CardDescription>
                        <CardTitle className="text-3xl text-green-600">{stats.completionRate}%</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">الطلبات المكتملة</p>
                      </CardContent>
                    </Card>
                  </div>
                  {/* Management Cards */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4">إدارة النظام</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {adminCards.filter(card => {
                        if (permissions.includes('all')) return true;
                        switch (card.id) {
                          case 'forms': return permissions.includes('manage_forms');
                          case 'workflows': return permissions.includes('manage_workflows');
                          case 'users': return permissions.includes('manage_users');
                          case 'reports': return permissions.includes('view_reports');
                          case 'departments': return permissions.includes('manage_departments');
                          case 'colleges': return permissions.includes('manage_departments');
                          case 'terms': return permissions.includes('manage_terms');
                          case 'employee-kpis': return permissions.includes('audit_access');
                          default: return true;
                        }
                      }).map((card) => {
                        const Icon = card.icon
                        return (
                          <Card
                            key={card.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow hover:border-primary"
                            onClick={() => setCurrentView(card.id)}
                          >
                            <CardHeader>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <Icon className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg">{card.title}</CardTitle>
                                  <CardDescription className="text-sm mt-1">
                                    {card.description}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {currentView === "forms" && <AdminFormsPage onBack={() => setCurrentView("home")} currentUserId={userData?.university_id} />}
          {currentView === "workflows" && <WorkflowsEditor onBack={() => setCurrentView("home")} currentUserId={userData?.university_id} />}
          {currentView === "users" && <AdminUsersPage onBack={() => setCurrentView("home")} currentUserId={userData?.university_id} />}
          {currentView === "reports" && <AdminReportsPage onBack={() => setCurrentView("home")} currentUserId={userData?.university_id} />}
          {currentView === "departments" && <AdminDepartmentsPage onBack={() => setCurrentView("home")} currentUserId={userData?.university_id} />}
          {currentView === "employee-kpis" && <EmployeeKpiDashboard onBack={() => setCurrentView("home")} currentUserId={userData?.university_id} />}

          {/* Inbox View */}
          {currentView === "inbox" && (
            <div className="p-6 space-y-4">
              <h2 className="text-2xl font-bold">صندوق الوارد</h2>
              {inboxLoading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">جاري التحميل...</div>
              ) : (
                <div className="flex gap-4 h-[calc(100vh-180px)]">
                  <InboxRequestList
                    requests={inboxRequests}
                    selectedRequestId={selectedRequest?.id}
                    onSelectRequest={setSelectedRequest}
                  />
                  <div className="flex-1 overflow-auto border rounded-lg bg-card p-4">
                    {selectedRequest ? (
                      <RequestDetail
                        request={selectedRequest.data}
                        showHistory
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        اختر طلباً من القائمة لعرض تفاصيله
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delegation View */}
          {currentView === "delegation" && (
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">تفويض الصلاحيات</h2>
              <DelegationRequest userData={userData || { university_id: "", full_name: "" }} />
            </div>
          )}

          {/* History View */}
          {currentView === "history" && (
            <div className="p-6 space-y-4">
              <h2 className="text-2xl font-bold">سجل الإجراءات</h2>
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في السجل..."
                  className="pr-9"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                {historyRequests
                  .filter((h: any) =>
                    !historySearch ||
                    h.requestType?.includes(historySearch) ||
                    h.applicantName?.includes(historySearch)
                  )
                  .map((h: any, i: number) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{h.requestType}</p>
                          <p className="text-sm text-muted-foreground">{h.applicantName} — #{h.requestId}</p>
                        </div>
                        <div className="text-left">
                          <Badge variant="outline" className={h.action === 'approve' ? 'text-green-600 border-green-300' : h.action === 'reject' ? 'text-red-600 border-red-300' : ''}>
                            {h.action === 'approve' ? 'موافقة' : h.action === 'reject' ? 'رفض' : h.action === 'return' ? 'إعادة' : h.action}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(h.createdAt).toLocaleDateString('ar-SA')}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                {historyRequests.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">لا يوجد سجل إجراءات بعد</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

