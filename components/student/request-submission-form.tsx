"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, Send, Upload, CalendarIcon, Eye, CheckCircle2, Edit3, AlertCircle, FileText, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface RequestSubmissionFormProps {
  requestType: string
  requestTypes: Array<{ id: string; label: string; icon: string }>
  userId: string
  onBack: () => void
  onSubmit: (data: any) => void
  initialData?: any
  requestId?: string
  isEditing?: boolean
}

import { submitRequest, updateRequest } from "@/app/actions/student"
import { getFormTemplate } from "@/app/actions/forms"
import { getMyAbsences } from "@/app/actions/absences"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ─── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({
  formName,
  formSchema,
  formData,
  onConfirm,
  onEdit,
  isSubmitting,
}: {
  formName: string
  formSchema: any[]
  formData: any
  onConfirm: () => void
  onEdit: () => void
  isSubmitting: boolean
}) {
  const getFieldDisplayValue = (field: any) => {
    const fieldKey = field.key || field.id
    const val = formData[fieldKey]
    if (val === undefined || val === null || val === "") return <span className="text-muted-foreground italic">لم يتم تعبئته</span>
    if (field.type === "file") {
      return (
        <a href={val} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
          <FileText className="w-4 h-4" />
          عرض الملف المرفق
        </a>
      )
    }
    if (field.type === "date") {
      try {
        const d = new Date(val)
        if (!isNaN(d.getTime())) {
          return <span className="font-medium">{format(d, "PPP", { locale: ar })}</span>
        }
      } catch (e) {
        // ignore and fallback
      }
    }
    if (field.type === "absence_picker" && Array.isArray(val)) {
      if (val.length === 0) return <span className="text-muted-foreground italic">لا يوجد</span>
      return (
        <div className="space-y-1 mt-1">
          {val.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-md px-3 py-1.5 text-sm">
              <span className="font-medium text-foreground">{item.subjectName}</span>
              <span className="text-muted-foreground">—</span>
              <span className="font-mono text-muted-foreground">{item.date}</span>
            </div>
          ))}
        </div>
      )
    }
    if (field.type === "checkbox" && Array.isArray(val)) {
      return val.join("، ")
    }
    return <span className="font-medium">{String(val)}</span>
  }

  const visibleFields = formSchema.filter(f => f.type !== "section")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onEdit} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-background rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-l from-primary/10 to-primary/5 border-b border-border px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Eye className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">مراجعة الطلب قبل الإرسال</h2>
              <p className="text-sm text-muted-foreground">{formName}</p>
            </div>
          </div>
          <button onClick={onEdit} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-6 mt-4 flex-shrink-0 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            يرجى مراجعة جميع البيانات أدناه بعناية قبل إرسال الطلب. لا يمكن التعديل بعد الإرسال إلا بموافقة المسؤول.
          </p>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {visibleFields.map((field) => (
            <div key={field.id} className="group flex flex-col gap-1.5 bg-muted/30 hover:bg-muted/50 border border-border rounded-xl px-4 py-3 transition-colors">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {field.label}
                {field.required && <span className="text-destructive mr-1">*</span>}
              </span>
              <div className="text-sm text-foreground">
                {getFieldDisplayValue(field)}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="border-t border-border px-6 py-4 flex items-center gap-3 flex-shrink-0 bg-background">
          <Button
            onClick={onEdit}
            variant="outline"
            className="flex-1 gap-2 h-11"
            disabled={isSubmitting}
          >
            <Edit3 className="w-4 h-4" />
            تعديل البيانات
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 gap-2 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جارٍ الإرسال...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                تأكيد الإرسال
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
// ──────────────────────────────────────────────────────────────────────────────

export default function RequestSubmissionForm({
  requestType, // This is the formId
  requestTypes = [],
  userId,
  onBack,
  onSubmit,
  initialData,
  requestId,
  isEditing = false,
}: RequestSubmissionFormProps) {
  const [formData, setFormData] = useState<any>({})
  const [formSchema, setFormSchema] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [studentSubjects, setStudentSubjects] = useState<any[]>([])
  const [fetchingSubjects, setFetchingSubjects] = useState(false)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  // ── Review state ───────────────────────────────────────────────────────────
  const [showReview, setShowReview] = useState(false)
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchFormSchema = async () => {
      setIsLoading(true)
      try {
        const result = await getFormTemplate(parseInt(requestType))
        if (result.success && result.data) {
          setFormSchema(result.data.schema as any[])
          setFormName(result.data.name)

          const schemaArray = Array.isArray(result.data.schema) ? result.data.schema : (typeof result.data.schema === 'string' ? JSON.parse(result.data.schema) : []);

          // Pre-fill data if editing
          if (isEditing && initialData) {
            const formattedData = { ...initialData }
            schemaArray.forEach((field: any) => {
              if (field.type === 'absence_picker' && formattedData[field.key]) {
                if (!Array.isArray(formattedData[field.key])) {
                  formattedData[field.key] = [formattedData[field.key]]
                }
              }
            })
            setFormData(formattedData)
          }

          // Check if form has absence_picker and fetch subjects
          const hasAbsencePicker = schemaArray.some((f: any) => f.type === 'absence_picker')
          if (hasAbsencePicker) {
            setFetchingSubjects(true)
            const absResult = await getMyAbsences(userId)
            if (absResult.success) {
              setStudentSubjects(absResult.subjects || [])
            }
            setFetchingSubjects(false)
          }

        } else {
          setError("فشل في تحميل نموذج الطلب")
        }
      } catch (err) {
        setError("حدث خطأ أثناء تحميل النموذج")
      } finally {
        setIsLoading(false)
      }
    }

    if (requestType) {
      fetchFormSchema()
    }
  }, [requestType])

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }))
  }

  // ── Step 1: Validate & show review modal ──────────────────────────────────
  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate required fields
    const missingFields = formSchema
      .filter(field => {
        if (!field.required) return false
        const fieldKey = field.key || field.id
        const val = formData[fieldKey]
        if (val === undefined || val === null || val === '') return true
        if (field.type === 'absence_picker') {
          return !Array.isArray(val) || val.length === 0
        }
        return false
      })
      .map(field => field.label)

    if (missingFields.length > 0) {
      setError(`يرجى تعبئة الحقول المطلوبة: ${missingFields.join("، ")}`)
      return
    }

    // Show review modal
    setShowReview(true)
  }

  // ── Step 2: Actual submission after review confirmation ───────────────────
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      let result

      const payload = {
        formId: requestType,
        userId: userId,
        ...formData
      }

      if (isEditing && requestId) {
        result = await updateRequest(parseInt(requestId), formData, userId)
      } else {
        result = await submitRequest(payload)
      }

      if (result.success) {
        setShowReview(false)
        onSubmit(formData)
      } else {
        setShowReview(false)
        setError(result.error || (isEditing ? "فشل تحديث الطلب" : "فشل تقديم الطلب"))
      }
    } catch (err) {
      setShowReview(false)
      setError("حدث خطأ غير متوقع")
    } finally {
      setIsSubmitting(false)
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
      {/* ── Review Modal ─────────────────────────────────────────────────────── */}
      {showReview && (
        <ReviewModal
          formName={formName}
          formSchema={formSchema}
          formData={formData}
          onConfirm={handleConfirmSubmit}
          onEdit={() => setShowReview(false)}
          isSubmitting={isSubmitting}
        />
      )}
      {/* ────────────────────────────────────────────────────────────────────── */}

      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">{formName}</h2>
          <Button onClick={onBack} variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5 bg-white border border-slate-200">
            <ArrowRight className="w-3.5 h-3.5" />
            رجوع
          </Button>
        </div>

        <Card className="shadow-xs border-slate-200">
          <CardHeader className="border-b bg-muted/20 p-3 sm:p-5 pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg">{isEditing ? "تعديل الطلب" : "تقديم طلب جديد"}</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-0.5">
              {isEditing
                ? "يمكنك تعديل البيانات وإعادة إرسال الطلب للمراجعة"
                : "الرجاء ملء البيانات المطلوبة ثم اضغط مراجعة وتقديم"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-3 sm:pt-4">
            <form onSubmit={handleSubmitClick} className="space-y-3.5 sm:space-y-5">

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-xs flex items-start gap-2">
                  <span className="text-sm">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {formSchema.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  لا توجد حقول في هذا النموذج
                </div>
              ) : (
                formSchema.map((field) => {
                  const fieldKey = field.key || field.id
                  return (
                    <div key={field.id} className="space-y-1">
                      {field.type === "section" && (
                        <div className="bg-muted/40 -mx-3 sm:-mx-5 px-3 sm:px-5 py-2 mb-3 mt-4 first:mt-0">
                          <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                            <span className="text-primary">▪</span>
                            {field.label}
                          </h3>
                        </div>
                      )}

                      {field.type !== 'section' && (
                        <>
                          <Label className="block text-xs sm:text-sm font-semibold text-foreground mb-1" required={field.required}>
                            {field.label}
                          </Label>

                          {field.type === "text" && (
                            <Input
                              type="text"
                              placeholder={field.placeholder}
                              value={formData[fieldKey] || ""}
                              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                              required={field.required}
                              className="text-right h-9 sm:h-10 text-xs sm:text-sm bg-white"
                            />
                          )}

                          {field.type === "longtext" && (
                            <textarea
                              placeholder={field.placeholder}
                              value={formData[fieldKey] || ""}
                              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                              required={field.required}
                              className="w-full px-3 py-2 border border-input rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[70px] sm:min-h-[90px] text-xs sm:text-sm bg-background resize-y"
                              rows={3}
                            />
                          )}

                          {field.type === "number" && (
                            <Input
                              type="number"
                              placeholder={field.placeholder}
                              value={formData[fieldKey] || ""}
                              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                              required={field.required}
                              className="text-right h-9 sm:h-10 text-xs sm:text-sm bg-white"
                            />
                          )}

                          {field.type === "date" && (() => {
                            const rawVal = formData[fieldKey]
                            let dateObj: Date | null = null
                            if (rawVal) {
                              const parsed = new Date(rawVal)
                              if (!isNaN(parsed.getTime())) {
                                dateObj = parsed
                              }
                            }

                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full h-9 sm:h-10 justify-start text-right font-normal border-input rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none transition-[color,box-shadow] px-3 text-xs sm:text-sm",
                                      !dateObj && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    {dateObj ? (
                                      format(dateObj, "PPP", { locale: ar })
                                    ) : (
                                      <span>اختر التاريخ...</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={dateObj || undefined}
                                    onSelect={(date) => {
                                      handleInputChange(fieldKey, date && !isNaN(date.getTime()) ? format(date, "yyyy-MM-dd") : "")
                                    }}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            )
                          })()}

                          {field.type === "select" && (
                            <Select
                              value={formData[fieldKey] || ""}
                              onValueChange={(value) => handleInputChange(fieldKey, value)}
                            >
                              <SelectTrigger className="w-full h-9 sm:h-10 text-xs sm:text-sm text-right !border-input !rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none" dir="rtl">
                                <SelectValue placeholder="اختر..." />
                              </SelectTrigger>
                              <SelectContent dir="rtl">
                                {field.options?.map((opt: any, optIdx: number) => {
                                  const optVal = typeof opt === 'object' && opt !== null ? (opt.label || opt.value || opt.id) : String(opt)
                                  const optKey = typeof opt === 'object' && opt !== null ? (opt.id || opt.value || optIdx) : optIdx
                                  return (
                                    <SelectItem key={optKey} value={optVal} className="text-right">
                                      {optVal}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          )}

                          {field.type === "radio" && (
                            <div className="space-y-3 pr-2">
                              {field.options?.map((opt: any, optIdx: number) => {
                                const optVal = typeof opt === 'object' && opt !== null ? (opt.label || opt.value || opt.id) : String(opt)
                                const optKey = typeof opt === 'object' && opt !== null ? (opt.id || opt.value || optIdx) : optIdx
                                return (
                                  <div key={optKey} className="flex items-center gap-3">
                                    <input
                                      type="radio"
                                      name={fieldKey}
                                      id={`${fieldKey}-${optKey}`}
                                      value={optVal}
                                      checked={formData[fieldKey] === optVal}
                                      onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                                      className="w-4 h-4 text-primary cursor-pointer"
                                    />
                                    <Label htmlFor={`${fieldKey}-${optKey}`} className="text-base cursor-pointer select-none">
                                      {optVal}
                                    </Label>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {field.type === "checkbox" && (
                            <div className="space-y-3 pr-2">
                              {field.options?.map((opt: any, optIdx: number) => {
                                const optVal = typeof opt === 'object' && opt !== null ? (opt.label || opt.value || opt.id) : String(opt)
                                const optKey = typeof opt === 'object' && opt !== null ? (opt.id || opt.value || optIdx) : optIdx
                                return (
                                  <div key={optKey} className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      id={`${fieldKey}-${optKey}`}
                                      value={optVal}
                                      checked={Array.isArray(formData[fieldKey]) && formData[fieldKey].includes(optVal)}
                                      onChange={(e) => {
                                        const currentValues = Array.isArray(formData[fieldKey]) ? formData[fieldKey] : []
                                        let newValues
                                        if (e.target.checked) {
                                          newValues = [...currentValues, optVal]
                                        } else {
                                          newValues = currentValues.filter((v: string) => v !== optVal)
                                        }
                                        handleInputChange(fieldKey, newValues)
                                      }}
                                      className="w-4 h-4 text-primary rounded cursor-pointer"
                                    />
                                    <Label htmlFor={`${fieldKey}-${optKey}`} className="text-base cursor-pointer select-none">
                                      {optVal}
                                    </Label>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                        {field.type === "file" && (
                          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/30 hover:border-primary/50 transition-all cursor-pointer relative">
                            <Input
                              type="file"
                              className="hidden"
                              id={`file-${fieldKey}`}
                              onChange={async (e) => {
                                if (e.target.files?.[0]) {
                                  const file = e.target.files[0]
                                  const uploadData = new FormData()
                                  uploadData.append('file', file)

                                  try {
                                    const loadingToast = document.createElement('div')
                                    loadingToast.className = "fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded shadow-lg z-50"
                                    loadingToast.innerText = "جاري رفع الملف..."
                                    document.body.appendChild(loadingToast)

                                    const response = await fetch('/api/upload', {
                                      method: 'POST',
                                      body: uploadData
                                    })

                                    document.body.removeChild(loadingToast)

                                    const data = await response.json()

                                    if (data.success) {
                                      handleInputChange(fieldKey, data.url)
                                    } else {
                                      alert("فشل رفع الملف: " + data.error)
                                    }
                                  } catch (err) {
                                    console.error("Upload failed", err)
                                    alert("حدث خطأ أثناء رفع الملف")
                                  }
                                }
                              }}
                            />
                            <Label htmlFor={`file-${fieldKey}`} className="cursor-pointer flex flex-col items-center gap-3">
                              <Upload className="w-10 h-10 text-muted-foreground" />
                              <div className="space-y-1">
                                <p className="text-base font-medium text-foreground">
                                  {formData[fieldKey] ? (
                                    <span className="text-primary font-bold">تم رفع الملف بنجاح </span>
                                  ) : "اضغط لرفع ملف"}
                                </p>
                                {!formData[fieldKey] && (
                                  <p className="text-sm text-muted-foreground">أو اسحب الملف وأفلته هنا</p>
                                )}
                                {formData[fieldKey] && (
                                  <p className="text-xs text-muted-foreground break-all max-w-xs mx-auto mt-2">
                                    <a href={formData[fieldKey]} target="_blank" rel="noopener noreferrer" className="hover:underline">عرض الملف المرفق</a>
                                  </p>
                                )}
                              </div>
                            </Label>
                          </div>
                        )}

                        {field.type === "absence_picker" && (
                          <div className="border border-border rounded-lg p-5 space-y-4 bg-card">
                            {fetchingSubjects ? (
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin inline-block"></span>
                                جاري جلب البيانات...
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* Display existing added absences */}
                                <div className="space-y-2">
                                  <Label className="text-base font-semibold text-foreground">القائمة المحددة:</Label>
                                  {!Array.isArray(formData[fieldKey]) || formData[fieldKey].length === 0 ? (
                                    <div className="text-sm text-muted-foreground bg-muted/50 border border-border p-4 rounded-lg text-center font-medium">
                                      لم يتم تحديد أي بنود بعد.
                                    </div>
                                  ) : (
                                    <div className="border border-border rounded-lg overflow-hidden bg-background shadow-sm">
                                      <table className="w-full text-sm">
                                        <thead className="bg-muted text-muted-foreground border-b border-border">
                                          <tr>
                                            <th className="text-right p-3 font-semibold">البند / الصنف</th>
                                            <th className="text-right p-3 font-semibold">التاريخ</th>
                                            <th className="text-center p-3 font-semibold w-24">إجراء</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                          {(formData[fieldKey] as any[]).map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-muted/40">
                                              <td className="p-3 font-medium text-slate-800">
                                                {item.subjectName}
                                              </td>
                                              <td className="p-3 font-mono text-slate-600">
                                                {item.date}
                                              </td>
                                              <td className="p-3 text-center">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    const newList = (formData[fieldKey] as any[]).filter((_, i) => i !== idx);
                                                    handleInputChange(fieldKey, newList);
                                                  }}
                                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-8 w-8 rounded-full"
                                                >
                                                  ✕
                                                </Button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
 
                                {/* Form to add a new absence row */}
                                <div className="bg-background border border-border p-4 rounded-lg shadow-sm space-y-3">
                                  <h4 className="text-sm font-bold text-foreground">إضافة بند جديد</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                    <div className="space-y-1.5 md:col-span-2">
                                      <Label className="text-xs font-semibold text-slate-600">البند / الصنف</Label>
                                      <Select
                                        value={selectedSubjectId}
                                        onValueChange={(value) => setSelectedSubjectId(value)}
                                      >
                                        <SelectTrigger className="w-full h-11 text-base text-right !border-input !rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none" dir="rtl">
                                          <SelectValue placeholder="اختر الصنف / البند..." />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                          {studentSubjects.map((s: any) => (
                                            <SelectItem key={s.subject_id} value={s.subject_id.toString()} className="text-right">
                                              {s.name} {s.code ? `(${s.code})` : ""}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2 flex flex-col">
                                      <Label className="text-xs font-semibold text-slate-600 mb-1.5">التاريخ / موعد الاستحقاق</Label>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant={"outline"}
                                            className={cn(
                                              "w-full h-11 justify-start text-right font-normal border-input rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none transition-[color,box-shadow] px-3",
                                              !selectedDate && "text-muted-foreground"
                                            )}
                                          >
                                            <CalendarIcon className="ml-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            {selectedDate && !isNaN(selectedDate.getTime()) ? (
                                              format(selectedDate, "PPP", { locale: ar })
                                            ) : (
                                              <span>اختر التاريخ...</span>
                                            )}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={setSelectedDate}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                    <div className="md:col-span-1">
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          const subjectId = parseInt(selectedSubjectId || "");
                                          const date = selectedDate && !isNaN(selectedDate.getTime()) ? format(selectedDate, "yyyy-MM-dd") : "";

                                          if (!subjectId || !date) {
                                            alert("الرجاء اختيار البند وتحديد التاريخ");
                                            return;
                                          }

                                          const subjectName = studentSubjects.find((s: any) => s.subject_id === subjectId)?.name || "";
                                          
                                          const currentList = Array.isArray(formData[fieldKey]) ? formData[fieldKey] : [];
                                          
                                          // Avoid duplicate entries
                                          const isDuplicate = currentList.some((item: any) => item.subjectId === subjectId && item.date === date);
                                          if (isDuplicate) {
                                            alert("هذا البند مضاف بالفعل في القائمة");
                                            return;
                                          }

                                          const newList = [...currentList, { subjectId, subjectName, date }];
                                          handleInputChange(fieldKey, newList);
 
                                          // Reset inputs
                                          setSelectedSubjectId("");
                                          setSelectedDate(undefined);
                                        }}
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-11"
                                      >
                                        إضافة
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground font-medium">✨ النظام سيقوم بمعالجة جميع العناصر المحددة آلياً عند قبول هذا الطلب</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )})
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-6 border-t mt-8">
                <Button onClick={onBack} variant="outline" type="button" size="lg" className="w-full sm:w-auto px-8">
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8"
                  disabled={isSubmitting}
                >
                  <Eye className="w-4 h-4" />
                  مراجعة وتقديم الطلب
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
