"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ArrowRight, Plus, Pencil, Trash2, CalendarDays, CheckCircle2, Clock, Calendar as CalendarIcon } from "lucide-react"
import { getAllTerms, createTerm, updateTerm, deleteTerm } from "@/app/actions/terms"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { arSA } from "date-fns/locale"

interface TermsManagementPageProps {
  onBack: () => void
  currentUserId?: string
}

interface Term {
  term_id: number
  name: string
  start_date: string
  end_date: string
  created_at?: string
}

type TermStatus = "active" | "upcoming" | "past"

function getTermStatus(term: Term): TermStatus {
  const now = new Date()
  const start = new Date(term.start_date)
  const end = new Date(term.end_date)
  if (now >= start && now <= end) return "active"
  if (now < start) return "upcoming"
  return "past"
}

const STATUS_CONFIG = {
  active:   { label: "نشط الآن",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200",  dot: "bg-emerald-500" },
  upcoming: { label: "قادم",       cls: "bg-blue-100 text-blue-700 border-blue-200",            dot: "bg-blue-500" },
  past:     { label: "منتهي",      cls: "bg-slate-100 text-slate-500 border-slate-200",         dot: "bg-slate-400" },
}

export default function TermsManagementPage({ onBack, currentUserId }: TermsManagementPageProps) {
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [formData, setFormData] = useState({ name: "", start_date: "", end_date: "" })
  const [formError, setFormError] = useState<string | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTermId, setDeletingTermId] = useState<number | null>(null)

  useEffect(() => { fetchTerms() }, [])

  const fetchTerms = async () => {
    setLoading(true)
    setError(null)
    const result = await getAllTerms()
    if (result.success && result.data) {
      setTerms(result.data as Term[])
    } else {
      setError(result.error || "فشل في تحميل الفترات التشغيلية")
    }
    setLoading(false)
  }

  const openCreateDialog = () => {
    setEditingTerm(null)
    setFormData({ name: "", start_date: "", end_date: "" })
    setFormError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (term: Term) => {
    setEditingTerm(term)
    setFormData({
      name: term.name,
      start_date: new Date(term.start_date).toISOString().split("T")[0],
      end_date: new Date(term.end_date).toISOString().split("T")[0],
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setFormError(null)
    if (!formData.name.trim()) { setFormError("اسم الفترة التشغيلية مطلوب"); return }
    if (!formData.start_date) { setFormError("تاريخ البداية مطلوب"); return }
    if (!formData.end_date) { setFormError("تاريخ النهاية مطلوب"); return }
    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      setFormError("يجب أن يكون تاريخ النهاية بعد تاريخ البداية"); return
    }

    setSaving(true)
    let result
    if (editingTerm) {
      result = await updateTerm(editingTerm.term_id, formData)
    } else {
      result = await createTerm(formData)
    }
    setSaving(false)

    if (result.success) {
      setSuccess(editingTerm ? "تم تحديث الفترة بنجاح" : "تم إنشاء الفترة بنجاح")
      setDialogOpen(false)
      fetchTerms()
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setFormError(result.error || "حدث خطأ")
    }
  }

  const confirmDelete = (termId: number) => {
    setDeletingTermId(termId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingTermId) return
    setSaving(true)
    const result = await deleteTerm(deletingTermId)
    setSaving(false)
    setDeleteDialogOpen(false)
    if (result.success) {
      setSuccess("تم حذف الفترة بنجاح")
      fetchTerms()
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(result.error || "فشل في الحذف")
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <CalendarDays className="w-10 h-10 text-primary border-2 border-primary/10 rounded-xl p-1.5 shadow-sm" />
            <h1 className="text-4xl font-black tracking-tight text-foreground">إدارة الفترات التشغيلية</h1>
          </div>
          <p className="text-lg text-muted-foreground mt-2">إدارة وتعديل الفترات الدورية لتنظيم حركة المعاملات والطلبات</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={openCreateDialog} size="lg" className="gap-2 font-bold px-6 shadow-md transition-all hover:scale-105">
            <Plus className="w-5 h-5" />
            إضافة فترة جديدة
          </Button>
        </div>
      </div>

      {/* Success / Error messages */}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-semibold">كيف يعمل نظام الفترات؟</p>
              <p>عند تقديم أي طلب جديد، يقوم النظام تلقائياً بتحديد الفترة الحالية بناءً على تاريخ اليوم وربط الطلب بها. يستطيع الموظفون لاحقاً فلترة طلباتهم السابقة حسب الفترة.</p>
              <p>الفترة النشطة تُحدَّد برمجياً: أي فترة تقع تواريخ بدايتها ونهايتها بحيث يكون تاريخ اليوم بينهما.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : terms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
            <h3 className="text-lg font-semibold mb-1">لا توجد أترام مضافة</h3>
            <p className="text-sm mb-4">أضف الترم الأول لتبدأ في تنظيم الطلبات</p>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة فترة تشغيلية جديدة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {terms.map(term => {
            const status = getTermStatus(term)
            const cfg = STATUS_CONFIG[status]
            return (
              <Card
                key={term.term_id}
                className={cn(
                  "border transition-all hover:shadow-md",
                  status === "active" ? "border-emerald-200 bg-emerald-50/30" : ""
                )}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                        <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === "active" ? "animate-pulse" : ""}`} />
                        {cfg.label}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground">{term.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          <span className="font-medium">من</span>{" "}
                          {new Date(term.start_date).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                          {" "}<span className="font-medium">إلى</span>{" "}
                          {new Date(term.end_date).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openEditDialog(term)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        تعديل
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => confirmDelete(term.term_id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingTerm ? "تعديل الفترة التشغيلية" : "إضافة فترة تشغيلية جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="term-name">اسم الفترة التشغيلية</Label>
              <Input
                id="term-name"
                placeholder="مثال: الربع الأول 2025"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="start-date">تاريخ البداية</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="start-date"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right font-normal border-input rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none transition-[color,box-shadow] h-10 px-3",
                        !formData.start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                      {formData.start_date ? (
                        format(new Date(formData.start_date), "PPP", { locale: arSA })
                      ) : (
                        <span>اختر تاريخ البداية...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.start_date ? new Date(formData.start_date) : undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, start_date: date ? format(date, "yyyy-MM-dd") : "" }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="end-date">تاريخ النهاية</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="end-date"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right font-normal border-input rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none transition-[color,box-shadow] h-10 px-3",
                        !formData.end_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                      {formData.end_date ? (
                        format(new Date(formData.end_date), "PPP", { locale: arSA })
                      ) : (
                        <span>اختر تاريخ النهاية...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.end_date ? new Date(formData.end_date) : undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, end_date: date ? format(date, "yyyy-MM-dd") : "" }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingTerm ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            هل أنت متأكد من حذف هذه الفترة؟ لا يمكن التراجع عن هذا الإجراء. الطلبات المرتبطة بهذا الترم لن تُحذف ولكنها لن ترتبط بأي ترم.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


