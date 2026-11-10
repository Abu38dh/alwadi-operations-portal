"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowRight, Users, CheckCircle, XCircle, RotateCcw, Clock, TrendingUp, RefreshCw, Download } from "lucide-react"
import { getAllEmployeesKPIs } from "@/app/actions/reports"
import { getAllTerms } from "@/app/actions/terms"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { translateRole } from "@/lib/translations"

interface EmployeeKpiDashboardProps {
  onBack: () => void
  currentUserId?: string
}

interface KpiRow {
  id: number
  universityId: string
  name: string
  role: string
  totalReceived: number
  approved: number
  rejected: number
  returned: number
  totalProcessed: number
  dailyInRate: number
  dailyProcessed: number
  avgResolutionHours: number | null
}

function formatHours(hours: number | null): string {
  if (hours === null) return "—"
  if (hours < 1) return `${Math.round(hours * 60)} دقيقة`
  if (hours < 24) return `${hours.toFixed(1)} ساعة`
  const days = hours / 24
  return `${days.toFixed(1)} يوم`
}

function exportToCSV(rows: KpiRow[]) {
  const headers = ["الاسم", "الرقم الوظيفي", "الدور", "إجمالي المستلمة", "المقبولة", "المرفوضة", "المعادة", "إجمالي المعالجة", "معدل الوارد/يوم", "معدل المعالجة/يوم", "متوسط سرعة الإنجاز"]
  const escape = (v: string | number) => {
    const s = String(v ?? "").replace(/"/g, '""')
    return `"${s}"`
  }
  const csvRows = rows.map(r => [
    r.name,
    r.universityId,
    r.role,
    r.totalReceived,
    r.approved,
    r.rejected,
    r.returned,
    r.totalProcessed,
    r.dailyInRate,
    r.dailyProcessed,
    formatHours(r.avgResolutionHours)
  ].map(escape).join("\t"))
  
  const content = [headers.map(escape).join("\t"), ...csvRows].join("\r\n")

  // Create UTF-16LE array with BOM for Excel compatibility
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
  a.download = `تقرير-أداء-الموظفين-${new Date().toLocaleDateString("ar-SA").replace(/\//g, "-")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function EmployeeKpiDashboard({ onBack, currentUserId }: EmployeeKpiDashboardProps) {
  const [kpis, setKpis] = useState<KpiRow[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [selectedTermId, setSelectedTermId] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const termsResult = await getAllTerms()
      if (termsResult.success && termsResult.data) {
        setTerms(termsResult.data as any[])
      }
      await fetchKpis(undefined, false)
    }
    init()
  }, [])

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchKpis(selectedTermId, true)
      }
    }, 5000)
    return () => clearInterval(intervalId)
  }, [selectedTermId])

  const fetchKpis = async (termId?: number, silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    const result = await getAllEmployeesKPIs(termId)
    if (result.success && result.data) {
      setKpis(result.data as KpiRow[])
    } else {
      setError(result.error || "فشل في تحميل البيانات")
    }
    if (!silent) setLoading(false)
  }

  const handleTermChange = (termId?: number) => {
    setSelectedTermId(termId)
    fetchKpis(termId, false)
  }

  // Summary stats
  const totalReceivedAll = kpis.reduce((s, k) => s + k.totalReceived, 0)
  const totalApprovedAll = kpis.reduce((s, k) => s + k.approved, 0)
  const totalRejectedAll = kpis.reduce((s, k) => s + k.rejected, 0)
  const totalReturnedAll = kpis.reduce((s, k) => s + k.returned, 0)

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-bold">تقارير أداء الموظفين</h1>
          </div>
          <p className="text-muted-foreground text-sm">إحصائيات تفصيلية لإنتاجية كل موظف في معالجة الطلبات</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select
            value={selectedTermId?.toString() ?? "__all__"}
            onValueChange={val => handleTermChange(val === "__all__" ? undefined : Number(val))}
            dir="rtl"
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="اختر الترم" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="__all__">كل الأترام</SelectItem>
              {terms.map((t: any) => (
                <SelectItem key={t.term_id} value={t.term_id.toString()}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {kpis.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(kpis)}>
              <Download className="w-4 h-4" />
              تصدير CSV
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المستلمة</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalReceivedAll}</div>
            <p className="text-xs text-muted-foreground mt-1">موزعة على {kpis.length} موظف</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المقبولة</CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{totalApprovedAll}</div>
            <p className="text-xs text-muted-foreground mt-1">نسبة القبول {totalReceivedAll > 0 ? Math.round(totalApprovedAll / totalReceivedAll * 100) : 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المرفوضة</CardTitle>
            <XCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{totalRejectedAll}</div>
            <p className="text-xs text-muted-foreground mt-1">نسبة الرفض {totalReceivedAll > 0 ? Math.round(totalRejectedAll / totalReceivedAll * 100) : 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المعادة للتعديل</CardTitle>
            <RotateCcw className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{totalReturnedAll}</div>
            <p className="text-xs text-muted-foreground mt-1">طلبت إعادة تقديمها</p>
          </CardContent>
        </Card>
      </div>

      {/* Main table */}
      <Card>
        <CardHeader>
          <CardTitle>تفاصيل أداء الموظفين</CardTitle>
          <CardDescription>
            {selectedTermId
              ? `إحصائيات الترم: ${terms.find((t: any) => t.term_id === selectedTermId)?.name || ""}`
              : "إحصائيات إجمالية لجميع الأترام (آخر 30 يوم)"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="text-red-500 text-sm py-4 text-center">{error}</div>
          ) : kpis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">لا توجد بيانات أداء بعد</p>
              <p className="text-sm mt-1">ستظهر البيانات عند معالجة الموظفين للطلبات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-right pb-3 pr-2 font-semibold">الموظف</th>
                    <th className="text-center pb-3 font-semibold">المستلمة</th>
                    <th className="text-center pb-3 font-semibold text-emerald-700">المقبولة</th>
                    <th className="text-center pb-3 font-semibold text-red-600">المرفوضة</th>
                    <th className="text-center pb-3 font-semibold text-orange-600">المعادة</th>
                    <th className="text-center pb-3 font-semibold">معدل وارد/يوم</th>
                    <th className="text-center pb-3 font-semibold">معدل إنجاز/يوم</th>
                    <th className="text-center pb-3 font-semibold">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        متوسط الإنجاز
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {kpis
                    .sort((a, b) => b.totalProcessed - a.totalProcessed)
                    .map(kpi => {
                      const processRate = kpi.dailyInRate > 0
                        ? Math.min(100, Math.round((kpi.dailyProcessed / kpi.dailyInRate) * 100))
                        : (kpi.dailyProcessed > 0 ? 100 : 0)
                      return (
                        <tr key={kpi.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-2">
                            <div>
                              <p className="font-semibold text-foreground">{kpi.name}</p>
                              <p className="text-xs text-muted-foreground">{kpi.universityId} • {translateRole(kpi.role)}</p>
                            </div>
                          </td>
                          <td className="text-center py-3 font-bold text-lg">{kpi.totalReceived}</td>
                          <td className="text-center py-3">
                            <span className="inline-block bg-emerald-100 text-emerald-700 rounded-lg px-3 py-1 font-semibold">
                              {kpi.approved}
                            </span>
                          </td>
                          <td className="text-center py-3">
                            <span className="inline-block bg-red-100 text-red-700 rounded-lg px-3 py-1 font-semibold">
                              {kpi.rejected}
                            </span>
                          </td>
                          <td className="text-center py-3">
                            <span className="inline-block bg-orange-100 text-orange-700 rounded-lg px-3 py-1 font-semibold">
                              {kpi.returned}
                            </span>
                          </td>
                          <td className="text-center py-3 text-muted-foreground">{kpi.dailyInRate}</td>
                          <td className="text-center py-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-muted-foreground">{kpi.dailyProcessed}</span>
                              <div className="w-20 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="bg-primary h-1.5 rounded-full"
                                  style={{ width: `${Math.min(processRate, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{processRate}%</span>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <span className={`font-medium ${
                              kpi.avgResolutionHours === null ? "text-muted-foreground" :
                              kpi.avgResolutionHours < 24 ? "text-emerald-600" :
                              kpi.avgResolutionHours < 72 ? "text-yellow-600" : "text-red-600"
                            }`}>
                              {formatHours(kpi.avgResolutionHours)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-4 space-y-1">
        <p className="font-semibold mb-2">ملاحظات:</p>
        <p>• <strong>معدل الوارد/يوم:</strong> إجمالي الطلبات المستلمة مقسوماً على 30 يوم.</p>
        <p>• <strong>معدل الإنجاز/يوم:</strong> عدد الإجراءات خلال آخر 30 يوم مقسوماً على 30.</p>
        <p>• <strong>متوسط الإنجاز:</strong> متوسط الوقت من تقديم الطلب إلى اتخاذ الموظف قراراً (قبول/رفض/إعادة). <span className="text-emerald-600">أقل من يوم ممتاز</span> | <span className="text-yellow-600">1-3 أيام جيد</span> | <span className="text-red-600">أكثر من 3 أيام يحتاج متابعة</span>.</p>
      </div>
    </div>
  )
}


