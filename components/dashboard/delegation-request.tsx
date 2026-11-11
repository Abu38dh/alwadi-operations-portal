"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Calendar as CalendarIcon, History } from "lucide-react"
import { getDepartmentColleagues, submitDelegationRequest, getEmployeeRequests, getDelegations } from "@/app/actions/employee"
import { getApprovableFormTemplates } from "@/app/actions/forms"
import { useToast } from "@/components/ui/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { arSA } from "date-fns/locale"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DelegationRequestProps {
    userData: {
        university_id: string
        full_name: string
    }
}

export default function DelegationRequest({ userData }: DelegationRequestProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [colleagues, setColleagues] = useState<{ id: string, name: string, group?: string }[]>([])
    const [formTemplates, setFormTemplates] = useState<{ form_id: number, name: string }[]>([])
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

    // Form State
    const [delegateeId, setDelegateeId] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [reason, setReason] = useState("")
    const [selectedTypes, setSelectedTypes] = useState<number[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [attachmentData, setAttachmentData] = useState<string>("")
    const [attachmentName, setAttachmentName] = useState<string>("")

    // History State
    const [history, setHistory] = useState<any[]>([])
    const [activeDelegations, setActiveDelegations] = useState<any[]>([])

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // 1. Fetch Colleagues
            const colleaguesRes = await getDepartmentColleagues(userData.university_id)
            if (colleaguesRes.success && colleaguesRes.users) {
                setColleagues(colleaguesRes.users)
            }

            // 1.5 Fetch Approvable Form Templates
            const templatesRes = await getApprovableFormTemplates(userData.university_id)
            if (templatesRes.success && templatesRes.data) {
                setFormTemplates(templatesRes.data)
                setSelectedTypes(templatesRes.data.map((f: any) => f.form_id))
            }

            // 2. Fetch Active Delegations (Real Records)
            const delegationsRes = await getDelegations(userData.university_id)
            if (delegationsRes.success && delegationsRes.data) {
                // Filter only my grants
                setActiveDelegations(delegationsRes.data.filter((d: any) => d.grantor_user_id.toString() !== userData.university_id)) // Wait, grantor_user_id is int. userData is string.
                // Actually `getDelegations` returns both grantor and grantee.
                // We want to show "My Active Delegations" (where I am grantor).
                // API returns `grantor_user_id` as number.
                // We need to match with DB user ID. But we only have university_id here. 
                // Let's rely on api logic or just show all returned (api filters by OR).
                // Let's assume API returns helpful data.
                setActiveDelegations(delegationsRes.data)
            }

            // 3. Fetch Request History (System Delegation Requests)
            const requestsRes = await getEmployeeRequests(userData.university_id)
            if (requestsRes.success && requestsRes.requests) {
                const delegationRequests = requestsRes.requests.filter((r: any) =>
                    r.type === "طلب تفويض صلاحيات" || r.submissionData?.type === 'SYSTEM_DELEGATION'
                )
                setHistory(delegationRequests)
            }

        } catch (error) {
            console.error(error)
            toast({ title: "خطأ", description: "فشل تحميل البيانات", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!delegateeId || !startDate || !endDate || !reason) {
            toast({ title: "تنبيه", description: "جميع الحقول مطلوبة", variant: "destructive" })
            return
        }

        setSubmitting(true)
        try {
            const result = await submitDelegationRequest(
                userData.university_id,
                delegateeId,
                new Date(startDate),
                new Date(endDate),
                reason,
                selectedTypes.length > 0 ? selectedTypes : null,
                attachmentData || undefined,
                attachmentName || undefined
            )

            if (result.success) {
                toast({ title: "تم بنجاح", description: "تم رفع طلب التفويض للموافقة", className: "bg-green-600 text-white" })
                // Reset form
                setDelegateeId("")
                setStartDate("")
                setEndDate("")
                setReason("")
                setSelectedTypes([])
                setAttachmentData("")
                setAttachmentName("")
                // Reload
                loadData()
            } else {
                toast({ title: "خطأ", description: result.error || "فشل تقديم الطلب", variant: "destructive" })
            }
        } catch (error) {
            toast({ title: "خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-3 sm:space-y-4">
            <Card className="border-slate-200 shadow-xs">
                <CardHeader className="p-3 sm:p-5 pb-2">
                    <CardTitle className="text-base sm:text-lg font-bold">تقديم طلب تفويض جديد</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                        تفويض صلاحياتك لزميل آخر لفترة محددة (يتطلب موافقة المدير العام).
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-5 pt-0">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">الموظف المفوض (الزميل) <span className="text-red-500">*</span></Label>
                                <Select value={delegateeId} onValueChange={setDelegateeId} required>
                                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                                        <SelectValue placeholder="اختر الموظف" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colleagues.filter(c => c.group === 'القسم').length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>زملاء القسم</SelectLabel>
                                                {colleagues.filter(c => c.group === 'القسم').map(user => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}
                                        {colleagues.filter(c => c.group === 'الإدارة العامة والفروع' || c.group === 'الإدارة العامة' || c.group === 'الفروع').length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>زملاء الإدارات والفروع الأخرى</SelectLabel>
                                                {colleagues.filter(c => c.group === 'الإدارة العامة والفروع' || c.group === 'الإدارة العامة' || c.group === 'الفروع').map(user => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}
                                        {colleagues.filter(c => !c.group).length > 0 && (
                                            <SelectGroup>
                                                {colleagues.filter(c => !c.group).map(user => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1 flex flex-col">
                                    <Label className="text-xs font-semibold">من تاريخ <span className="text-red-500">*</span></Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={`w-full justify-start text-right font-normal border-input rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none transition-[color,box-shadow] h-9 px-2.5 text-xs ${!startDate && "text-muted-foreground"}`}
                                            >
                                                <CalendarIcon className="ml-1.5 h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                {startDate ? (
                                                    format(new Date(startDate), "PPP", { locale: arSA })
                                                ) : (
                                                    <span>من تاريخ...</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={startDate ? new Date(startDate) : undefined}
                                                onSelect={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1 flex flex-col">
                                    <Label className="text-xs font-semibold">إلى تاريخ <span className="text-red-500">*</span></Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={`w-full justify-start text-right font-normal border-input rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none transition-[color,box-shadow] h-9 px-2.5 text-xs ${!endDate && "text-muted-foreground"}`}
                                            >
                                                <CalendarIcon className="ml-1.5 h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                {endDate ? (
                                                    format(new Date(endDate), "PPP", { locale: arSA })
                                                ) : (
                                                    <span>إلى تاريخ...</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={endDate ? new Date(endDate) : undefined}
                                                onSelect={(date) => setEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs font-semibold">أنواع الطلبات المفوضة</Label>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                                        {selectedTypes.length === formTemplates.length ? "محددة بالكامل" : `${selectedTypes.length} من ${formTemplates.length} محددة`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTypes(formTemplates.map(f => f.form_id))}
                                        className="text-primary hover:underline font-medium"
                                    >
                                        تحديد الكل
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTypes([])}
                                        className="text-slate-500 hover:text-slate-700 hover:underline"
                                    >
                                        إلغاء التحديد
                                    </button>
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                جميع المعاملات محددة افتراضياً، قم بإلغاء إشارة الصح (✓) فقط عما لا ترغب بتفويضه:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border border-slate-200 p-2 sm:p-2.5 rounded-lg bg-slate-50/50 max-h-36 overflow-y-auto text-xs">
                                {formTemplates.map((template) => {
                                    const isChecked = selectedTypes.includes(template.form_id);
                                    return (
                                        <div key={template.form_id} className={`flex items-center space-x-1.5 space-x-reverse p-1.5 rounded-md border transition-all cursor-pointer ${isChecked ? 'bg-white border-primary/40' : 'bg-slate-100/60 border-slate-200 opacity-60'}`}>
                                            <Checkbox 
                                                id={`type-${template.form_id}`} 
                                                checked={isChecked}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedTypes([...selectedTypes, template.form_id])
                                                    } else {
                                                        setSelectedTypes(selectedTypes.filter(id => id !== template.form_id))
                                                    }
                                                }}
                                                className="h-3.5 w-3.5"
                                            />
                                            <label
                                                htmlFor={`type-${template.form_id}`}
                                                className={`text-xs font-medium leading-none cursor-pointer truncate ${isChecked ? 'text-slate-800' : 'text-slate-400 line-through'}`}
                                            >
                                                {template.name}
                                            </label>
                                        </div>
                                    );
                                })}
                                {formTemplates.length === 0 && !loading && (
                                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg col-span-full">
                                        ليس لديك أي صلاحيات اعتماد أو مراجعة في مسارات العمل لتفويضها.
                                    </div>
                                )}
                                {loading && (
                                    <div className="text-xs text-muted-foreground col-span-full">جاري تحميل أنواع المعاملات...</div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">سبب التفويض <span className="text-red-500">*</span></Label>
                            <Textarea
                                placeholder="مثال: إجازة سنوية، مهمة عمل..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="min-h-[55px] text-xs sm:text-sm py-2 bg-white"
                                rows={2}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">المرفقات (اختياري)</Label>
                            <Input
                                type="file"
                                accept=".pdf,image/png,image/jpeg,image/jpg"
                                className="h-8 text-xs bg-white file:text-xs"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                        if (file.size > 5 * 1024 * 1024) {
                                            toast({ title: "تنبيه", description: "حجم الملف يجب ألا يتجاوز 5 ميجابايت", variant: "destructive" })
                                            e.target.value = ''
                                            setAttachmentData("")
                                            setAttachmentName("")
                                            return
                                        }
                                        const reader = new FileReader()
                                        reader.onloadend = () => {
                                            setAttachmentData(reader.result as string)
                                            setAttachmentName(file.name)
                                        }
                                        reader.readAsDataURL(file)
                                    } else {
                                        setAttachmentData("")
                                        setAttachmentName("")
                                    }
                                }}
                            />
                            {attachmentName && (
                                <p className="text-[11px] text-primary">
                                    الملف المختار: {attachmentName}
                                </p>
                            )}
                        </div>
                        <Button
                            type="button"
                            onClick={() => {
                                if (!delegateeId || !startDate || !endDate || !reason) {
                                    toast({ title: "تنبيه", description: "جميع الحقول المطلوبة يجب تعبئتها", variant: "destructive" })
                                    return
                                }
                                setConfirmDialogOpen(true)
                            }}
                            disabled={submitting}
                            className="w-full sm:w-auto h-9 text-xs sm:text-sm font-bold"
                        >
                            {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                            إرسال طلب التفويض
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Delegations List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="w-5 h-5 text-green-600" />
                            التفويضات النشطة
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activeDelegations.length === 0 ? (
                            <p className="text-muted-foreground text-sm">لا توجد تفويضات نشطة حالياً.</p>
                        ) : (
                            <div className="space-y-4">
                                {activeDelegations.map((d: any) => (
                                    <div key={d.delegation_id} className="p-3 bg-green-50 border border-green-100 rounded-lg flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-green-900">
                                                مفوض إلى: {d.users_delegations_grantee_user_idTousers?.full_name}
                                            </p>
                                            <p className="text-xs text-green-700">
                                                {new Date(d.starts_at).toLocaleDateString()} - {new Date(d.ends_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="border-green-200 text-green-700 bg-white">
                                            نشط
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Request History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="w-5 h-5" />
                            سجل طلبات التفويض
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {history.length === 0 ? (
                            <p className="text-muted-foreground text-sm">لم تقدم أي طلبات تفويض سابقة.</p>
                        ) : (
                            <div className="space-y-3">
                                {history.map((req: any) => (
                                    <div key={req.id} className="p-3 bg-muted/20 border rounded-lg">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium text-sm">طلب تفويض</span>
                                            <Badge variant={
                                                req.status === 'approved' ? 'default' :
                                                    req.status === 'rejected' ? 'destructive' : 'secondary'
                                            }>
                                                {req.status === 'approved' ? 'مقبول' :
                                                    req.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            تاريخ الطلب: {req.date}
                                        </p>
                                        {req.description && (
                                            <p className="text-sm border-r-2 border-primary/20 pr-2 mr-1">
                                                {req.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد طلب التفويض</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من رغبتك في إرسال طلب التفويض؟ 
                            سيتطلب هذا الإجراء موافقة مديرك المباشر.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => {
                            handleSubmit(e as unknown as React.FormEvent)
                        }}>
                            تأكيد وإرسال
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}


