"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Header from "@/components/header"
import Sidebar from "@/components/sidebar"
import RequestList from "@/components/request-list"
import RequestDetail from "@/components/request-detail"
import RequestSubmissionForm from "@/components/student/request-submission-form"
import { DashboardSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import { EmptyState } from "@/components/ui/empty-state"
import { getStudentDashboardData } from "@/app/actions/student"
import { getAvailableFormTemplates } from "@/app/actions/forms"
import { getAllTerms } from "@/app/actions/terms"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Search, Sparkles, ChevronRight, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { translateRole } from "@/lib/translations"

interface StudentDashboardProps {
  onLogout: () => void
  userData: {
    university_id: string
    full_name: string
    role: string
    user_status?: string
  }
}

export default function StudentDashboard({ onLogout, userData }: StudentDashboardProps) {
  const [selectedRequest, setSelectedRequest] = useState<string>("")
  type ViewType = "requests" | "submit" | "settings"
  const [currentView, setCurrentView] = useState<ViewType>("requests")

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('studentDashboardView')
      if (saved) setCurrentView(saved as ViewType)
    } catch (e) {}
  }, [])

  useEffect(() => {
    try {
      window.sessionStorage.setItem('studentDashboardView', currentView)
    } catch (e) {}
  }, [currentView])
  const [selectedRequestType, setSelectedRequestType] = useState<string | null>(null)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [formSearchQuery, setFormSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "approved" | "rejected" | "returned">("all")
  const [selectedTermIds, setSelectedTermIds] = useState<number[]>([]) // empty = show all
  const [terms, setTerms] = useState<any[]>([])

  // State for requests and stats
  // State for requests and stats
  const [requests, setRequests] = useState<any[]>([])
  const [availableForms, setAvailableForms] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch data on mount
  useEffect(() => {
    fetchDashboardData()
    // Fetch terms for filter
    getAllTerms().then(result => {
      if (result.success && result.data) setTerms(result.data as any[])
    })

    // --- REAL-TIME UPDATES (SSE) ---
    const eventSource = new EventSource('/api/realtime')
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'refresh') {
          console.log(`[Realtime] Received ${data.target} refresh signal. Updating dashboard...`)
          fetchDashboardData()
        }
      } catch (err) {}
    }
    eventSource.onerror = () => {
      console.warn("[Realtime] Student EventSource lost connection. Retrying...")
    }

    return () => eventSource.close()
  }, [])

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const fetchDashboardData = async () => {
    setError(null)

    try {
      // Parallel fetch for dashboard data and available forms
      const [dashboardResult, formsResult] = await Promise.all([
        getStudentDashboardData(userData.university_id),
        getAvailableFormTemplates(userData.university_id)
      ])

      if (dashboardResult.success && dashboardResult.data) {
        // Map DB requests to UI format
        const mappedRequests = dashboardResult.data.requests.map((r: any) => ({
          id: r.request_id.toString(),
          title: r.form_templates?.name || "طلب عام",
          type: r.form_templates?.name || "طلب عام",
          formId: r.form_templates?.form_id?.toString() || r.form_id?.toString() || "",
          date: new Date(r.submitted_at).toISOString().split('T')[0],
          status: r.status === 'returned' ? 'rejected_with_changes' : (r.status || "pending"),
          description: (r.submission_data as any)?.reason || "لا يوجد وصف",
          submissionData: r.submission_data,
          formSchema: r.form_templates?.schema || null,
          reference_no: r.reference_no,
          pdfTemplate: r.form_templates?.pdf_template,
          generateDocument: r.form_templates?.generate_document !== false,
          applicant: userData.full_name,
          term_id: r.term_id ?? null,
          users: r.users, // Pass the users object containing college/dept info
          attachments: r.attachments || [], // Pass attachments from admin/employee uploads
          workflow: (() => {
            let steps = [...(r.form_templates?.request_types?.workflows?.workflow_steps || [])];
            const currentStepId = r.current_step_id;
            const requestStatus = r.status;

            // Find current step index
            let currentStepIndex = steps.findIndex((s: any) => s.step_id === currentStepId);

            // If the current step is an ad-hoc/escalated step (not found in the default steps list)
            if (currentStepIndex === -1 && currentStepId && r.workflow_steps) {
              const originalStepIndex = steps.findIndex((s: any) => 
                s.order === r.workflow_steps.order || 
                s.name === r.workflow_steps.name?.replace(" (تصعيد)", "")
              );
              if (originalStepIndex !== -1) {
                steps[originalStepIndex] = {
                  ...steps[originalStepIndex],
                  step_id: r.workflow_steps.step_id,
                  name: r.workflow_steps.name,
                  users: r.workflow_steps.users,
                  roles: r.workflow_steps.roles
                };
                currentStepIndex = originalStepIndex;
              }
            }

            return steps.map((step: any, index: number) => {
              let status = "pending";

              if (requestStatus === "approved") {
                status = "approved";
              } else if (requestStatus === "rejected") {
                if (index < currentStepIndex) status = "approved";
                else if (index === currentStepIndex) status = "rejected";
                else status = "pending";
              } else if (requestStatus === "returned" || requestStatus === "rejected_with_changes") {
                if (index < currentStepIndex) status = "approved";
                else if (index === currentStepIndex) status = "returned";
                else status = "pending";
              } else {
                // In progress
                if (index < currentStepIndex) status = "approved";
                else if (index === currentStepIndex) status = "processing";
                else status = "pending";

                // Fallback if currentStepIndex is -1 (shouldn't happen for valid active requests) but maybe it's new
                if (currentStepIndex === -1 && index === 0 && requestStatus !== 'approved' && requestStatus !== 'rejected') {
                  status = "processing";
                }
              }

              return {
                step: index + 1,
                department: step.name || `خطوة ${index + 1}`,
                role: step.users?.full_name || (step.roles?.role_name ? translateRole(step.roles.role_name) : "المسؤول"),
                status: status
              };
            });
          })()
        }))

        setRequests(mappedRequests)
        setStats(dashboardResult.data.stats)

        // Only auto-select first request if we are on a larger screen (can't easily detect here without window, so let's default to no selection to be mobile-safe, or check client width)
        // Ideally we want desktop users to see something.
        // Let's rely on the user clicking for now, or use a media query hook if available, but for now simple is better.
        // If we want to keep desktop behavior, we could potentially set it, but then mobile users get thrown into detail view.
        // Compromise: Don't auto-select. This is safer for mobile.
        // if (mappedRequests.length > 0 && !selectedRequest) {
        //   setSelectedRequest(mappedRequests[0].id)
        // }
      } else {
        setError(dashboardResult.error || "فشل في تحميل البيانات")
      }

      // Handle forms
      if (formsResult.success && formsResult.data) {
        setAvailableForms(formsResult.data.map((form: any) => ({
          id: form.form_id.toString(),
          label: form.name,
          icon: "📝" // Default icon
        })))
      }

    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
      setError("حدث خطأ في الاتصال بقاعدة البيانات")
    } finally {
      setLoading(false)
    }
  }

  const handleNewRequest = async () => {
    // Refresh data after submission
    await fetchDashboardData()
    setCurrentView("requests")
    setSelectedRequestType(null)
    setEditingRequestId(null)
  }

  // requestTypes derived from availableForms
  const requestTypes = availableForms

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden" dir="rtl">
      <Header
        userType="student"
        userName={userData.full_name}
        onLogout={onLogout}
        onMenuClick={() => setIsMobileMenuOpen(true)}
        userId={userData.university_id}
      />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <div className="hidden md:block h-full">
          <Sidebar currentView={currentView} onViewChange={(view) => setCurrentView(view as any)} userRole="student" userStatus={userData.user_status} />
        </div>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="right" className="p-0 border-0 w-64">
            <div className="sr-only">
              <SheetTitle>قائمة التنقل</SheetTitle>
              <SheetDescription>قائمة التنقل الجانبية للوصول للخدمات</SheetDescription>
            </div>
            <Sidebar
              currentView={currentView}
              onViewChange={(view) => {
                setCurrentView(view as any)
                setIsMobileMenuOpen(false)
              }}
              userRole="student"
              userStatus={userData.user_status}
              className="h-full border-none w-full"
            />
          </SheetContent>
        </Sheet>

        <main className="flex-1">
          {/* Requests View */}
          {currentView === "requests" && !editingRequestId && (
            <>
              {loading ? (
                <div className="p-6">
                  <DashboardSkeleton />
                </div>
              ) : error ? (
                <div className="p-6">
                  <ErrorMessage error={error} onRetry={fetchDashboardData} />
                </div>
              ) : (
                <>
                  {/* Stats Cards */}
                  <div className={`p-2.5 sm:p-3 md:p-6 border-b bg-muted/30 w-full overflow-hidden ${selectedRequest ? 'hidden md:block' : 'block'}`}>
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                      <Card className="md:min-w-0 shadow-sm border-slate-200">
                        <CardHeader className="p-2 md:pb-2 text-center md:text-right">
                          <CardDescription className="text-[10px] md:text-sm whitespace-nowrap overflow-hidden text-ellipsis">إجمالي الطلبات</CardDescription>
                            <CardTitle className="text-lg md:text-3xl">{stats.total}</CardTitle>
                        </CardHeader>
                      </Card>
                      <Card className="md:min-w-0 shadow-sm border-slate-200">
                        <CardHeader className="p-2 md:pb-2 text-center md:text-right">
                          <CardDescription className="text-[10px] md:text-sm whitespace-nowrap overflow-hidden text-ellipsis">قيد المعالجة</CardDescription>
                          <CardTitle className="text-lg md:text-3xl text-yellow-600">{stats.pending}</CardTitle>
                        </CardHeader>
                      </Card>
                      <Card className="md:min-w-0 shadow-sm border-slate-200">
                        <CardHeader className="p-2 md:pb-2 text-center md:text-right">
                          <CardDescription className="text-[10px] md:text-sm whitespace-nowrap overflow-hidden text-ellipsis">مكتملة</CardDescription>
                          <CardTitle className="text-lg md:text-3xl text-green-600">{stats.completed}</CardTitle>
                        </CardHeader>
                      </Card>
                    </div>
                  </div>

                  {/* Requests List & Detail */}
                  {requests.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon="📭"
                        title="لا توجد طلبات"
                        description={userData.user_status === 'graduated' ? `مرحباً ${userData.full_name}! ليس لديك طلبات سابقة.` : `مرحباً ${userData.full_name}! لم تقم بتقديم أي طلبات بعد. ابدأ بتقديم طلب جديد.`}
                        action={userData.user_status !== 'graduated' ? {
                          label: "تقديم طلب جديد",
                          onClick: () => setCurrentView("submit")
                        } : undefined}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Term filter + Request List Column */}
                      <div className={`w-full md:w-1/3 space-y-4 ${selectedRequest ? 'hidden md:block' : 'block'
                        }`}>
                        <div className="w-full overflow-x-auto pb-1 mb-2">
                          <Tabs defaultValue="all" value={filterTab} onValueChange={(val) => setFilterTab(val as any)} className="w-full min-w-max">
                            <TabsList className="w-full flex h-11 p-1">
                              <TabsTrigger value="all" className="flex-1 text-xs md:text-sm font-semibold data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">الكل</TabsTrigger>
                              <TabsTrigger value="pending" className="flex-1 text-xs md:text-sm font-semibold text-amber-600 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">قيد الانتظار</TabsTrigger>
                              <TabsTrigger value="returned" className="flex-1 text-xs md:text-sm font-semibold text-orange-600 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">للتعديل</TabsTrigger>
                              <TabsTrigger value="approved" className="flex-1 text-xs md:text-sm font-semibold text-emerald-600 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">المقبولة</TabsTrigger>
                              <TabsTrigger value="rejected" className="flex-1 text-xs md:text-sm font-semibold text-rose-600 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">المرفوضة</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>

                        {/* Term filter checkboxes */}
                        {(() => {
                          const relevantTerms = terms.filter(t => requests.some(r => r.term_id === t.term_id))
                          if (relevantTerms.length === 0) return null
                          
                          return (
                            <div className="border border-border/50 rounded-xl p-4 bg-card shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                  تصفية حسب الفترة التشغيلية
                                </h3>
                                {selectedTermIds.length > 0 && (
                                  <button
                                    className="text-xs font-medium text-rose-500 hover:text-rose-600 hover:underline transition-colors bg-rose-50 px-2 py-1 rounded-md"
                                    onClick={() => setSelectedTermIds([])}
                                  >
                                    إلغاء التصفية
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {relevantTerms.map((term: any) => {
                                  const checked = selectedTermIds.includes(term.term_id)
                                  return (
                                    <button
                                      key={term.term_id}
                                      onClick={() => {
                                        setSelectedTermIds(prev =>
                                          checked
                                            ? prev.filter(id => id !== term.term_id)
                                            : [...prev, term.term_id]
                                        )
                                      }}
                                      className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all duration-200 border ${
                                        checked 
                                          ? 'bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90' 
                                          : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                                      }`}
                                    >
                                      {term.name}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}

                        <RequestList
                          requests={requests.filter(r => {
                            // Status filter
                            const statusMatch = (() => {
                              if (filterTab === "all") return true;
                              if (filterTab === "pending") return ['pending', 'in_progress', 'processing'].includes(r.status);
                              if (filterTab === "returned") return ['returned', 'rejected_with_changes'].includes(r.status);
                              if (filterTab === "approved") return r.status === 'approved';
                              if (filterTab === "rejected") return r.status === 'rejected';
                              return true;
                            })()
                            // Term filter (if any selected)
                            const termMatch = selectedTermIds.length === 0
                              ? true
                              : selectedTermIds.includes(r.term_id)
                            return statusMatch && termMatch
                          })}
                          selectedId={selectedRequest}
                          onSelect={setSelectedRequest}
                          loading={loading}
                        />
                      </div>

                      {/* Request Detail Column */}
                      <div className={`w-full md:w-2/3 flex flex-col bg-slate-50/50 p-4 md:p-6 rounded-lg border border-border/50 ${selectedRequest ? 'flex' : 'hidden md:flex'
                        }`}>
                        {(() => {
                          const selectedRequestObj = requests.find((r) => r.id === selectedRequest)
                          return selectedRequestObj ? (
                          <RequestDetail
                            request={selectedRequestObj}
                            onEdit={() => setEditingRequestId(selectedRequest)}
                            onBack={() => setSelectedRequest("")}
                            userId={userData.university_id}
                            showHistory={true}
                            hideActivityLog={true}
                          />
                        ) : (
                          <div className="flex items-center justify-center p-12 text-muted-foreground w-full">
                            اختر طلباً لعرض التفاصيل
                          </div>
                        )
                        })()}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Submit View */}
          {(currentView === "submit" || editingRequestId) ? (
            <div className="p-2.5 sm:p-4 md:p-6 w-full space-y-3">
              {!selectedRequestType && !editingRequestId ? (
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-foreground">
                        طلب جديد
                      </h2>
                      <p className="text-xs text-muted-foreground">اختر نوع النموذج لتقديم طلبك</p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
                      <Input
                        placeholder="ابحث عن نموذج..."
                        value={formSearchQuery}
                        onChange={(e) => setFormSearchQuery(e.target.value)}
                        className="h-8 sm:h-9 text-xs sm:text-sm pr-8 bg-white border-slate-200 rounded-lg shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                    {requestTypes.filter(f => (f?.label || "").toLowerCase().includes((formSearchQuery || "").toLowerCase())).length > 0 ? (
                      requestTypes
                        .filter(f => (f?.label || "").toLowerCase().includes((formSearchQuery || "").toLowerCase()))
                        .map((type) => (
                          <div
                            key={type.id}
                            onClick={() => setSelectedRequestType(type.id)}
                            className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-primary/40 rounded-xl p-2.5 sm:p-3.5 cursor-pointer transition-all duration-150 shadow-xs flex items-center justify-between gap-2.5 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <h3 className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                {type.label}
                              </h3>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-primary/80 shrink-0">
                              <span className="hidden sm:inline">تقديم</span>
                              <ChevronRight className="w-4 h-4 rtl:rotate-180 text-muted-foreground group-hover:text-primary" />
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="col-span-full py-8 text-center text-muted-foreground border border-dashed border-border/70 rounded-xl bg-slate-50/50">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-25" />
                        <h3 className="text-sm font-semibold mb-0.5">لم يتم العثور على نتائج</h3>
                        <p className="text-xs opacity-70">جرب البحث بكلمات مختلفة أو تصفح القائمة</p>
                        <Button 
                          variant="link" 
                          size="sm"
                          onClick={() => setFormSearchQuery("")}
                          className="mt-1 text-primary text-xs"
                        >
                          عرض جميع النماذج
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <RequestSubmissionForm
                  requestType={selectedRequestType || requests.find(r => r.id === editingRequestId)?.formId || ""}
                  requestTypes={requestTypes}
                  userId={userData.university_id}
                  onBack={() => {
                    setSelectedRequestType(null)
                    setEditingRequestId(null)
                    if (editingRequestId) setCurrentView("requests")
                  }}
                  onSubmit={handleNewRequest}
                  initialData={editingRequestId ? requests.find(r => r.id === editingRequestId)?.submissionData : undefined}
                  requestId={editingRequestId || undefined}
                  isEditing={!!editingRequestId}
                />
              )}
            </div>
          ) : null}

          {/* Settings View */}
          {currentView === "settings" && (
            <div className="p-6 max-w-4xl">
              <h2 className="text-2xl font-bold text-foreground mb-4">الإعدادات</h2>
              <Card>
                <CardHeader>
                  <CardTitle>معلومات الحساب</CardTitle>
                  <CardDescription>بيانات حسابك الشخصية</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">الاسم</p>
                    <p className="font-medium">{userData.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الرقم التعريفي</p>
                    <p className="font-medium">{userData.university_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الدور</p>
                    <Badge>مستخدم</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          </main>
      </div>
    </div>
  )
}

