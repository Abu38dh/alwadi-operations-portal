"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAdminDelegations, adminCreateDelegation, adminRevokeDelegation, getApproversList } from "@/app/actions/admin"
import { getApprovableFormTemplates } from "@/app/actions/forms"
import { format } from "date-fns"
import { arSA } from "date-fns/locale"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Trash2, Plus, Calendar as CalendarIcon, ArrowRightLeft } from "lucide-react"

interface AdminDelegationsDialogProps {
  user: any
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}

export function AdminDelegationsDialog({ user, currentUserId, isOpen, onClose }: AdminDelegationsDialogProps) {
  const { toast } = useToast()
  const [delegations, setDelegations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [formTemplates, setFormTemplates] = useState<{ form_id: number, name: string }[]>([])
  const [colleagues, setColleagues] = useState<any[]>([])

  const [newDelegation, setNewDelegation] = useState({
    granteeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    selectedTypes: [] as number[],
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
      setShowHistory(false)
      const today = new Date()
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      setNewDelegation({
        granteeId: "",
        startDate: format(today, "yyyy-MM-dd"),
        endDate: format(nextWeek, "yyyy-MM-dd"),
        reason: "",
        selectedTypes: [],
      })
    }
  }, [isOpen, user?.user_id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [delRes, formsRes, usersRes] = await Promise.all([
        getAdminDelegations(user.user_id),
        getApprovableFormTemplates(user.university_id),
        getApproversList()
      ])

      if (delRes.success && delRes.data) {
        setDelegations(delRes.data)
      }
      if (formsRes.success && formsRes.data) {
        setFormTemplates(formsRes.data)
        // تحديد كافة المعاملات افتراضياً تلقائياً
        const allIds = formsRes.data.map((f: any) => f.form_id)
        setNewDelegation(prev => ({
          ...prev,
          selectedTypes: allIds
        }))
      }
      if (usersRes.success && usersRes.data) {
        // Filter out current user
        setColleagues(usersRes.data.users.filter((u: any) => u.user_id !== user.user_id))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newDelegation.granteeId || !newDelegation.startDate || !newDelegation.endDate || !newDelegation.reason) {
      toast({ title: " خطأ", description: "يرجى ملء جميع الحقول المطلوبة (المفوض إليه، التواريخ، السبب)", variant: "destructive" })
      return
    }

    // Verify dates
    const start = new Date(newDelegation.startDate)
    const end = new Date(newDelegation.endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (end < start) {
        toast({ title: " خطأ", description: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية", variant: "destructive" })
        return
    }

    if (newDelegation.selectedTypes.length === 0) {
        toast({ title: "تنبيه", description: "يرجى تحديد معاملة واحدة على الأقل للتفويض", variant: "destructive" })
        return
    }

    const isAllSelected = formTemplates.length > 0 && newDelegation.selectedTypes.length === formTemplates.length
    const delegatedTypesToSave = isAllSelected ? null : newDelegation.selectedTypes

    try {
      const res = await adminCreateDelegation(
        user.user_id,
        parseInt(newDelegation.granteeId),
        start,
        end,
        newDelegation.reason,
        delegatedTypesToSave,
        currentUserId
      )

      if (res.success) {
        toast({ title: " تم إنشاء التفويض بنجاح وتفعيل مهام البديل فوراً" })
        setNewDelegation({ granteeId: "", startDate: "", endDate: "", reason: "", selectedTypes: [] })
        onClose()
      } else {
        toast({ title: " خطأ", description: res.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const handleRevoke = async (delegationId: number) => {
    try {
      const res = await adminRevokeDelegation(delegationId, currentUserId)
      if (res.success) {
        toast({ title: " تم إلغاء التفويض بنجاح" })
        loadData()
      } else {
         toast({ title: " خطأ", description: res.error, variant: "destructive" })
      }
    } catch (err) {
       toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] p-3.5 sm:p-5 max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2.5 text-slate-800">
            <span className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4 text-[#C69214]" />
            </span>
            <span className="truncate">تفويض بديل عن: {user?.full_name}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3 pt-1">
            {/* Substitute Employee */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700" required>
                الموظف البديل (ينوب عنه)
              </Label>
              <Select
                value={newDelegation.granteeId}
                onValueChange={(val) => setNewDelegation({ ...newDelegation, granteeId: val })}
              >
                <SelectTrigger className="w-full h-9 text-xs bg-white border border-slate-200 rounded-xl px-3 text-right">
                  <SelectValue placeholder="اختر الموظف البديل..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {colleagues.map((c: any) => (
                    <SelectItem key={c.user_id} value={String(c.user_id)} className="text-xs">
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 flex flex-col">
                <Label className="text-xs font-semibold text-slate-700" required>تاريخ البداية</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-right font-normal border-slate-200 rounded-xl bg-white h-9 px-2.5 text-xs ${!newDelegation.startDate && "text-muted-foreground"}`}
                    >
                      <CalendarIcon className="ml-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {newDelegation.startDate ? (
                        format(new Date(newDelegation.startDate), "dd/MM/yyyy")
                      ) : (
                        <span>اختر البداية...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newDelegation.startDate ? new Date(newDelegation.startDate) : undefined}
                      onSelect={(date) => setNewDelegation({...newDelegation, startDate: date ? format(date, "yyyy-MM-dd") : ""})}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1 flex flex-col">
                <Label className="text-xs font-semibold text-slate-700" required>تاريخ النهاية</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-right font-normal border-slate-200 rounded-xl bg-white h-9 px-2.5 text-xs ${!newDelegation.endDate && "text-muted-foreground"}`}
                    >
                      <CalendarIcon className="ml-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {newDelegation.endDate ? (
                        format(new Date(newDelegation.endDate), "dd/MM/yyyy")
                      ) : (
                        <span>اختر النهاية...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newDelegation.endDate ? new Date(newDelegation.endDate) : undefined}
                      onSelect={(date) => setNewDelegation({...newDelegation, endDate: date ? format(date, "yyyy-MM-dd") : ""})}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Reason - Text input only */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700" required>سبب التفويض</Label>
              <Input 
                placeholder="اكتب سبب التفويض هنا (مثال: إجازة اعتيادية)..." 
                value={newDelegation.reason}
                onChange={e => setNewDelegation({...newDelegation, reason: e.target.value})}
                className="h-9 text-xs bg-white border-slate-200 rounded-xl"
              />
            </div>

            {/* Delegated Form Templates - Always Visible & All Checked by Default */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-800">المعاملات والصلاحيات المفوضة</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                    {newDelegation.selectedTypes.length === formTemplates.length ? "محددة بالكامل" : `${newDelegation.selectedTypes.length} من ${formTemplates.length} محددة`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setNewDelegation({ ...newDelegation, selectedTypes: formTemplates.map(f => f.form_id) })}
                    className="text-primary hover:underline font-medium"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setNewDelegation({ ...newDelegation, selectedTypes: [] })}
                    className="text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-tight">
                جميع المعاملات محددة افتراضياً. ألغِ إشارة الصح (✓) فقط عن المعاملات التي لا ترغب بتفويضها:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 max-h-40 overflow-y-auto">
                {formTemplates.map((template) => {
                  const isChecked = newDelegation.selectedTypes.includes(template.form_id);
                  return (
                    <label 
                      key={template.form_id} 
                      className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition-all cursor-pointer ${
                        isChecked 
                          ? 'bg-white border-[#C69214]/50 shadow-2xs text-slate-900 font-medium' 
                          : 'bg-slate-100/70 border-slate-200 text-slate-400'
                      }`}
                    >
                      <Checkbox 
                        id={`admin-type-${template.form_id}`} 
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewDelegation({
                              ...newDelegation,
                              selectedTypes: [...newDelegation.selectedTypes, template.form_id]
                            });
                          } else {
                            setNewDelegation({
                              ...newDelegation,
                              selectedTypes: newDelegation.selectedTypes.filter(id => id !== template.form_id)
                            });
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <span className={`truncate text-xs ${isChecked ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                        {template.name}
                      </span>
                    </label>
                  );
                })}
                {formTemplates.length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-full py-1">جاري تحميل المعاملات المتاحة...</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-xs rounded-xl">
                إلغاء
              </Button>
              <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-5 text-xs rounded-xl gap-1.5 shadow-sm">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                تأكيد وتفعيل التفويض
              </Button>
            </div>

            {/* Previous Delegations (if any) */}
            {delegations.length > 0 && (
              <div className="pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  {showHistory ? "إخفاء التفويضات السابقة" : `عرض التفويضات السابقة (${delegations.length})`}
                </button>
                {showHistory && (
                  <div className="mt-2 space-y-2 max-h-36 overflow-y-auto">
                    {delegations.map((d: any) => {
                      const isGrantor = d.grantor_user_id === user.user_id;
                      const otherPerson = isGrantor ? d.users_delegations_grantee_user_idTousers?.full_name : d.users_delegations_grantor_user_idTousers?.full_name;
                      return (
                        <div key={d.delegation_id} className={`p-2.5 rounded-lg border text-xs ${d.is_active ? 'border-primary/30 bg-primary/5' : 'bg-muted/30 border-muted'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {d.is_active ? 'نشط' : 'منتهي'}
                                </span>
                                <span className="font-semibold text-slate-800">{isGrantor ? `فوّض: ${otherPerson}` : `ينوب عن: ${otherPerson}`}</span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {format(new Date(d.starts_at), 'dd/MM/yyyy')} - {format(new Date(d.ends_at), 'dd/MM/yyyy')} • السبب: {d.reason}
                              </p>
                            </div>
                            {d.is_active && (
                              <Button variant="ghost" size="sm" onClick={() => handleRevoke(d.delegation_id)} className="text-rose-600 hover:bg-rose-50 h-7 px-2 text-xs">
                                إلغاء
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


