"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import NextImage from "next/image" // Aliased to avoid conflict with window.Image
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Header from "@/components/header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Sidebar from "@/components/sidebar"
import RequestTracking from "@/components/student/request-tracking"
import RequestSubmissionForm from "@/components/student/request-submission-form"
import RequestList from "@/components/request-list"
import RequestDetail from "@/components/request-detail"
import { DashboardSkeleton, TableSkeleton, ListSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import { EmptyState } from "@/components/ui/empty-state"
import { getEmployeeInbox, getEmployeeStats, processRequest, getEmployeeRequests } from "@/app/actions/employee"
import { getAvailableFormTemplates } from "@/app/actions/forms"
import { CheckCircle, CheckCircle2, XCircle, Clock, FileText, RotateCcw, Redo2, Upload, ExternalLink, Search, Sparkles, ChevronRight, ArrowRight } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import AdminFormsPage from "@/components/admin/admin-forms-page"
import WorkflowsEditor from "@/components/admin/workflows-editor"
import AdminUsersPage from "@/components/admin/admin-users-page"
import AdminReportsPage from "@/components/admin/admin-reports-page"
import AdminDepartmentsPage from "@/components/admin/admin-departments-page"
import TermsManagement from "@/components/admin/terms-management"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { arSA } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { RequestStats } from "@/components/dashboard/request-stats"
import DelegationRequest from "@/components/dashboard/delegation-request"
import { InboxRequestList } from "@/components/dashboard/inbox-request-list"
import { FilePreviewDialog } from "@/components/shared/file-preview-dialog"
import { RequestActionDialog, ActionType } from "@/components/dashboard/request-action-dialog"

import { Request, RequestStats as RequestStatsType } from "@/types/schema"
import { translateRole } from "@/lib/translations"

interface EmployeeDashboardProps {
  onLogout: () => void
  permissions?: string[]
  userData: {
    university_id: string
    full_name: string
    role: string
  }
}

export default function EmployeeDashboard({ onLogout, permissions = [], userData }: EmployeeDashboardProps) {
  type ViewType = "requests" | "inbox" | "submit" | "reviews" | "forms" | "users" | "departments" | "reports" | "workflows" | "delegation" | "settings" | "history" | "absences" | "terms" | "levels"
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.sessionStorage.getItem('employeeDashboardView')
      if (saved) return saved as ViewType
    }
    return "requests"
  })

  useEffect(() => {
    window.sessionStorage.setItem('employeeDashboardView', currentView)
    setSelectedRequest(null)
  }, [currentView])

  const [selectedRequestType, setSelectedRequestType] = useState<string | null>(null)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [formSearchQuery, setFormSearchQuery] = useState("")

  // Permission helper
  const hasPermission = (permission: string) => {
    return permissions.includes("all") || permissions.includes(permission)
  }

  // Enforce permission restrictions on views
  useEffect(() => {
    const isAuthorized = () => {
      if (currentView === "inbox" || currentView === "history") {
        return hasPermission("review_requests")
      }
      if (currentView === "forms") {
        return hasPermission("manage_forms")
      }
      if (currentView === "users") {
        return hasPermission("manage_users") || hasPermission("grant_delegations")
      }
      if (currentView === "departments") {
        return hasPermission("manage_departments")
      }
      if (currentView === "reports") {
        return hasPermission("view_reports")
      }
      if (currentView === "workflows") {
        return hasPermission("manage_workflows")
      }
      if (currentView === "absences") {
        return hasPermission("can_manage_absences")
      }
      if (currentView === "terms") {
        return hasPermission("manage_terms")
      }
      if (currentView === "levels") {
        return hasPermission("manage_levels")
      }
      if (currentView === "delegation") {
        return hasPermission("grant_delegations")
      }
      return true
    }

    if (!isAuthorized()) {
      setCurrentView("requests")
    }
  }, [currentView, permissions])

  // Data states
  const [inboxRequests, setInboxRequests] = useState<Request[]>([])
  const [myRequests, setMyRequests] = useState<Request[]>([])
  const [historyRequests, setHistoryRequests] = useState<any[]>([])
  const [availableForms, setAvailableForms] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [stats, setStats] = useState<RequestStatsType>({ returned: 0, approved: 0, rejected: 0, pending: 0 })
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Action states
  const [isProcessing, setIsProcessing] = useState(false)
  // actionComment state removed as it is now handled in RequestActionDialog
  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: ActionType }>({
    open: false,
    type: null
  })
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null)
  const [internalNote, setInternalNote] = useState("")
  const [filePreview, setFilePreview] = useState<{ open: boolean; type: 'image' | 'pdf' | 'other'; content: string; name: string } | null>(null)

  const [selectedRequestHistory, setSelectedRequestHistory] = useState<any[]>([])
  const [selectedRequestHistoryLoading, setSelectedRequestHistoryLoading] = useState(false)

  // History detail states
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearchQuery, setHistorySearchQuery] = useState("")


  useEffect(() => {
    // Initial fetch in parallel
    const loadInitialData = async () => {
      setLoading(true)
      try {
        const [inboxRes, requestsRes, statsRes, formsRes, historyRes, termsRes] = await Promise.all([
          getEmployeeInbox(userData.university_id),
          getEmployeeRequests(userData.university_id),
          getEmployeeStats(userData.university_id),
          getAvailableFormTemplates(userData.university_id),
          import("@/app/actions/employee").then(m => m.getEmployeeHistory(userData.university_id)),
          import("@/app/actions/terms").then(m => m.getAllTerms())
        ])

        if (inboxRes.success && inboxRes.requests) {
          const mappedRequests: Request[] = inboxRes.requests.map((r: any) => ({
            ...r,
            status: r.status as any
          }))
          setInboxRequests(mappedRequests)
          if (mappedRequests.length > 0 && currentView === 'inbox' && typeof window !== 'undefined' && window.innerWidth >= 768) {
            setSelectedRequest(mappedRequests[0])
          }
        }
        if (requestsRes.success && requestsRes.requests) {
          setMyRequests(requestsRes.requests.map((r: any) => ({
            ...r,
            applicant: r.users?.full_name || userData.full_name,
            status: r.status as any,
            type: r.title || r.type
          })))
        }
        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data)
        }
        if (formsRes.success && formsRes.data) {
          setAvailableForms(formsRes.data)
        }
        if (historyRes.success && historyRes.history) {
          setHistoryRequests(historyRes.history)
        }
        if (termsRes.success && termsRes.data) {
          setTerms(termsRes.data)
        }
      } catch (err) {
        console.error("Dashboard initial load error:", err)
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()

    // --- REAL-TIME UPDATES (SSE) only in development to prevent Vercel Serverless connection exhaustion ---
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return
    let eventSource: EventSource | null = null
    if (process.env.NODE_ENV === 'development') {
      eventSource = new EventSource('/api/realtime')
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'refresh') {
            fetchInboxData()
            fetchStats()
          }
        } catch (err) {}
      }
    }

    return () => {
      if (eventSource) eventSource.close()
    }
  }, [])

  useEffect(() => {
    if (selectedRequest) {
      const fetchHistory = async () => {
        setSelectedRequestHistoryLoading(true)
        try {
          const { getRequestActions } = await import("@/app/actions/student")
          const actions = await getRequestActions(selectedRequest.id)
          setSelectedRequestHistory(actions)
        } catch (e) {
          console.error(e)
        } finally {
          setSelectedRequestHistoryLoading(false)
        }
      }
      fetchHistory()
    } else {
      setSelectedRequestHistory([])
    }
  }, [selectedRequest])
// ... (rest of the component logic)

// ... (render part)

              {/* History Item Detail Sheet */}
              <Sheet open={!!selectedHistoryItem} onOpenChange={(open) => !open && setSelectedHistoryItem(null)}>
                <SheetContent side="left" className="sm:max-w-2xl w-full overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>تفاصيل الطلب (من السجل)</SheetTitle>
                    <SheetDescription className="sr-only">تفاصيل الطلب من سجل الإجراءات</SheetDescription>
                  </SheetHeader>
                  {historyLoading ? (
                    <div className="p-4 space-y-4">
                      <div className="h-4 bg-muted animate-pulse rounded w-1/4"></div>
                      <div className="h-32 bg-muted animate-pulse rounded"></div>
                    </div>
                  ) : selectedHistoryItem && selectedHistoryItem !== true ? (
                    <div className="mt-6">
                      <RequestDetail
                        request={selectedHistoryItem}
                        showHistory={true}
                      />
                    </div>
                  ) : null}
                </SheetContent>
              </Sheet>

  const fetchMyRequests = async () => {
    try {
      const result = await getEmployeeRequests(userData.university_id)
      if (result.success && result.requests) {
        // Map the response to match Request interface
        const mappedRequests: Request[] = result.requests.map((r: any) => ({
          ...r,
          applicant: r.users?.full_name || userData.full_name, // Use userData for my requests
          status: r.status as any, // Cast status
          type: r.title || r.type // Handle title/type discrepancy
        }))
        setMyRequests(mappedRequests)
      }
    } catch (err) {
      console.error("Failed to fetch my requests:", err)
    }
  }

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const fetchInboxData = async () => {
    setError(null)

    try {
      const result = await getEmployeeInbox(userData.university_id)

      if (result.success && result.requests) {
        const mappedRequests: Request[] = result.requests.map((r: any) => ({
          ...r,
          status: r.status as any
        }))
        setInboxRequests(mappedRequests)
        if (mappedRequests.length > 0 && currentView === 'inbox' && typeof window !== 'undefined' && window.innerWidth >= 768) {
          setSelectedRequest(mappedRequests[0])
        }
      } else {
        setError(result.error || "فشل في تحميل صندوق الوارد")
      }
    } catch (err) {
      console.error("Failed to fetch inbox:", err)
      setError("حدث خطأ في الاتصال بقاعدة البيانات")
    } finally {
      setLoading(false)
    }
  }

  const fetchHistoryData = async () => {
    try {
      const { getEmployeeHistory } = await import("@/app/actions/employee")
      const result = await getEmployeeHistory(userData.university_id)
      if (result.success && result.history) {
        setHistoryRequests(result.history)
      }
    } catch (err) {
      console.error("Failed to fetch history:", err)
    }
  }



  const fetchStats = async () => {
    try {
      const result = await getEmployeeStats(userData.university_id)
      if (result.success && result.data) {
        setStats(result.data)
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err)
    }
  }

  const fetchAvailableForms = async () => {
    try {
      const result = await getAvailableFormTemplates(userData.university_id)
      if (result.success && result.data) {
        setAvailableForms(result.data.map((form: any) => ({
          id: form.form_id.toString(),
          label: form.name,
          icon: "📝"
        })))
      }
    } catch (err) {
      console.error("Failed to fetch available forms:", err)
    }
  }



  // History detail states

  const handleViewHistory = async (requestId: string) => {
    setHistoryLoading(true)
    setSelectedHistoryItem(true) // Set to true/placeholder to open sheet immediately
    try {
      const { getRequestDetail } = await import("@/app/actions/student")
      const result = await getRequestDetail(parseInt(requestId), userData.university_id)
      if (result.success && result.data) {
        setSelectedHistoryItem(result.data)
      } else {
        // Handle error, maybe close sheet
        console.error(result.error)
        setSelectedHistoryItem(null)
      }
    } catch (e) {
      console.error(e)
      setSelectedHistoryItem(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Requester Interaction History
  const [requesterHistoryDialog, setRequesterHistoryDialog] = useState<{
    open: boolean
    loading: boolean
    data: any[]
    applicantName: string
    selectedRequestType: string | null
    startDate: string | null
    endDate: string | null
    textSearch: string
    selectedTerms: number[]
    requesterBio?: { name: string; university_id: string; department?: string | null; college?: string | null; email?: string | null; phone?: string | null } | null
  }>({ open: false, loading: false, data: [], applicantName: "", selectedRequestType: null, startDate: null, endDate: null, textSearch: "", selectedTerms: [], requesterBio: null })

  const handleViewRequesterHistory = async (applicantName: string) => {
    setRequesterHistoryDialog({ open: true, loading: true, data: [], applicantName, selectedRequestType: null, startDate: null, endDate: null, textSearch: "", selectedTerms: [], requesterBio: null })
    try {
      const { getRequesterInteractionHistory } = await import("@/app/actions/employee")
      const result = await getRequesterInteractionHistory(userData.university_id, applicantName)
      if (result.success && result.interactions) {
        setRequesterHistoryDialog(prev => ({
          ...prev,
          loading: false,
          data: result.interactions,
          requesterBio: result.requesterBio
        }))
      } else {
        setRequesterHistoryDialog(prev => ({ ...prev, loading: false }))
      }
    } catch (error) {
      console.error("Failed to fetch history", error)
      setRequesterHistoryDialog(prev => ({ ...prev, loading: false }))
    }
  }

  const openActionDialog = (type: 'approve' | 'reject' | 'approve_with_changes' | 'reject_with_changes') => {
    setActionDialog({ open: true, type })
    // Pre-fill comment with template if needed? No.
  }

  const executeAction = async (dialogComment: string, targetStepId?: number | null) => {
    if (!selectedRequest || !actionDialog.type) return

    setIsProcessing(true)
    setError(null)

    try {
      const fullComment = internalNote
        ? `[ملاحظة داخلية]: ${internalNote}\n\n${dialogComment}`
        : dialogComment

      const result = await processRequest(
        selectedRequest.id,
        actionDialog.type,
        fullComment,
        userData.university_id,
        attachment?.content,
        attachment?.name,
        targetStepId
      )

      if (result.success) {
        await fetchInboxData()
        await fetchStats()
        setInternalNote("")
        setAttachment(null)
        setSelectedRequest(null)
        setActionDialog({ open: false, type: null })
      } else {
        // Keep dialog open so the user can adjust and retry
        setError(result.error || "فشل في تنفيذ الإجراء")
      }
    } catch (err) {
      console.error("Failed to process request:", err)
      // Keep dialog open so the user can adjust and retry
      setError("حدث خطأ غير متوقع")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStatClick = (type: 'pending' | 'approved' | 'rejected' | 'returned') => {
    if (type === 'pending') {
      setCurrentView("inbox")
      setHistorySearchQuery("")
    } else {
      fetchHistoryData()
      setCurrentView("history")
      const statusMap: Record<string, string> = {
        approved: "موافق عليه",
        rejected: "مرفوض",
        returned: "معاد للتعديل"
      }
      setHistorySearchQuery(statusMap[type] || type)
    }
  };

  type KnownStatus = "pending" | "processing" | "approved" | "rejected" | "returned"

  const getStatusBadge = (status: string) => {
    const statusMap: Record<KnownStatus | 'unknown', { label: string; className: string }> = {
      pending:    { label: "قيد الانتظار",   className: "bg-yellow-100 text-yellow-800" },
      processing: { label: "قيد المراجعة",   className: "bg-blue-100 text-blue-800" },
      approved:   { label: "موافق عليه",      className: "bg-green-100 text-green-800" },
      rejected:   { label: "مرفوض",           className: "bg-red-100 text-red-800" },
      returned:   { label: "معاد للتعديل",    className: "bg-orange-100 text-orange-800" },
      unknown:    { label: "غير معروف",        className: "bg-gray-100 text-gray-800" },
    }
    const key: KnownStatus | 'unknown' =
      Object.prototype.hasOwnProperty.call(statusMap, status)
        ? (status as KnownStatus)
        : 'unknown'
    const config = statusMap[key]
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const requestTypes = availableForms

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <Header
        userType={userData.role}
        userName={userData.full_name}
        onLogout={onLogout}
        onMenuClick={() => setIsMobileMenuOpen(true)}
        userId={userData.university_id}
      />

      <div className="flex flex-1">

        {/* Desktop Sidebar */}
        <div className="hidden md:block h-full">
          <Sidebar
            currentView={currentView}
            onViewChange={(view) => setCurrentView(view as any)}
            userRole="employee"
            permissions={permissions}
          />
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
              userRole="employee"
              permissions={permissions}
              className="h-full border-none w-full"
            />
          </SheetContent>
        </Sheet>

        <main className="flex-1">
          {/* My Requests View */}
          {currentView === "requests" && (
            <div className="p-2.5 sm:p-6">
              <h2 className={`text-lg sm:text-2xl font-bold mb-3 ${selectedRequest ? 'hidden md:block' : 'block'}`}>طلباتي</h2>
              {myRequests.length === 0 ? (
                <EmptyState
                  icon="📝"
                  title="لا توجد طلبات"
                  description="لم تقم بتقديم أي طلبات بعد. اضغط على 'طلب جديد' لتقديم طلبك الأول."
                  action={{
                    label: "تقديم طلب جديد",
                    onClick: () => setCurrentView("submit")
                  }}
                />
              ) : (
                <div className="flex flex-col md:flex-row gap-6 min-h-[500px]">
                  <div className={`w-full md:w-1/3 border border-border bg-card rounded-xl ${selectedRequest ? 'hidden md:block' : 'block'}`}>
                    <RequestList
                      requests={myRequests.map(r => ({ ...r, title: r.type }))}
                      selectedId={selectedRequest?.id}
                      onSelect={(id) => {
                        const req = myRequests.find(r => r.id === id)
                        if (req) setSelectedRequest(req)
                      }}
                    />
                  </div>
                  <div className={`w-full md:w-2/3 flex flex-col bg-slate-50/50 p-2 sm:p-6 rounded-xl border border-border/50 ${selectedRequest ? 'block' : 'hidden md:flex'}`}>
                    {selectedRequest ? (
                      <RequestDetail
                        request={selectedRequest}
                        onBack={() => setSelectedRequest(null)}
                        onEdit={(selectedRequest.status === 'pending' || selectedRequest.status === 'returned' || (selectedRequest.status as string) === 'rejected_with_changes') ? () => {
                          setEditingRequestId(selectedRequest.id)
                          setCurrentView("submit")
                        } : undefined}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground p-12">
                        <div className="text-center">
                          <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p>اختر طلباً لعرض التفاصيل</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inbox View */}
          {currentView === "inbox" && (
            <>
              {loading ? (
                <div className="p-6">
                  <DashboardSkeleton />
                </div>
              ) : error ? (
                <div className="p-6">
                  <ErrorMessage error={error} onRetry={fetchInboxData} />
                </div>
              ) : (
                <>
                  {/* Stats Cards */}
                  <div className={`p-2 sm:p-4 border-b bg-muted/20 ${selectedRequest ? 'hidden md:block' : 'block'}`}>
                    <RequestStats stats={stats} onStatClick={handleStatClick} />
                  </div>

                  {/* Inbox Content */}
                  {inboxRequests.length === 0 ? (
                    <div className="p-2 sm:p-4">
                      <EmptyState
                        icon=""
                        title="لا توجد طلبات قيد الانتظار"
                        description="صندوق الوارد فارغ. سيتم عرض الطلبات الجديدة هنا."
                      />
                    </div>
                  ) : (
                    <div className="p-2 sm:p-4">
                      <div className="flex flex-col md:flex-row gap-4 items-stretch min-h-[500px]">
                        {/* Requests List */}
                        <InboxRequestList
                          requests={inboxRequests}
                          selectedRequestId={selectedRequest?.id}
                          onSelectRequest={setSelectedRequest}
                          onViewHistory={handleViewRequesterHistory}
                          className={selectedRequest ? "hidden md:block" : "block"}
                        />

                        {/* Request Detail */}
                        <div className={`w-full md:w-2/3 flex flex-col p-2 sm:p-4 bg-slate-50/50 rounded-xl border border-border/50 ${selectedRequest ? 'block' : 'hidden md:flex'}`}>
                          {selectedRequest ? (
                            <div className="space-y-3 sm:space-y-4">
                              {/* Mobile Back Button Bar */}
                              <div className="flex items-center justify-between pb-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedRequest(null)}
                                  className="md:hidden h-8 px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-xs hover:bg-slate-50 gap-1 rounded-lg"
                                >
                                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                                  <span>العودة للوارد</span>
                                </Button>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                                  <span>#{selectedRequest.id}</span>
                                  <span>•</span>
                                  <span>{selectedRequest.date}</span>
                                </div>
                              </div>

                              {/* Compact Header & Info Card */}
                              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs">
                                <div className="relative bg-gradient-to-l from-primary/95 to-primary/80 p-3 sm:p-4 text-white">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1">
                                      <h2 className="text-base sm:text-xl font-bold leading-tight">
                                        {selectedRequest.type}
                                      </h2>
                                      {selectedRequest.description && selectedRequest.description !== "لا يوجد وصف" && (
                                        <p className="text-white/80 text-xs mt-0.5 line-clamp-1">{selectedRequest.description}</p>
                                      )}
                                    </div>
                                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 shrink-0">
                                      {(selectedRequest.status === 'pending' || selectedRequest.status === 'processing') && <Clock className="w-3.5 h-3.5" />}
                                      {selectedRequest.status === 'approved' && <CheckCircle className="w-3.5 h-3.5" />}
                                      {selectedRequest.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                                      {selectedRequest.status === 'returned' && <RotateCcw className="w-3.5 h-3.5" />}
                                      <span>
                                        {selectedRequest.status === 'pending' ? 'قيد الانتظار' :
                                         selectedRequest.status === 'processing' ? 'قيد المراجعة' :
                                         selectedRequest.status === 'approved' ? 'موافق عليه' :
                                         selectedRequest.status === 'rejected' ? 'مرفوض' :
                                         selectedRequest.status === 'returned' ? 'معاد للتعديل' : 'غير معروف'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Applicant & Request Meta Strip */}
                                <div className="p-2.5 sm:p-3 bg-white text-xs">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground font-medium">مقدم الطلب:</span>
                                      <span
                                        className="font-bold text-sm text-primary hover:underline cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleViewRequesterHistory(selectedRequest.applicant)
                                        }}
                                      >
                                        {selectedRequest.applicant}
                                      </span>
                                    </div>
                                    {selectedRequest.college && (
                                      <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                                        {selectedRequest.college}
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600">
                                    {selectedRequest.department && (
                                      <div>
                                        <span className="text-muted-foreground ml-1">القسم:</span>
                                        <span className="font-semibold text-foreground">{selectedRequest.department}</span>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-muted-foreground ml-1">تاريخ التقديم:</span>
                                      <span className="font-medium text-foreground">{selectedRequest.date}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground ml-1">رقم الطلب:</span>
                                      <span className="font-mono font-bold text-foreground">#{selectedRequest.id}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                            {/* Request Content Details */}
                            <Card>
                              <CardHeader>
                                <CardTitle>تفاصيل الطلب</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {Array.isArray(selectedRequest.formSchema) && selectedRequest.submissionData && Object.keys(selectedRequest.submissionData).length > 0 ? (
                                  selectedRequest.formSchema.map((field: any) => {
                                    if (field.type === 'section') {
                                      return (
                                        <h5 key={field.id} className="font-bold text-base text-primary border-b pb-2 mt-4 mb-2">
                                          {field.label}
                                        </h5>
                                      )
                                    }

                                    const value = selectedRequest.submissionData?.[field.key];
                                    if (value === undefined || value === null || value === '') return null;

                                    return (
                                      <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 border-b last:border-0 pb-2 last:pb-0">
                                        <span className="text-sm font-medium text-muted-foreground md:col-span-1">{field.label}:</span>
                                        <span className="text-sm font-semibold text-foreground md:col-span-2 break-words whitespace-pre-wrap">
                                          {typeof value === 'boolean' ? (value ? 'نعم' : 'لا') :
                                            field.type === 'file' ? (
                                              typeof value === 'string' ? (
                                                /* Render file preview */
                                                (() => {
                                                  const isDataUrl = value.startsWith('data:')
                                                  const isImage = isDataUrl ? value.startsWith('data:image') : /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(value)
                                                  const isPdf = isDataUrl ? value.startsWith('data:application/pdf') : /\.pdf$/i.test(value)

                                                  if (isImage) {
                                                    return (
                                                      <div
                                                        className="mt-2 text-center cursor-pointer hover:opacity-95 transition-opacity"
                                                        onClick={() => setFilePreview({
                                                          open: true,
                                                          type: 'image',
                                                          content: value,
                                                          name: field.label
                                                        })}
                                                      >
                                                        <NextImage
                                                          src={value}
                                                          alt="Attached file"
                                                          width={400}
                                                          height={300}
                                                          className="max-w-full h-auto max-h-[300px] rounded-md border border-border mx-auto object-contain"
                                                          unoptimized={true}
                                                        />
                                                      </div>
                                                    )
                                                  }

                                                  return (
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => {
                                                        setFilePreview({
                                                          open: true,
                                                          type: isPdf ? 'pdf' : 'other',
                                                          content: value,
                                                          name: field.label
                                                        })
                                                      }}
                                                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200"
                                                    >
                                                      <FileText className="w-4 h-4" />
                                                      {isPdf ? 'عرض ملف PDF' : 'عرض الملف'}
                                                    </Button>
                                                  )
                                                })()
                                              ) : (
                                                <span className="text-muted-foreground italic">
                                                  لا يوجد ملف (أو تنسيق غير مدعوم)
                                                </span>
                                              )
                                            ) :
                                              field.type === 'date' ? (() => {
                                                try {
                                                  const d = new Date(value)
                                                  return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('ar-EG')
                                                } catch { return String(value) }
                                              })() :
                                                field.type === 'absence_picker' && (typeof value === 'object' || Array.isArray(value)) && value !== null ? (
                                                  Array.isArray(value) ? (
                                                    value.map((item: any) => `المادة: ${item.subjectName || item.subjectId}، التاريخ: ${item.date}`).join(' | ')
                                                  ) : (
                                                    `المادة: ${(value as any).subjectName || (value as any).subjectId}، التاريخ: ${(value as any).date}`
                                                  )
                                                ) :
                                                  typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                      </div>
                                    )
                                  })
                                ) : selectedRequest.submissionData && Object.keys(selectedRequest.submissionData).length > 0 ? (
                                  (() => {
                                    const orderedKeys = [
                                      "type", "delegatee_name", "delegatee_university_id",
                                      "start_date", "end_date", "reason", "delegated_types"
                                    ];
                                    const entries = Object.entries(selectedRequest.submissionData);
                                    entries.sort(([keyA], [keyB]) => {
                                      const a = orderedKeys.indexOf(keyA);
                                      const b = orderedKeys.indexOf(keyB);
                                      if (a === -1 && b === -1) return 0;
                                      if (a === -1) return 1;
                                      if (b === -1) return -1;
                                      return a - b;
                                    });

                                    return entries.map(([key, value]) => {
                                      const labels: Record<string, string> = {
                                        type: "نوع الطلب",
                                        delegatee_university_id: "الرقم الوظيفي للزميل",
                                        delegatee_name: "اسم الموظف المفوض (الزميل)",
                                        start_date: "تاريخ بداية التفويض",
                                        end_date: "تاريخ نهاية التفويض",
                                        reason: "سبب التفويض",
                                        delegated_types: "نماذج الطلبات المفوضة"
                                      }

                                      let displayValue = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
                                      if (key === 'type' && value === 'SYSTEM_DELEGATION') displayValue = "طلب تفويض نظامي"
                                      else if (key.includes('date') && typeof value === 'string') {
                                        try { displayValue = new Date(value).toLocaleDateString('ar-SA') } catch(e) {}
                                      } else if (key === 'delegated_types') {
                                        if (value === null) displayValue = "إدارة كافة الصلاحيات الحالية وأنواع الطلبات"
                                        else if (Array.isArray(value)) displayValue = `محدد (${value.length} نماذج)`
                                      }
                                      
                                      return (
                                      <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 border-b last:border-0 pb-2 last:pb-0">
                                        <span className="text-sm font-medium text-muted-foreground md:col-span-1">{labels[key] || key}:</span>
                                        <span className="text-sm font-semibold text-foreground md:col-span-2">{displayValue}</span>
                                      </div>
                                      )
                                    })
                                  })()
                                ) : (
                                  <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded border border-yellow-200"> لم يتم العثور على بيانات لهذا الطلب (بيانات فارغة)</p>
                                )}
                              </CardContent>
                            </Card>

                            {/* سجل النشاطات والتعليقات السابقة */}
                            {selectedRequestHistory.length > 0 && (
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <span>سجل الإجراءات والتعليقات السابقة</span>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="relative space-y-6 pr-4 border-r border-slate-200">
                                    {selectedRequestHistory.map((action: any) => (
                                      <div key={action.id} className="relative">
                                        <span className="absolute -right-[21px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-foreground">
                                              {action.action === 'created' ? 'تم إنشاء الطلب' :
                                               action.action === 'submitted' ? 'تم تقديم الطلب' :
                                               (action.action === 'approved' || action.action === 'approve') ? 'تمت الموافقة' :
                                               (action.action === 'rejected' || action.action === 'reject') ? 'تم الرفض' :
                                               (action.action === 'rejected_with_changes' || action.action === 'reject_with_changes') ? 'إعادة للتعديل' :
                                               action.action === 'returned' ? 'إعادة للتعديل' :
                                               action.action}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              - {new Date(action.timestamp).toLocaleDateString('ar-SA')} {new Date(action.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                          <p className="text-sm text-foreground/80">
                                            <span className="font-medium text-primary">{action.actorName}</span> ({translateRole(action.actorRole)})
                                          </p>
                                          {action.comment && (
                                            <div className="mt-1.5 p-2.5 bg-slate-50 rounded-lg text-xs text-muted-foreground border border-slate-100 whitespace-pre-wrap leading-relaxed">
                                              {action.comment}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {hasPermission('review_requests') && (
                              <Card>
                                <CardHeader>
                                  <CardTitle>إجراء على الطلب</CardTitle>
                                  <CardDescription>قم بالموافقة أو الرفض مع إضافة تعليق</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  <div className="space-y-6">
                                    {/* Internal Note */}
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        📝 ملاحظات إدارية (داخلية فقط)
                                      </Label>
                                      <Textarea
                                        placeholder="اكتب ملاحظات للموظف التالي أو للإدارة (لن تظهر لمقدم الطلب)..."
                                        value={internalNote}
                                        onChange={(e) => setInternalNote(e.target.value)}
                                        className="bg-slate-50 min-h-[80px] resize-none"
                                      />
                                    </div>

                                    {/* Attachment */}
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        📎 إرفاق ملف (اختياري)
                                      </Label>
                                      <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-md border border-input border-dashed">
                                        <Input
                                          type="file"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                              const reader = new FileReader()
                                              reader.onloadend = () => {
                                                setAttachment({ name: file.name, content: reader.result as string })
                                              }
                                              reader.readAsDataURL(file)
                                            } else {
                                              setAttachment(null)
                                            }
                                          }}
                                          className="text-right border-0 bg-transparent shadow-none p-0 h-auto"
                                        />
                                      </div>
                                      {attachment && (
                                        <p className="text-xs text-green-600 flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3" />
                                          تم اختيار: {attachment.name}
                                        </p>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-3 pt-6 border-t border-border mt-4">
                                      <Button
                                        onClick={() => openActionDialog('approve')}
                                        variant="outline"
                                        className="w-full h-12 text-base font-bold shadow-sm border-primary/30 text-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all"
                                      >
                                        <CheckCircle className="w-5 h-5 me-2" />
                                        موافقة على الطلب
                                      </Button>
                                      
                                      <div className="grid grid-cols-2 gap-3 w-full">
                                        <Button
                                          onClick={() => openActionDialog('reject_with_changes')}
                                          variant="outline"
                                          className="w-full h-11 border-orange-200 text-orange-600 bg-orange-50/50 hover:bg-orange-100 hover:text-orange-700 hover:border-orange-300 transition-all shadow-sm"
                                        >
                                          <Redo2 className="w-4 h-4 me-2" />
                                          إعادة للتعديل
                                        </Button>
                                        <Button
                                          onClick={() => openActionDialog('reject')}
                                          variant="outline"
                                          className="w-full h-11 border-red-200 text-red-600 bg-red-50/30 hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-all shadow-sm"
                                        >
                                          <XCircle className="w-4 h-4 me-2" />
                                          رفض نهائي
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground p-12">
                            اختر طلباً من القائمة لعرض تفاصيله
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                </>
              )}
            </>
          )}

          {/* History View */}
          {currentView === "history" && (() => {
            const filteredHistory = historyRequests.filter((item) => {
              if (!historySearchQuery) return true
              const query = historySearchQuery
              const knownStatuses = ['pending', 'approved', 'rejected', 'returned', 'processing']
              if (knownStatuses.includes(query)) {
                return item.status === query
              }
              const q = query.toLocaleLowerCase('ar')
              const statusMap: Record<string, string> = {
                pending: "قيد الانتظار",
                processing: "قيد المراجعة",
                approved: "موافق عليه",
                rejected: "مرفوض",
                returned: "معاد للتعديل",
              }
              const statusLabel = (statusMap[item.status] || "").toLocaleLowerCase('ar')
              return (
                item.requestId?.toString().includes(q) ||
                item.requestType?.toLocaleLowerCase('ar').includes(q) ||
                item.applicant?.toLocaleLowerCase('ar').includes(q) ||
                item.applicantId?.toLocaleLowerCase('ar').includes(q) ||
                item.comment?.toLocaleLowerCase('ar').includes(q) ||
                statusLabel.includes(q)
              )
            })

            return (
              <div className="p-2.5 sm:p-4 md:p-6 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <h2 className="text-base sm:text-xl font-bold">سجل الإجراءات ({filteredHistory.length})</h2>
                  <div className="relative w-full sm:w-64">
                    <Input
                      placeholder="بحث في السجل..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      className="h-8 sm:h-9 text-xs sm:text-sm pl-8 pr-3 bg-white border-slate-200 rounded-lg shadow-xs"
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {filteredHistory.length > 0 ? (
                  <>
                    {/* Mobile Card View (NO squished table!) */}
                    <div className="md:hidden space-y-2">
                      {filteredHistory.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleViewHistory(item.requestId)}
                          className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1.5 cursor-pointer hover:border-primary/40 active:scale-[0.99] transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-foreground truncate">{item.requestType}</span>
                            {getStatusBadge(item.status)}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <div className="flex items-center gap-1 truncate">
                              <span className="font-semibold text-foreground truncate">{item.applicant}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="font-mono text-muted-foreground text-[10px]">#{item.requestId}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                              {new Date(item.timestamp).toLocaleDateString('ar-SA')}
                            </span>
                          </div>
                          {item.comment && (
                            <p className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-md border border-slate-100 truncate">
                              {item.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-xs">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr className="text-right">
                            <th className="p-3 font-medium">رقم الطلب</th>
                            <th className="p-3 font-medium">نوع الطلب</th>
                            <th className="p-3 font-medium">مقدم الطلب</th>
                            <th className="p-3 font-medium">الرقم الوظيفي</th>
                            <th className="p-3 font-medium">التاريخ</th>
                            <th className="p-3 font-medium">ملاحظاتك</th>
                            <th className="p-3 font-medium">الحالة الحالية</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHistory.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                              onClick={() => handleViewHistory(item.requestId)}
                            >
                              <td className="p-3 font-mono">{item.requestId}</td>
                              <td className="p-3">{item.requestType}</td>
                              <td className="p-3">{item.applicant}</td>
                              <td className="p-3 font-mono">{item.applicantId}</td>
                              <td className="p-3">
                                {new Date(item.timestamp).toLocaleDateString('ar-SA')}
                                <span className="text-xs text-muted-foreground block text-right">
                                  {new Date(item.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="p-3 max-w-[200px] truncate" title={item.comment}>
                                <span className="text-primary hover:underline font-medium">عرض التفاصيل</span>
                              </td>
                              <td className="p-3">
                                {getStatusBadge(item.status)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon="📅"
                    title="السجل فارغ"
                    description="لم يتم العثور على أي إجراءات مسجلة."
                  />
                )}
              </div>
            )
          })()}

          {/* Submit Request View */}
          {currentView === "submit" && (
            <div className="p-2.5 sm:p-4 md:p-6 w-full space-y-3">
              {!selectedRequestType && !editingRequestId ? (
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-foreground">
                        إنشاء طلب جديد
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {availableForms.filter(f => f.label.toLowerCase().includes(formSearchQuery.toLowerCase())).length > 0 ? (
                      availableForms
                        .filter(f => f.label.toLowerCase().includes(formSearchQuery.toLowerCase()))
                        .map((form) => (
                          <div
                            key={form.id}
                            onClick={() => setSelectedRequestType(form.id)}
                            className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-primary/40 rounded-xl p-2.5 sm:p-3.5 cursor-pointer transition-all duration-150 shadow-xs flex items-center justify-between gap-2.5 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <h3 className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                {form.label}
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
                        <p className="text-xs opacity-70">جرب البحث بكلمات مختلفة</p>
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
                  requestType={selectedRequestType || myRequests.find(r => r.id === editingRequestId)?.formId || ""}
                  requestTypes={availableForms}
                  userId={userData.university_id}
                  onBack={() => {
                    setSelectedRequestType(null)
                    setEditingRequestId(null)
                    if (editingRequestId) setCurrentView("requests")
                  }}
                  onSubmit={() => {
                    setSelectedRequestType(null)
                    setEditingRequestId(null)
                    setCurrentView("requests")
                    fetchMyRequests()
                  }}
                  initialData={editingRequestId ? myRequests.find(r => r.id === editingRequestId)?.submissionData : undefined}
                  requestId={editingRequestId || undefined}
                  isEditing={!!editingRequestId}
                />
              )}
            </div>
          )}

          {/* Forms Management View */}
          {currentView === "forms" && hasPermission('manage_forms') && (
            <AdminFormsPage onBack={() => setCurrentView("requests")} currentUserId={userData.university_id} />
          )}

          {/* Workflows Management View */}
          {currentView === "workflows" && hasPermission('manage_workflows') && (
            <WorkflowsEditor onBack={() => setCurrentView("requests")} currentUserId={userData.university_id} />
          )}

          {/* Users Management View */}
          {currentView === "users" && (hasPermission('manage_users') || hasPermission('grant_delegations')) && (
            <AdminUsersPage
              onBack={() => setCurrentView("requests")}
              currentUserId={userData.university_id}
              canManageUsers={hasPermission('manage_users') || permissions.includes('all')}
              canDelegate={hasPermission('grant_delegations') || hasPermission('manage_users') || permissions.includes('all')}
            />
          )}

          {/* Departments Management View */}
          {currentView === "departments" && hasPermission('manage_departments') && (
            <AdminDepartmentsPage onBack={() => setCurrentView("requests")} currentUserId={userData.university_id} />
          )}

          {/* Reports View */}
          {currentView === "reports" && hasPermission('view_reports') && (
            <AdminReportsPage onBack={() => setCurrentView("requests")} />
          )}

          {/* Delegation View */}
          {currentView === "delegation" && (
            <div className="p-3 sm:p-6">
              <DelegationRequest userData={userData} />
            </div>
          )}

          {/* Settings View */}
          {currentView === "settings" && (
            <div className="p-3 sm:p-6 max-w-4xl">
              <h2 className="text-xl sm:text-2xl font-bold mb-4">الإعدادات</h2>
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
                    <p className="text-sm text-muted-foreground">الرقم الوظيفي</p>
                    <p className="font-medium">{userData.university_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الدور</p>
                    <Badge>{translateRole(userData.role)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Terms Management View */}
          {currentView === "terms" && hasPermission('manage_terms') && (
            <div className="p-6">
              <TermsManagement onBack={() => setCurrentView("requests")} currentUserId={userData.university_id} />
            </div>
          )}

          </main>
      </div>

      {/* Requester Interaction History Dialog */}
      <Dialog open={requesterHistoryDialog.open} onOpenChange={(open) => setRequesterHistoryDialog(prev => ({ ...prev, open }))}>
        <DialogContent dir="rtl" className="max-w-xl w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>سجل تعاملاتك السابقة</DialogTitle>
            <DialogDescription>
              الطلبات السابقة التي قمت بمعالجتها
            </DialogDescription>
          </DialogHeader>

          {/* Requester Bio Section */}
          {!requesterHistoryDialog.loading && requesterHistoryDialog.requesterBio && (
            <div className="bg-muted/50 p-4 rounded-lg mb-4 flex items-start gap-4 border">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {requesterHistoryDialog.requesterBio.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-foreground">{requesterHistoryDialog.requesterBio.name}</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>الرقم الوظيفي: {requesterHistoryDialog.requesterBio.university_id}</p>
                  {requesterHistoryDialog.requesterBio.phone && (
                    <p>رقم الجوال: <a href={`https://wa.me/${requesterHistoryDialog.requesterBio.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1" dir="ltr">{requesterHistoryDialog.requesterBio.phone}</a></p>
                  )}
                  {requesterHistoryDialog.requesterBio.email && (
                    <p>البريد الإلكتروني: <a href={`mailto:${requesterHistoryDialog.requesterBio.email}`} className="text-primary hover:underline inline-flex items-center gap-1" dir="ltr">{requesterHistoryDialog.requesterBio.email}</a></p>
                  )}
                  {(requesterHistoryDialog.requesterBio.college || requesterHistoryDialog.requesterBio.department) && (
                    <p className="flex items-center gap-1">
                      {requesterHistoryDialog.requesterBio.college}
                      {requesterHistoryDialog.requesterBio.college && requesterHistoryDialog.requesterBio.department ? " - " : ""}
                      {requesterHistoryDialog.requesterBio.department}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Date \u0026 Text Filter Section */}
          {!requesterHistoryDialog.loading && (
            <div className="flex flex-wrap items-center gap-2 mb-4 bg-orange-50/50 p-2 rounded-lg border border-orange-100">
              {/* Text Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-2.5 top-2 h-4 w-4 text-orange-400" />
                <Input 
                  id="history-search" 
                  placeholder="بحث عن طلب، رقم، ملاحظة..."
                  className="h-8 bg-white border-orange-200 focus-visible:ring-orange-500 pr-8 text-xs"
                  value={requesterHistoryDialog.textSearch} 
                  onChange={(e) => setRequesterHistoryDialog(prev => ({ ...prev, textSearch: e.target.value }))} 
                />
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-orange-800">من:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-8 w-[135px] text-xs px-2 py-1 bg-white border-orange-200 focus:ring-orange-500 rounded-md justify-start text-right font-normal text-muted-foreground"
                      >
                        <CalendarIcon className="ml-1 h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        {requesterHistoryDialog.startDate ? (
                          format(new Date(requesterHistoryDialog.startDate), "PPP", { locale: arSA })
                        ) : (
                          <span>البداية...</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={requesterHistoryDialog.startDate ? new Date(requesterHistoryDialog.startDate) : undefined}
                        onSelect={(date) => setRequesterHistoryDialog(prev => ({ ...prev, startDate: date ? format(date, "yyyy-MM-dd") : null }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-orange-800">إلى:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-8 w-[135px] text-xs px-2 py-1 bg-white border-orange-200 focus:ring-orange-500 rounded-md justify-start text-right font-normal text-muted-foreground"
                      >
                        <CalendarIcon className="ml-1 h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        {requesterHistoryDialog.endDate ? (
                          format(new Date(requesterHistoryDialog.endDate), "PPP", { locale: arSA })
                        ) : (
                          <span>النهاية...</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={requesterHistoryDialog.endDate ? new Date(requesterHistoryDialog.endDate) : undefined}
                        onSelect={(date) => setRequesterHistoryDialog(prev => ({ ...prev, endDate: date ? format(date, "yyyy-MM-dd") : null }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {(requesterHistoryDialog.startDate || requesterHistoryDialog.endDate || requesterHistoryDialog.textSearch) && (
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => setRequesterHistoryDialog(prev => ({ ...prev, startDate: null, endDate: null, textSearch: "" }))}
                    className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                    title="مسح الفلاتر"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Terms Filters */}
          {!requesterHistoryDialog.loading && terms && terms.length > 0 && (
            <div className="mb-4 bg-orange-50/50 p-3 rounded-lg border border-orange-100/50">
              <h4 className="text-xs font-semibold text-orange-800 mb-2">تصفية حسب الفترة التشغيلية:</h4>
              <div className="flex flex-wrap gap-2">
                {terms.map(term => {
                  const isSelected = requesterHistoryDialog.selectedTerms.includes(term.term_id)
                  return (
                    <button
                      key={term.term_id}
                      onClick={() => {
                        setRequesterHistoryDialog(prev => {
                          const newTerms = isSelected
                            ? prev.selectedTerms.filter(id => id !== term.term_id)
                            : [...prev.selectedTerms, term.term_id]
                          return { ...prev, selectedTerms: newTerms }
                        })
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500/50 ${
                        isSelected 
                          ? 'bg-orange-100 text-orange-800 border-orange-300 shadow-sm font-semibold' 
                          : 'bg-white text-slate-600 border-orange-200 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {term.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {requesterHistoryDialog.loading ? (
              <ListSkeleton />
            ) : requesterHistoryDialog.data.length > 0 ? (
              (() => {
                const filteredData = requesterHistoryDialog.data.filter((item) => {
                  let keep = true;
                  // Use Date objects to avoid lexicographic comparison issues with non-ISO date formats
                  const itemDate = item.date ? new Date(item.date).getTime() : null
                  if (requesterHistoryDialog.startDate && itemDate) {
                    if (itemDate < new Date(requesterHistoryDialog.startDate).getTime()) keep = false;
                  }
                  if (requesterHistoryDialog.endDate && itemDate) {
                    if (itemDate > new Date(requesterHistoryDialog.endDate).getTime()) keep = false;
                  }
                  if (requesterHistoryDialog.textSearch) {
                    const query = requesterHistoryDialog.textSearch.toLowerCase();
                    const statusMap: Record<string, string> = {
                      pending: "قيد الانتظار",
                      processing: "قيد المراجعة",
                      approved: "موافق عليه",
                      rejected: "مرفوض",
                      returned: "معاد للتعديل",
                    }
                    const statusLabel = statusMap[item.originalStatus] || ""
                    const actionLabel = item.action === "reject" ? "مرفوض" :
                                        item.action === "approve_with_changes" ? "موافقة بتعديلات" :
                                        item.action === "reject_with_changes" ? "إعادة للتعديل" : 
                                        item.action === "approve" ? "موافق عليه" : item.action;

                    if (!(
                      (item.requestId && item.requestId.toString().includes(query)) ||
                      (item.requestType && item.requestType.toLowerCase().includes(query)) ||
                      (item.comment && item.comment.toLowerCase().includes(query)) ||
                      statusLabel.includes(query) ||
                      (actionLabel && actionLabel.includes(query))
                    )) {
                      keep = false;
                    }
                  }
                  
                  if (requesterHistoryDialog.selectedTerms.length > 0) {
                    if (!item.term_id || !requesterHistoryDialog.selectedTerms.includes(item.term_id)) keep = false;
                  }

                  return keep;
                });

                if (filteredData.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا توجد طلبات في هذا النطاق الزمني</p>
                    </div>
                  );
                }

                return (
              <>
                {requesterHistoryDialog.selectedRequestType === null ? (
                  // Statistics View
                  <div className="space-y-2">
                    <h3 className="font-semibold text-base mb-1">إحصائيات الطلبات</h3>
                    {(() => {
                      // Calculate grouped stats
                      const groupedStats = filteredData.reduce((acc, item) => {
                        const type = item.requestType || "General";
                        if (!acc[type]) {
                          acc[type] = { total: 0, approved: 0, rejected: 0, returned: 0, pending: 0 };
                        }
                        acc[type].total++;
                        
                        // Let's use the final status as well if present, otherwise action
                        const statusOrAction = item.action;
                        if (statusOrAction === "approve" || statusOrAction === "approve_with_changes") {
                          acc[type].approved++;
                        } else if (statusOrAction === "reject") {
                          acc[type].rejected++;
                        } else if (statusOrAction === "reject_with_changes") {
                          acc[type].returned++;
                        } else {
                          acc[type].pending++;
                        }
                        return acc;
                      }, {} as Record<string, { total: number, approved: number, rejected: number, returned: number, pending: number }>);

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                          {(Object.entries(groupedStats) as [string, any][]).map(([type, stats]) => (
                            <div
                              key={type}
                              className="p-2.5 border rounded-xl bg-card hover:bg-muted/30 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
                              onClick={() => setRequesterHistoryDialog(prev => ({ ...prev, selectedRequestType: type }))}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-base flex-1 line-clamp-2 leading-snug">
                                  {type}
                                </h4>
                                <div className="flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap ml-1 shrink-0">
                                  <span>الكل:</span>
                                  <span className="font-bold">{stats.total}</span>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-1 mt-auto">
                                <div className="flex flex-col items-center justify-center p-1 rounded-md bg-green-500/10 text-green-700">
                                  <span className="font-bold text-sm leading-none mb-1">{stats.approved}</span>
                                  <span className="text-[9px] font-medium text-center leading-none">موافق</span>
                                </div>
                                <div className="flex flex-col items-center justify-center p-1 rounded-md bg-red-500/10 text-red-700">
                                  <span className="font-bold text-sm leading-none mb-1">{stats.rejected}</span>
                                  <span className="text-[9px] font-medium text-center leading-none">مرفوض</span>
                                </div>
                                <div className="flex flex-col items-center justify-center p-1 rounded-md bg-blue-500/10 text-blue-700">
                                  <span className="font-bold text-sm leading-none mb-1">{stats.returned}</span>
                                  <span className="text-[9px] font-medium text-center leading-none">تعديل</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  // Detailed List View
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setRequesterHistoryDialog(prev => ({ ...prev, selectedRequestType: null }))}
                          className="flex items-center gap-1.5 border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 hover:text-orange-700 hover:border-orange-300 transition-all font-medium"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                          رجوع
                        </Button>
                        <h3 className="font-semibold text-lg">{requesterHistoryDialog.selectedRequestType}</h3>
                      </div>
                      <Badge variant="outline" className="font-normal text-xs">
                        {filteredData.filter(item => item.requestType === requesterHistoryDialog.selectedRequestType).length} طلبات
                      </Badge>
                    </div>

                    {filteredData
                      .filter((item) => item.requestType === requesterHistoryDialog.selectedRequestType)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="p-2 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
                          onClick={() => {
                            handleViewHistory(item.requestId)
                          }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs block">{item.requestType}</span>
                              <span className="text-[10px] text-muted-foreground mr-1">#{item.requestId}</span>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          <div className="flex justify-between items-center mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${item.action === "approve" ? "bg-green-100 text-green-800" :
                              item.action === "reject" ? "bg-red-100 text-red-800" :
                                "bg-blue-100 text-blue-800"
                              }`}>
                              {item.action === "approve" ? "تمت الموافقة" :
                                item.action === "reject" ? "تم الرفض" :
                                  item.action === "approve_with_changes" ? "موافقة بتعديلات" :
                                    item.action === "reject_with_changes" ? "إعادة للتعديل" : item.action}
                            </span>
                            <span className="text-[10px] text-muted-foreground dir-ltr">
                              {item.date}
                            </span>
                          </div>
                        </div>
                    ))}
                  </div>
                )}
              </>
                );
              })()
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>لا يوجد سجل تعاملات سابق لك مع هذا المستخدم</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RequestActionDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}
        type={actionDialog.type as ActionType}
        requestId={selectedRequest?.id}
        onConfirm={executeAction}
        isProcessing={isProcessing}
      />

      {/* History Item Detail Dialog */}
      <Dialog open={!!selectedHistoryItem} onOpenChange={(open) => !open && setSelectedHistoryItem(null)}>
        <DialogContent className="sm:max-w-2xl w-[95vw] md:w-full z-[100] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب (من السجل)</DialogTitle>
          </DialogHeader>
          <div className="p-1">
            {historyLoading ? (
              <div className="p-4 space-y-4">
                <div className="h-4 bg-muted animate-pulse rounded w-1/4"></div>
                <div className="h-32 bg-muted animate-pulse rounded"></div>
              </div>
            ) : selectedHistoryItem && selectedHistoryItem !== true ? (
              <div className="mt-4">
                <RequestDetail
                  request={selectedHistoryItem}
                  showHistory={true}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <FilePreviewDialog
        open={!!filePreview?.open}
        onOpenChange={(open) => !open && setFilePreview(null)}
        file={filePreview}
      />

    </div>
  )
}


