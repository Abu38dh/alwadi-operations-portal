"use client"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Clock, CheckCircle, Download, MessageSquare, Edit2, FileText, ArrowRight } from "lucide-react"
import RequestTracking from "./student/request-tracking"
import NextImage from "next/image"

import { Request } from "@/types/schema"

interface RequestDetailProps {
  request: Request
  onEdit?: () => void
  onBack?: () => void
  userId?: string
  showHistory?: boolean
  hideActivityLog?: boolean
}

import { useEffect, useState } from "react"
import { getRequestActions } from "@/app/actions/student"

export interface RequestAction {
  id: string
  action: string
  timestamp: string
  actorName: string
  actorRole: string
  comment?: string
}

import { FilePreviewDialog } from "@/components/shared/file-preview-dialog"
import { generateOfficialPDF } from "@/lib/pdf-generator"

import { toast } from "sonner" 

import { translateRole } from "@/lib/translations"

export default function RequestDetail({ request, onEdit, onBack, userId, showHistory = true, hideActivityLog = false }: RequestDetailProps) {
// ... existing code ...

  const pdfTemplate = request.pdfTemplate || (request as any).form_templates?.pdf_template;
  const generateDocument = request.generateDocument !== false && (request as any).form_templates?.generate_document !== false;

  const [history, setHistory] = useState<RequestAction[]>([])
  const [filePreview, setFilePreview] = useState<{ open: boolean; type: 'image' | 'pdf' | 'other'; content: string; name: string } | null>(null)

  useEffect(() => {
    if (showHistory) {
      const fetchHistory = async () => {
        const requestId = (request as any).request_id || request.id;
        if (!requestId) return;
        const actions = await getRequestActions(requestId.toString())
        setHistory(actions)
      }
      fetchHistory()
    }
  }, [request.id, (request as any).request_id, showHistory])

  const handleDownloadOfficialPDF = async () => {
    // Fallback template if none exists
    const templateToUse = pdfTemplate || `
      <div style="text-align: right; direction: rtl; font-family: 'Arial', sans-serif; padding: 20px;">
        <h2 style="text-align: center; margin-bottom: 30px; font-size: 24px; font-weight: bold; color: #0f172a;">وثيقة طلب رسمي</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: bold; width: 30%;">رقم المرجع</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0;">{RequestID}</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: bold; width: 30%;">التاريخ</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0;">{RequestDate}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">نوع الطلب</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0;" colspan="3">{RequestType}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">مقدم الطلب</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0;">{StudentName}</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">الرقم الوظيفي</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0;">{UniversityID}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">الإدارة / القسم</td>
            <td style="padding: 12px; border: 1px solid #e2e8f0;" colspan="3">{Department}</td>
          </tr>
        </table>

        <div style="margin-top: 30px; line-height: 1.8;">
          <p>تشهد إدارة المنشأة بأن الموظف/مقدم الطلب المذكور أعلاه قد تقدم بهذا الطلب وتم اعتماده وتسجيله في النظام.</p>
          <p>وهذه وثيقة رسمية معتمدة عبر نظام مسار الإلكتروني.</p>
        </div>

        <div style="margin-top: 60px; display: flex; justify-content: space-between;">
           <div style="text-align: center;">
              <p style="margin-bottom: 10px; font-weight: bold;">اعتماد الإدارة / القسم</p>
              <p>...........................</p>
           </div>
           <div style="text-align: center;">
              <p style="margin-bottom: 10px; font-weight: bold;">التوقيع والختم</p>
              <p>...........................</p>
           </div>
        </div>
      </div>
    `

    try {
      const blob = await generateOfficialPDF({
        template: templateToUse,
        data: {
          ...request.submissionData,
          StudentName: request.applicant || request.users?.full_name || "مقدم الطلب",
          UniversityID: userId || request.users?.university_id || "---", 
          RequestID: request.reference_no || request.id,
          RequestDate: new Date(request.date).toLocaleDateString('ar-SA'),
          RequestType: request.type || "طلب عام",
          College: request.users?.departments_users_department_idTodepartments?.colleges?.name || "---",
          Department: request.users?.departments_users_department_idTodepartments?.dept_name || "---",
        }
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Document-${request.reference_no || request.id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("تم تحميل الملف بنجاح")
    } catch (e) {
      console.error("PDF Generation failed", e)
      toast.error("فشل في إنشاء ملف PDF: " + (e as Error).message)
    }
  }

  const statusConfig = {
    pending: { color: "bg-secondary/10 text-secondary", icon: Clock, label: "قيد الانتظار" },
    approved: { color: "bg-primary/10 text-primary", icon: CheckCircle, label: "موافق عليه" },
    rejected: { color: "bg-red-100 text-red-800", icon: CheckCircle, label: "مرفوض" },
    processing: { color: "bg-blue-100 text-blue-800", icon: Clock, label: "قيد المراجعة" },
    approved_with_changes: { color: "bg-primary/10 text-primary", icon: CheckCircle, label: "موافق بتعديلات" },
    rejected_with_changes: { color: "bg-orange-100 text-orange-800", icon: Edit2, label: "معاد للتعديل" },
    returned: { color: "bg-orange-100 text-orange-800", icon: Edit2, label: "معاد للتعديل" },
  }

  const config = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <div className="p-2.5 sm:p-4 md:p-6 space-y-3 sm:space-y-4" >
      {/* Mobile Back Button */}
      {onBack && (
        <div className="flex items-center justify-between pb-1">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden h-8 px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-xs hover:bg-slate-50 gap-1 rounded-lg"
            onClick={onBack}
          >
            <ArrowRight className="w-3.5 h-3.5 text-primary" />
            <span>العودة للقائمة</span>
          </Button>
          <span className="text-xs text-muted-foreground font-mono">#{request.id}</span>
        </div>
      )}

      {/* Premium Header */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs">
        {/* Gradient Banner */}
        <div className="relative bg-gradient-to-l from-primary/95 to-primary/80 p-3 sm:p-5 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 relative">
            <div className="space-y-1 flex-1">
              <h2 className="text-base sm:text-xl font-bold text-white drop-shadow-xs leading-tight">
                {request.title || request.type || (request as any).form_templates?.name}
              </h2>
              {request.description && request.description !== "لا يوجد وصف" && (
                <p className="text-white/80 text-xs line-clamp-1">
                  {request.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs w-fit`}>
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{config.label}</span>
              </div>
              {request.status === 'approved' && generateDocument && pdfTemplate && (
                <Button onClick={handleDownloadOfficialPDF} size="sm" variant="outline" className="h-7 text-xs gap-1.5 bg-white/20 text-white border-white/40 hover:bg-white/30 backdrop-blur-xs shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                  تحميل الوثيقة
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Info Summary Strip */}
        <div className="p-3 bg-white text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium">مقدم الطلب:</span>
              <span className="font-bold text-sm text-foreground">
                {request.applicant || (request as any).users?.full_name || "غير محدد"}
              </span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {request.date || new Date((request as any).submitted_at).toLocaleDateString('ar-SA')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
            {((request as any).users?.university_id || userId) && (
              <div>
                <span className="text-muted-foreground ml-1">الرقم الوظيفي:</span>
                <span className="font-mono font-semibold text-foreground">{((request as any).users?.university_id || userId)}</span>
              </div>
            )}
            {((request as any).applicantPhone || (request as any).users?.phone) && (
              <div>
                <span className="text-muted-foreground ml-1">الجوال:</span>
                <span className="font-mono font-semibold text-primary" dir="ltr">
                  <a href={`https://wa.me/${((request as any).applicantPhone || (request as any).users?.phone)?.replace(/\D/g, '') || ''}`} target="_blank" rel="noopener noreferrer">
                    {((request as any).applicantPhone || (request as any).users?.phone)}
                  </a>
                </span>
              </div>
            )}
            {((request as any).applicantEmail || (request as any).users?.email) && (
              <div className="truncate">
                <span className="text-muted-foreground ml-1">البريد:</span>
                <span className="font-medium text-foreground truncate">
                  {((request as any).applicantEmail || (request as any).users?.email)}
                </span>
              </div>
            )}
            {((request as any).users?.departments_users_department_idTodepartments?.dept_name || (request as any).department) && (
              <div>
                <span className="text-muted-foreground ml-1">القسم:</span>
                <span className="font-semibold text-foreground">{((request as any).users?.departments_users_department_idTodepartments?.dept_name || (request as any).department)}</span>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Dynamic Request Details (submission data) */}
      {(() => {
        // Handle both type structures
        let submissionData = request.submissionData || (request as any).submission_data;
        let schema = request.formSchema || (request as any).form_templates?.schema;

        if (typeof schema === 'string') {
          try { schema = JSON.parse(schema); } catch (e) {}
        }
        if (typeof submissionData === 'string') {
          try { submissionData = JSON.parse(submissionData); } catch (e) {}
        }

        if (Array.isArray(schema) && submissionData && Object.keys(submissionData).length > 0) {
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">تفاصيل الطلب</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {schema.map((field: any) => {
                  if (field.type === 'section') {
                    return (
                      <h5 key={field.id} className="font-bold text-base text-primary border-b pb-2 mt-4 mb-2">
                        {field.label}
                      </h5>
                    )
                  }

                  const fieldKey = field.key || field.id;
                  const value = submissionData[fieldKey] !== undefined
                    ? submissionData[fieldKey]
                    : (field.id && submissionData[field.id] !== undefined
                        ? submissionData[field.id]
                        : (field.key && submissionData[field.key] !== undefined
                            ? submissionData[field.key]
                            : undefined));
                  if (value === undefined || value === null || value === '') return null;

                  return (
                    <div key={field.id} className="grid grid-cols-1 gap-1 border-b last:border-0 pb-2 last:pb-0">
                      <span className="text-sm font-medium text-muted-foreground">{field.label}:</span>
                      <span className="text-sm font-semibold text-foreground break-words whitespace-pre-wrap">
                        {typeof value === 'boolean' ? (value ? 'نعم' : 'لا') :
                          field.type === 'file' && typeof value === 'string' ? (
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
                                      width={300}
                                      height={200}
                                      className="max-w-full h-auto max-h-[200px] rounded-md border border-border mx-auto object-contain"
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
                                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 mt-1"
                                >
                                  <FileText className="w-4 h-4" />
                                  {isPdf ? 'عرض ملف PDF' : 'عرض الملف'}
                                </Button>
                              )
                            })()
                          ) :
                            field.type === 'date' ? new Date(value).toLocaleDateString('ar-EG') :
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
                })}
              </CardContent>
            </Card>
          )
        } else if (submissionData && Object.keys(submissionData).length > 0) {
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">تفاصيل الطلب</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const orderedKeys = [
                    "type", "delegatee_name", "delegatee_university_id",
                    "start_date", "end_date", "reason", "delegated_types"
                  ];
                  const entries = Object.entries(submissionData);
                  entries.sort(([keyA], [keyB]) => {
                    const a = orderedKeys.indexOf(keyA);
                    const b = orderedKeys.indexOf(keyB);
                    if (a === -1 && b === -1) return 0;
                    if (a === -1) return 1;
                    if (b === -1) return -1;
                    return a - b;
                  });

                  return entries.map(([key, value]) => {
                    // Try to find label in schema (for dynamic form fields like field_XXXXX)
                    const schemaField = Array.isArray(schema)
                      ? schema.find((f: any) => f.key === key || f.id === key)
                      : null;

                    const labels: Record<string, string> = {
                      type: "نوع الطلب",
                      delegatee_university_id: "الرقم الوظيفي للزميل",
                      delegatee_name: "اسم الموظف المفوض (الزميل)",
                      start_date: "تاريخ بداية التفويض",
                      end_date: "تاريخ نهاية التفويض",
                      reason: "سبب التفويض",
                      delegated_types: "نماذج الطلبات المفوضة"
                    }

                    const displayLabel = schemaField?.label || labels[key] || null;
                    // Skip raw field_XXXXX keys with no schema label
                    if (!displayLabel && key.startsWith('field_')) return null;

                    let displayValue = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
                    if (schemaField?.type === 'absence_picker' && (typeof value === 'object' || Array.isArray(value)) && value !== null) {
                        displayValue = Array.isArray(value) ? (
                            value.map((item: any) => `المادة: ${item.subjectName || item.subjectId}، التاريخ: ${item.date}`).join(' | ')
                        ) : (
                            `المادة: ${(value as any).subjectName || (value as any).subjectId}، التاريخ: ${(value as any).date}`
                        );
                    } else if (key === 'type' && value === 'SYSTEM_DELEGATION') displayValue = "طلب تفويض نظامي"
                    else if (key.includes('date') && typeof value === 'string') {
                      try { displayValue = new Date(value).toLocaleDateString('ar-SA') } catch(e) {}
                    } else if (key === 'delegated_types') {
                      if (value === null) displayValue = "إدارة كافة الصلاحيات الحالية وأنواع الطلبات"
                      else if (Array.isArray(value)) displayValue = `محدد (${value.length} نماذج)`
                    }

                    return (
                    <div key={key} className="grid grid-cols-1 gap-1 border-b last:border-0 pb-2 last:pb-0">
                      <span className="text-sm font-medium text-muted-foreground">{displayLabel || key}:</span>
                      <span className="text-sm font-semibold text-foreground break-words whitespace-pre-wrap">{displayValue}</span>
                    </div>
                  )})
                })()}
              </CardContent>
            </Card>
          )
        }
        return null;
      })()}

      {/* Prominently display the latest relevant comment if available */}
      {showHistory && (request.status === 'returned' || (request.status as string) === 'rejected_with_changes') && (() => {
        const returnedAction = history.find(a => a.action === 'returned' || a.action === 'rejected_with_changes' || a.action === 'reject_with_changes');
        if (!returnedAction) return null;
        return (
          <div className="rounded-xl border-2 border-orange-300 bg-orange-50 shadow-sm overflow-hidden">
            <div className="bg-orange-400 px-4 py-2.5 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white" />
              <span className="font-bold text-white text-sm">ملاحظات الموظف - يرجى التعديل</span>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-orange-900 text-base font-medium whitespace-pre-wrap leading-relaxed">
                {returnedAction.comment || "لا توجد ملاحظات إضافية"}
              </p>
              <p className="text-orange-600 text-xs border-t border-orange-200 pt-2 mt-2">
                بواسطة: <span className="font-semibold">{returnedAction.actorName}</span>
                {" — "}
                {new Date(returnedAction.timestamp).toLocaleDateString('ar-SA')}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Show comment banner for rejected requests too */}
      {showHistory && request.status === 'rejected' && (() => {
        const rejectedAction = history.find(a => a.action === 'rejected' || a.action === 'reject');
        if (!rejectedAction?.comment) return null;
        return (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 shadow-sm overflow-hidden">
            <div className="bg-red-500 px-4 py-2.5 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white" />
              <span className="font-bold text-white text-sm">سبب الرفض</span>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-red-900 text-base font-medium whitespace-pre-wrap leading-relaxed">
                {rejectedAction.comment}
              </p>
              <p className="text-red-600 text-xs border-t border-red-200 pt-2 mt-2">
                بواسطة: <span className="font-semibold">{rejectedAction.actorName}</span>
                {" — "}
                {new Date(rejectedAction.timestamp).toLocaleDateString('ar-SA')}
              </p>
            </div>
          </div>
        );
      })()}

      {request.attachments && request.attachments.length > 0 && (
        <Card className="overflow-hidden border border-primary/20 shadow-sm">
          {/* Header */}
          <div className="bg-gradient-to-l from-primary/10 to-primary/5 border-b border-primary/15 px-5 py-3.5 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>
            </span>
            <div>
              <h3 className="font-bold text-sm text-primary">وثائق وملفات من الإدارة</h3>
              <p className="text-xs text-primary/60">{request.attachments.length} ملف مرفق</p>
            </div>
          </div>

          {/* Files List */}
          <div className="p-4 space-y-2 bg-white">
            {request.attachments.map((file: any, idx: number) => {
              const fileName = file.storage_location ? file.storage_location.split('/').pop() : `ملف ${idx + 1}`;
              const fileUrl = file.storage_location || '#';
              const isImage = /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(fileName)
              const isPdf = /\.pdf$/i.test(fileName) || fileUrl.startsWith('data:application/pdf')
              const uploaderName = file.users?.full_name || 'الإدارة';
              const uploadDate = file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString('ar-SA') : '';

              const fileIcon = isPdf ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              ) : isImage ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              );

              return (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                  {/* Icon */}
                  <span className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm group-hover:border-primary/30 transition-colors">
                    {fileIcon}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{fileName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      رُفع بواسطة: <span className="text-primary font-medium">{uploaderName}</span>
                      {uploadDate && <span className="mr-2 text-muted-foreground/70">· {uploadDate}</span>}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(isImage || isPdf) && (
                      <button
                        onClick={() => setFilePreview({ open: true, type: isImage ? 'image' : 'pdf', content: fileUrl, name: fileName })}
                        className="px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                      >
                        عرض
                      </button>
                    )}
                    <a
                      href={fileUrl}
                      download={fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="تحميل الملف"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <FilePreviewDialog
        open={!!filePreview?.open}
        onOpenChange={(open) => !open && setFilePreview(null)}
        file={filePreview}
      />

      {request.workflow && request.workflow.length > 0 && <RequestTracking workflow={request.workflow} />
      }

      {((request.status === "approved" && generateDocument && pdfTemplate) || 
        ((request.status === "returned" || (request.status as string) === "rejected_with_changes") && onEdit)) && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">الإجراءات</h3>
          <div className="flex gap-3">
            {request.status === "approved" && generateDocument && pdfTemplate && (
              <Button onClick={handleDownloadOfficialPDF} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Download className="w-4 h-4" />
                تحميل الموافقة (PDF)
              </Button>
            )}
            {(request.status === "returned" || (request.status as string) === "rejected_with_changes") && onEdit && (
              <Button onClick={onEdit} variant="outline" className="gap-2 bg-transparent">
                <Edit2 className="w-4 h-4" />
                تعديل
              </Button>
            )}
          </div>
        </div>
      )}

      {showHistory && !hideActivityLog && (
        <div className="bg-card border border-slate-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-foreground mb-4">سجل النشاطات</h3>
          <div className="relative space-y-8 pr-4 border-r border-slate-200">
            {history.length > 0 ? (
              history.map((action, index) => (
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
                    {(() => {
                      const cleanedComment = action.comment ? action.comment.replace(/\n*\[تم إرفاق ملف:[^\]]*\]/g, '').trim() : '';
                      const attachment = (action as any).attachment;
                      const isPdf = attachment?.type === 'pdf' || attachment?.url?.startsWith('data:application/pdf') || attachment?.name?.endsWith('.pdf');
                      const isImage = attachment?.url?.startsWith('data:image') || /\.(png|jpe?g|gif|webp)$/i.test(attachment?.name || '');

                      return (
                        <>
                          {cleanedComment && (
                            <div className="mt-1 p-2 bg-slate-50 rounded text-xs text-muted-foreground border border-slate-100 whitespace-pre-wrap">
                              {cleanedComment}
                            </div>
                          )}
                          {attachment && attachment.url && (
                            <div className="mt-2 flex items-center justify-between p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-lg gap-2">
                              <span className="text-xs font-semibold text-foreground truncate">{attachment.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFilePreview({
                                      open: true,
                                      type: isPdf ? 'pdf' : isImage ? 'image' : 'other',
                                      content: attachment.url,
                                      name: attachment.name
                                    });
                                  }}
                                  className="px-2 py-1 text-xs font-medium text-emerald-700 bg-white border border-emerald-300 rounded hover:bg-emerald-50"
                                >
                                  عرض
                                </button>
                                <a
                                  href={attachment.url}
                                  download={attachment.name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50"
                                >
                                  تحميل
                                </a>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">لا يوجد سجل نشاطات لهذا الطلب</p>
            )}
          </div>
        </div>
      )
      }
    </div >
  )
}

