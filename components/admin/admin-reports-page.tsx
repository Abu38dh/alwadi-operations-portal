"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowRight, TrendingUp, Users, FileText, CheckCircle, XCircle, Clock, Download, Search, Calendar as CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { arSA } from "date-fns/locale"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import { Input } from "@/components/ui/input"
import { getReportsData, getAuditLog } from "@/app/actions/admin"
import { getAbsencesReportData } from "@/app/actions/reports"
import RequestDetail from "@/components/request-detail"
import { Loader2 } from "lucide-react"

interface AdminReportsPageProps {
  onBack: () => void
  currentUserId?: string
}

function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "").replace(/"/g, '""')
    return `"${s}"`
  }
  // Use tab as delimiter for better compatibility with UTF-16LE in Excel
  const content = [headers.map(escape), ...rows.map(r => r.map(escape))].map(r => r.join("\t")).join("\r\n")
  
  // Create UTF-16LE array with BOM
  const buffer = new ArrayBuffer(content.length * 2 + 2);
  const view = new Uint16Array(buffer);
  view[0] = 0xFEFF; // BOM
  for (let i = 0; i < content.length; i++) {
    view[i + 1] = content.charCodeAt(i);
  }
  
  const blob = new Blob([view], { type: "text/csv;charset=utf-16le;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
// ────────────────────────────────────────────────────────────────────────────

export default function AdminReportsPage({ onBack, currentUserId }: AdminReportsPageProps) {
  const [reports, setReports] = useState<any>(null)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statDialog, setStatDialog] = useState<{ open: boolean; filter: string | null; title: string }>({ open: false, filter: null, title: '' })
  const [isExportingAbsences, setIsExportingAbsences] = useState(false)

  const [statSearchQuery, setStatSearchQuery] = useState("")
  const [statStartDate, setStatStartDate] = useState("")
  const [statEndDate, setStatEndDate] = useState("")
  const [selectedRequestData, setSelectedRequestData] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)

  useEffect(() => {
    if (!statDialog.open) {
      setStatSearchQuery("")
      setStatStartDate("")
      setStatEndDate("")
      setSelectedRequestData(null)
      setLoadingDetails(false)
    }
  }, [statDialog.open])

  useEffect(() => {
    fetchData()
  }, [currentUserId])

  const fetchData = async () => {
    setError(null)

    try {
      const [reportsResult, auditResult] = await Promise.all([
        getReportsData(undefined, undefined, currentUserId),
        getAuditLog({ requesterId: currentUserId })
      ])

      if (reportsResult.success && reportsResult.data) {
        setReports(reportsResult.data)
      } else {
        setError(reportsResult.error || "فشل في تحميل التقارير")
      }

      if (auditResult.success && auditResult.data) {
        setAuditLog(auditResult.data)
      }
    } catch (err) {
      console.error("Failed to fetch data:", err)
      setError("حدث خطأ في الاتصال بقاعدة البيانات")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">التقارير والإحصائيات</h1>
        </div>
        <TableSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">التقارير والإحصائيات</h1>
        </div>
        <ErrorMessage error={error} onRetry={fetchData} />
      </div>
    )
  }

  const stats = reports?.stats || {}
  const byStatus = reports?.byStatus || []
  const byType = reports?.byType || []
  const recent = reports?.recentRequests || []

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">التقارير والإحصائيات</h1>
          <p className="text-sm text-muted-foreground mt-1">تحليلات شاملة للنظام</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const rows = recent.map((r: any) => [
                r.reference_no || "",
                r.requester?.full_name || "غير محدد",
                r.form_templates?.name || "غير محدد",
                r.status === 'approved' ? 'موافق عليه' :
                  r.status === 'rejected' ? 'مرفوض' :
                  r.status === 'pending' ? 'قيد المراجعة' :
                  r.status === 'returned' ? 'معاد للتعديل' : r.status,
                r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('ar-SA') : ""
              ])
              exportToCSV(
                `تقرير-الطلبات-${new Date().toLocaleDateString('ar-SA').replace(/\//g,'-')}.csv`,
                ["رقم المرجع", "مقدم الطلب", "نوع الطلب", "الحالة", "تاريخ التقديم"],
                rows
              )
            }}
          >
            <Download className="w-4 h-4" />
            تصدير الطلبات
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const rows = auditLog.map((log: any) => [
                log.users?.full_name || "النظام",
                log.action === 'approve' ? 'موافقة' :
                  log.action === 'reject' ? 'رفض' :
                  log.action === 'reject_with_changes' ? 'إعادة للمراجعة' :
                  log.action === 'approve_with_changes' ? 'موافقة مع ملاحظات' :
                  log.action === 'submit' ? 'تقديم طلب' : log.action,
                log.requests?.form_templates?.name || "طلب عام",
                log.comment || "",
                log.created_at ? new Date(log.created_at).toLocaleString('ar-SA') : ""
              ])
              exportToCSV(
                `سجل-الأحداث-${new Date().toLocaleDateString('ar-SA').replace(/\//g,'-')}.csv`,
                ["المستخدم", "الإجراء", "نوع الطلب", "الملاحظات", "التاريخ والوقت"],
                rows
              )
            }}
          >
            <Download className="w-4 h-4" />
            تصدير السجل
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isExportingAbsences}
            onClick={async () => {
              setIsExportingAbsences(true)
              try {
                const res = await getAbsencesReportData()
                if (res.success && res.data) {
                  const rows = res.data.map((a: any) => [
                    a.university_id,
                    a.full_name,
                    a.department,
                    a.level,
                    a.term,
                    a.subject,
                    a.total_absences,
                    a.excused_count,
                    a.unexcused_count
                  ])
                  exportToCSV(
                    `تقرير-الحضور-والإجازات-${new Date().toLocaleDateString('ar-SA').replace(/\//g,'-')}.csv`,
                    ["الرقم الوظيفي", "الاسم", "القسم / الإدارة", "المسمى الوظيفي", "الفترة", "البيان", "إجمالي الرصيد", "معتمد", "قيد الإجراء"],
                    rows
                  )
                }
              } catch (e) {
                console.error(e)
              } finally {
                setIsExportingAbsences(false)
              }
            }}
          >
            {isExportingAbsences ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            تصدير سجل الإجازات
          </Button>

        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all" onClick={() => setStatDialog({ open: true, filter: null, title: 'إجمالي الطلبات' })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md hover:border-yellow-400/50 transition-all" onClick={() => setStatDialog({ open: true, filter: 'pending', title: 'قيد المراجعة' })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">قيد المراجعة</CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md hover:border-green-400/50 transition-all" onClick={() => setStatDialog({ open: true, filter: 'approved', title: 'تمت الموافقة' })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">تمت الموافقة</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved || 0}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md hover:border-orange-400/50 transition-all" onClick={() => setStatDialog({ open: true, filter: 'returned', title: 'معاد للتعديل' })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">معاد للتعديل</CardTitle>
            <ArrowRight className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{byStatus.find((s: any) => s.status === 'returned')?.count || 0}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md hover:border-red-400/50 transition-all" onClick={() => setStatDialog({ open: true, filter: 'rejected', title: 'مرفوضة' })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">مرفوضة</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stat Filter Dialog */}
      <Dialog open={statDialog.open} onOpenChange={(open) => setStatDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto flex flex-col" dir="rtl">
          {!selectedRequestData && !loadingDetails && (
            <DialogHeader className="shrink-0">
              <DialogTitle>الطلبات — {statDialog.title}</DialogTitle>
            </DialogHeader>
          )}

          {loadingDetails ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
              <p className="text-sm text-muted-foreground">جاري تحميل تفاصيل الطلب...</p>
            </div>
          ) : selectedRequestData ? (
             <div className="flex flex-col h-full bg-slate-50/50 p-2 md:p-4 rounded-lg">
                <Button variant="outline" className="mb-4 self-start bg-white" onClick={() => setSelectedRequestData(null)}>
                  &rarr; عودة للقائمة
                </Button>
                <RequestDetail 
                  request={selectedRequestData} 
                  onBack={() => setSelectedRequestData(null)} 
                  userId={currentUserId || ""} 
                  showHistory={true} 
                />
             </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row items-center gap-3 mt-4 shrink-0 bg-orange-50/50 border border-orange-200 p-2 rounded-2xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-500" />
              <Input
                placeholder="بحث عن طلب، رقم، ملاحظة..."
                className="pr-10 h-10 border-orange-200 focus-visible:ring-orange-500 rounded-xl bg-white text-sm"
                value={statSearchQuery}
                onChange={(e) => setStatSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-orange-800 font-medium text-sm">من:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[160px] h-10 border-orange-200 focus:ring-orange-500 rounded-xl bg-white text-sm justify-start text-right font-normal text-muted-foreground px-3"
                  >
                    <CalendarIcon className="ml-2 h-4 w-4 text-orange-500 flex-shrink-0" />
                    {statStartDate ? (
                      format(new Date(statStartDate), "PPP", { locale: arSA })
                    ) : (
                      <span>تاريخ البداية...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={statStartDate ? new Date(statStartDate) : undefined}
                    onSelect={(date) => setStatStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-orange-800 font-medium text-sm">إلى:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[160px] h-10 border-orange-200 focus:ring-orange-500 rounded-xl bg-white text-sm justify-start text-right font-normal text-muted-foreground px-3"
                  >
                    <CalendarIcon className="ml-2 h-4 w-4 text-orange-500 flex-shrink-0" />
                    {statEndDate ? (
                      format(new Date(statEndDate), "PPP", { locale: arSA })
                    ) : (
                      <span>تاريخ النهاية...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={statEndDate ? new Date(statEndDate) : undefined}
                    onSelect={(date) => setStatEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2 mt-4 flex-1 overflow-y-auto pr-1">
            {(() => {
              let filtered = statDialog.filter ? recent.filter((r: any) => r.status === statDialog.filter) : recent;
              
              if (statSearchQuery) {
                const q = statSearchQuery.toLocaleLowerCase('ar');
                filtered = filtered.filter((r: any) => 
                  r.request_id?.toString().includes(q) ||
                  r.requester?.full_name?.toLocaleLowerCase('ar').includes(q) ||
                  r.form_templates?.name?.toLocaleLowerCase('ar').includes(q)
                )
              }
              
              if (statStartDate) {
                const start = new Date(statStartDate);
                start.setHours(0, 0, 0, 0);
                filtered = filtered.filter((r: any) => new Date(r.submitted_at) >= start);
              }
              
              if (statEndDate) {
                const end = new Date(statEndDate);
                end.setHours(23, 59, 59, 999);
                filtered = filtered.filter((r: any) => new Date(r.submitted_at) <= end);
              }

              if (filtered.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                    لا توجد طلبات تطابق بحثك بهذه الحالة
                  </p>
                )
              }

              const handleViewRequest = async (requestId: number) => {
                  setLoadingDetails(true)
                  try {
                      const { getRequestDetail } = await import("@/app/actions/student")
                      const result = await getRequestDetail(requestId, currentUserId || "")
                      if (result.success && result.data) {
                          setSelectedRequestData(result.data)
                      } else {
                          console.error("Failed to load request details:", result.error)
                      }
                  } catch (e) {
                      console.error("Error fetching request:", e)
                  } finally {
                      setLoadingDetails(false)
                  }
              }

              return filtered.map((request: any) => {
                const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
                  approved:  { label: 'موافق عليه',      cls: 'bg-green-100 text-green-700' },
                  rejected:  { label: 'مرفوض',            cls: 'bg-red-100 text-red-700' },
                  returned:  { label: 'معاد للتعديل',     cls: 'bg-orange-100 text-orange-700' },
                  pending:   { label: 'قيد المراجعة',     cls: 'bg-yellow-100 text-yellow-700' },
                  processing:{ label: 'قيد المعالجة',     cls: 'bg-blue-100 text-blue-700' },
                }
                const st = STATUS_LABELS[request.status] || { label: request.status, cls: 'bg-gray-100 text-gray-700' }
                return (
                  <div 
                    key={request.request_id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleViewRequest(request.request_id)}
                  >
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">
                        <span>{request.requester?.full_name || 'غير محدد'}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">#{request.request_id}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {request.form_templates?.name || 'غير محدد'} • {new Date(request.submitted_at).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                )
              })
            })()}
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle>التوزيع حسب الحالة</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const STATUS_ORDER = ['pending', 'processing', 'in_progress', 'approved', 'returned', 'rejected']
              const STATUS_MAP: Record<string, { label: string; color: string }> = {
                pending:     { label: 'قيد الانتظار',    color: 'bg-yellow-500' },
                processing:  { label: 'قيد المراجعة',    color: 'bg-blue-500' },
                in_progress: { label: 'قيد التنفيذ',     color: 'bg-cyan-500' },
                approved:    { label: 'موافق عليها',     color: 'bg-green-500' },
                returned:    { label: 'معادة للتعديل',   color: 'bg-orange-500' },
                rejected:    { label: 'مرفوضة',          color: 'bg-red-500' },
              }
              const sorted = [...byStatus].sort((a: any, b: any) => {
                const ai = STATUS_ORDER.indexOf(a.status)
                const bi = STATUS_ORDER.indexOf(b.status)
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
              })
              return (
                <div className="space-y-3">
                  {sorted.map((item: any) => {
                    const cfg = STATUS_MAP[item.status] || { label: item.status, color: 'bg-gray-500' }
                    return (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${cfg.color}`} />
                          <span className="text-sm">{cfg.label}</span>
                        </div>
                        <span className="text-sm font-medium">{item.count}</span>
                      </div>
                    )
                  })}
                  {byStatus.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
                  )}
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader>
            <CardTitle>التوزيع حسب النوع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byType.map((item: any) => (
                <div key={item.type_name} className="flex items-center justify-between">
                  <span className="text-sm">{item.type_name}</span>
                  <span className="text-sm font-medium">{item.count}</span>
                </div>
              ))}
              {byType.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle>الطلبات الأخيرة</CardTitle>
          <CardDescription>آخر 10 طلبات تم تقديمها</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recent.map((request: any) => (
              <div key={request.request_id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{request.requester?.full_name || "غير محدد"}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.form_templates?.name || "غير محدد"} • {new Date(request.submitted_at).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  request.status === 'approved' ? 'bg-green-100 text-green-700' :
                  request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  request.status === 'returned' ? 'bg-orange-100 text-orange-700' :
                  request.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {request.status === 'approved' ? 'موافق عليه' :
                   request.status === 'rejected' ? 'مرفوض' :
                   request.status === 'returned' ? 'معاد للتعديل' :
                   request.status === 'pending'  ? 'قيد المراجعة' :
                   request.status === 'processing' ? 'قيد المعالجة' :
                   request.status}
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد طلبات حديثة</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle>سجل الأحداث</CardTitle>
          <CardDescription>آخر الإجراءات في النظام</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {auditLog.slice(0, 20).map((log: any) => {
              const getActionDetails = (action: string) => {
                switch (action) {
                  case 'approve': return { text: 'تمت الموافقة', color: 'text-green-600', bg: 'bg-green-100' }
                  case 'reject': return { text: 'تم الرفض', color: 'text-red-600', bg: 'bg-red-100' }
                  case 'reject_with_changes': return { text: 'إعادة للمراجعة', color: 'text-orange-600', bg: 'bg-orange-100' }
                  case 'approve_with_changes': return { text: 'موافقة مع ملاحظات', color: 'text-yellow-600', bg: 'bg-yellow-100' }
                  case 'submit': return { text: 'تقديم طلب جديد', color: 'text-blue-600', bg: 'bg-blue-100' }
                  default: return { text: action, color: 'text-gray-600', bg: 'bg-gray-100' }
                }
              }

              const details = getActionDetails(log.action)
              const formName = log.requests?.form_templates?.name || "طلب عام"

              return (
                <div key={log.action_id || log.log_id || Math.random()} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`p-2 rounded-full ${details.bg} mt-1`}>
                    <div className={`w-2 h-2 rounded-full ${details.color.replace('text', 'bg')}`} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-gray-900">{details.text} على {formName}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                        {new Date(log.created_at).toLocaleString('ar-SA')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      قام <span className="font-medium text-gray-900">{log.users?.full_name || "النظام"}</span> بهذا الإجراء
                      {log.comment && (
                        <span className="block mt-1 text-xs bg-gray-50 p-2 rounded text-gray-500 italic">
                          "{log.comment}"
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
            {auditLog.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد أحداث مسجلة</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


