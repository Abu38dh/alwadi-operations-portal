"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getRequestPreviousSteps } from "@/app/actions/employee"
import { User, Users, ArrowRightLeft, CheckCircle, Clock, Briefcase, GraduationCap } from "lucide-react"

export type ActionType = 'approve' | 'reject' | 'approve_with_changes' | 'reject_with_changes' | null

interface RequestActionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: ActionType
    requestId?: string | number | null
    onConfirm: (comment: string, targetStepId?: number | null) => void
    isProcessing: boolean
}

export function RequestActionDialog({
    open,
    onOpenChange,
    type,
    requestId,
    onConfirm,
    isProcessing
}: RequestActionDialogProps) {
    const [comment, setComment] = useState("")
    const [selectedTarget, setSelectedTarget] = useState<string>("student") // 'student' or step_id as string
    const [loadingSteps, setLoadingSteps] = useState(false)
    const [stepsData, setStepsData] = useState<{
        requester: { name: string; university_id?: string; role_title?: string; is_student?: boolean }
        currentStep: { step_id: number; name: string; order: number } | null
        previousSteps: Array<{
            step_id: number
            name: string
            order: number
            role_name?: string
            role_title?: string
            employee_name?: string | null
            last_action?: { action: string; actor_name?: string; date?: Date } | null
        }>
    } | null>(null)

    // Reset comment and fetch steps when dialog opens/closes or type changes
    useEffect(() => {
        if (open) {
            setComment("")
            setSelectedTarget("student")

            if (type === 'reject_with_changes' && requestId) {
                setLoadingSteps(true)
                getRequestPreviousSteps(Number(requestId))
                    .then((res: any) => {
                        if (res.success) {
                            setStepsData(res)
                        } else {
                            setStepsData(null)
                        }
                    })
                    .catch((err: any) => {
                        console.error("Failed to load previous steps:", err)
                        setStepsData(null)
                    })
                    .finally(() => setLoadingSteps(false))
            } else {
                setStepsData(null)
            }
        }
    }, [open, type, requestId])

    const handleConfirm = () => {
        const targetStepId = selectedTarget === 'student' ? null : parseInt(selectedTarget)
        onConfirm(comment, targetStepId)
    }

    const getTitle = () => {
        switch (type) {
            case 'approve': return 'تأكيد الموافقة'
            case 'reject': return 'تأكيد الرفض النهائي'
            case 'approve_with_changes': return 'موافقة مع طلب تعديلات'
            case 'reject_with_changes': return 'إعادة الطلب للتعديل والمراجعة'
            default: return ''
        }
    }

    const getDescription = () => {
        switch (type) {
            case 'approve': return 'هل أنت متأكد من الموافقة على هذا الطلب ونقله للخطوة التالية؟'
            case 'reject': return 'سيتم رفض الطلب نهائياً وإشعار صاحب الطلب بالسبب.'
            case 'reject_with_changes': return 'حدد الشخص أو الموظف المطلوب إعادة الطلب إليه مع كتابة سبب الإرجاع والتعديلات المطلوبة.'
            default: return 'الرجاء ذكر التعديلات المطلوبة.'
        }
    }

    const getLabel = () => {
        switch (type) {
            case 'approve': return 'ملاحظات وتوجيهات (اختياري)'
            case 'reject': return 'سبب الرفض (إلزامي)'
            case 'reject_with_changes': return 'سبب الإرجاع / التوجيهات والتعديلات المطلوبة (إلزامي)'
            default: return 'التعديلات المطلوبة'
        }
    }

    const getPlaceholder = () => {
        switch (type) {
            case 'approve': return 'أضف ملاحظاتك إن وجدت...'
            case 'reject': return 'اكتب سبب الرفض بالتفصيل...'
            case 'reject_with_changes':
                return selectedTarget === 'student'
                    ? 'اشرح للموظف / مقدم الطلب ما هي البيانات أو المستندات المطلوب تعديلها...'
                    : 'اكتب التوجيهات والملاحظات المطلوبة للموظف المختص...'
            default: return 'اشرح التعديلات المطلوبة...'
        }
    }

    const isCommentRequired = type !== 'approve'
    const isValid = !isCommentRequired || comment.trim().length > 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[580px] w-[95vw] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-slate-200 shadow-2xl" dir="rtl">
                <DialogHeader className="p-4 sm:p-5 border-b border-border bg-slate-50/90 shrink-0 text-right pr-4 pl-12">
                    <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                        {type === 'reject_with_changes' && <ArrowRightLeft className="w-5 h-5 text-orange-600" />}
                        {getTitle()}
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {getDescription()}
                    </DialogDescription>
                </DialogHeader>

                <div
                    className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain touch-pan-y"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {/* Destination Selection (Only for reject_with_changes) */}
                    {type === 'reject_with_changes' && (
                        <div className="space-y-3 bg-muted/40 border border-border p-4 rounded-xl">
                            <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                اختر الشخص / الموظف المراد إعادة الطلب إليه:
                            </Label>

                            {loadingSteps ? (
                                <div className="py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                    جاري جلب بيانات المراجعين وخطوات المسار...
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {/* 1. Requester / Student Option */}
                                    <label
                                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${selectedTarget === 'student'
                                                ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/30'
                                                : 'bg-background hover:bg-muted/60 border-border'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="returnTarget"
                                            value="student"
                                            checked={selectedTarget === 'student'}
                                            onChange={(e) => setSelectedTarget(e.target.value)}
                                            className="mt-1 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                        />
                                        <div className="flex-1 text-sm">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="font-bold text-foreground flex items-center gap-1.5">
                                                    <User className="w-4 h-4 text-primary" />
                                                    <span>مقدم الطلب: {stepsData?.requester?.name || "الموظف"}</span>
                                                </div>
                                                {stepsData?.requester?.university_id && (
                                                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                                        {stepsData.requester.university_id}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                إعادة الطلب لصاحبه لتعديل البيانات أو إرفاق المستندات المطلوبة وإعادة الإرسال.
                                            </p>
                                        </div>
                                    </label>

                                    {/* 2. Previous Workflow Steps (Employees / Roles) */}
                                    {stepsData?.previousSteps && stepsData.previousSteps.length > 0 && (
                                        <div className="pt-2 border-t border-border/70 space-y-2">
                                            <span className="text-xs font-semibold text-muted-foreground block">
                                                أو أعد الطلب لأحد الموظفين / المسؤولين السابقين في المسار:
                                            </span>
                                            {stepsData.previousSteps.map((step) => (
                                                <label
                                                    key={step.step_id}
                                                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${selectedTarget === step.step_id.toString()
                                                            ? 'bg-orange-500/10 border-orange-500 shadow-sm ring-1 ring-orange-500/30'
                                                            : 'bg-background hover:bg-muted/60 border-border'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="returnTarget"
                                                        value={step.step_id.toString()}
                                                        checked={selectedTarget === step.step_id.toString()}
                                                        onChange={(e) => setSelectedTarget(e.target.value)}
                                                        className="mt-1 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                                                    />
                                                    <div className="flex-1 text-sm">
                                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                                            <div className="font-bold text-foreground flex items-center gap-1.5">
                                                                <Clock className="w-4 h-4 text-orange-600" />
                                                                <span>{step.name}</span>
                                                            </div>
                                                            {step.role_title && (
                                                                <span className="text-xs bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full font-medium">
                                                                    {step.role_title}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Employee Name Info */}
                                                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-foreground font-semibold bg-muted/60 px-2.5 py-1 rounded-md w-fit">
                                                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                                            <span>
                                                                الموظف المسؤول: {step.employee_name ? step.employee_name : `المكلف بـ (${step.role_title || "الخطوة"})`}
                                                            </span>
                                                        </div>

                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            إعادة توجيه الطلب إلى صندوق وارد هذا الموظف لمراجعته وإعادة اتخاذ الإجراء.
                                                        </p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Comment Field */}
                    <div className="space-y-2">
                        <Label htmlFor="dialog-comment" className="text-sm font-semibold text-foreground">
                            {getLabel()}
                        </Label>
                        <Textarea
                            id="dialog-comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={getPlaceholder()}
                            rows={4}
                            className={`text-sm ${!isValid && comment.length > 0 ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        {isCommentRequired && !comment.trim() && (
                            <p className="text-xs text-destructive">* هذا الحقل إلزامي لتوثيق سبب الإجراء والتوجيهات</p>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-3 sm:p-4 border-t border-border bg-slate-50/90 shrink-0 flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isProcessing}
                        className="px-6"
                    >
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isProcessing || !isValid}
                        className={`px-6 font-semibold gap-2 ${type === 'approve' || type === 'approve_with_changes'
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : type === 'reject_with_changes'
                                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                                    : "bg-destructive hover:bg-destructive/90 text-white"
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                جارٍ التنفيذ...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                تأكيد التنفيذ
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
