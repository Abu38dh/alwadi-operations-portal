"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Plus, Edit2, Trash2, Save, X,
  GraduationCap, User, ChevronDown, Building2
} from "lucide-react"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import {
  getAllColleges, createCollege, updateCollege,
  deleteCollege, getDeanCandidates,
} from "@/app/actions/organizations"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { translateRole } from "@/lib/translations"

interface AdminCollegesPageProps {
  onBack: () => void
  currentUserId?: string
}

export default function AdminCollegesPage({ onBack, currentUserId }: AdminCollegesPageProps) {
  const [colleges, setColleges]     = useState<any[]>([])
  const [deans, setDeans]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete]     = useState<number | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState({ name: "", dean_id: null as number | null })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setError(null)
    try {
      const [cRes, dRes] = await Promise.all([getAllColleges(), getDeanCandidates()])
      if (cRes.success && cRes.data) setColleges(cRes.data)
      else setError(cRes.error || "فشل في تحميل الفروع والإدارات")
      if (dRes.success && dRes.data) setDeans(dRes.data)
    } catch { setError("حدث خطأ في الاتصال بقاعدة البيانات") }
    finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم الفرع / الإدارة", variant: "destructive" })
      return
    }
    try {
      const payload = { name: form.name, dean_id: form.dean_id ?? undefined }
      const result  = editingId
        ? await updateCollege(editingId, payload, currentUserId)
        : await createCollege(payload, currentUserId)
      if (result.success) {
        toast({ title: editingId ? "تم التحديث بنجاح" : "تمت الإضافة بنجاح" })
        cancelForm(); await fetchData()
      } else {
        toast({ title: "فشلت العملية", description: result.error, variant: "destructive" })
      }
    } catch { toast({ title: "خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" }) }
  }

  const handleEdit = (c: any) => {
    setEditingId(c.college_id)
    setForm({ name: c.name, dean_id: c.dean_id })
    setShowForm(true)
  }

  const handleDelete = (id: number) => { setToDelete(id); setDeleteOpen(true) }

  const executeDelete = async () => {
    if (!toDelete) return
    try {
      const result = await deleteCollege(toDelete, currentUserId)
      if (result.success) {
        toast({ title: "تم الحذف بنجاح" })
        setDeleteOpen(false); setToDelete(null); await fetchData()
      } else {
        toast({ title: "فشل الحذف", description: result.error, variant: "destructive" })
      }
    } catch { toast({ title: "خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" }) }
  }

  const cancelForm = () => {
    setForm({ name: "", dean_id: null })
    setShowForm(false)
    setEditingId(null)
  }

  const selectCls = `
    w-full px-3 py-2.5 text-sm rounded-xl border border-[#E2EDEC]
    bg-white text-[#1C2E2D] focus:outline-none focus:ring-2
    focus:ring-[#00A89D]/30 focus:border-[#00A89D]
    transition-all duration-150 appearance-none cursor-pointer
  `

  if (loading) return <div className="p-8" dir="rtl"><h1 className="text-2xl font-bold mb-6">إدارة الفروع والإدارات</h1><TableSkeleton /></div>
  if (error)   return <div className="p-8" dir="rtl"><h1 className="text-2xl font-bold mb-6">إدارة الفروع والإدارات</h1><ErrorMessage error={error} onRetry={fetchData} /></div>

  return (
    <div dir="rtl" className="min-h-full bg-white">

      {/* ══ Page Header ══ */}
      <div className="bg-white border-b border-[#E2EDEC] px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F7F6] flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-[#00A89D]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1C2E2D] leading-tight">إدارة الفروع والإدارات العامة</h1>
              <p className="text-sm text-[#6B8F8E] mt-0.5">{colleges.length} فرع / إدارة في النظام</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null) }}
            className="
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              bg-[#00A89D] text-white hover:bg-[#008A80] active:scale-95
              transition-all duration-150 shadow-sm shadow-[#00A89D]/20
            "
          >
            <Plus className="w-4 h-4" />
            فرع / إدارة جديدة
          </button>
        </div>
      </div>

      {/* ══ Body ══ */}
      <div className="px-8 py-6 space-y-5">

        {/* ── Add / Edit Form ── */}
        {showForm && (
          <div className="bg-white border border-[#B3E8E5] rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#E6F7F6] border-b border-[#B3E8E5]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#00A89D] flex items-center justify-center">
                  {editingId ? <Edit2 className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5 text-white" />}
                </div>
                <h2 className="text-sm font-semibold text-[#008A80]">
                  {editingId ? "تعديل بيانات الفرع" : "إضافة فرع / إدارة جديدة"}
                </h2>
              </div>
              <button
                onClick={cancelForm}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B8F8E] hover:bg-[#B3E8E5] hover:text-[#008A80] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Label className="text-xs font-semibold text-[#2D4847] mb-1.5 block">
                  اسم الفرع / الإدارة <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="مثال: الإدارة العامة / فرع المستودعات المركزية"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 rounded-xl border-[#E2EDEC] text-sm focus:border-[#00A89D] focus:ring-[#00A89D]/20"
                />
              </div>
              <div className="md:col-span-2 relative">
                <Label className="text-xs font-semibold text-[#2D4847] mb-1.5 block">المدير المسؤول (اختياري)</Label>
                <select
                  value={form.dean_id || ""}
                  onChange={(e) => setForm({ ...form, dean_id: e.target.value ? parseInt(e.target.value) : null })}
                  className={selectCls}
                >
                  <option value="">بدون مدير محدد</option>
                  {deans.map((d: any) => (
                    <option key={d.user_id} value={d.user_id}>
                      {d.full_name} ({translateRole(d.roles?.role_name)})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute left-3 top-[2.2rem] w-4 h-4 text-[#6B8F8E] pointer-events-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E2EDEC] flex items-center justify-end gap-3">
              <button
                onClick={cancelForm}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-[#E2EDEC] text-[#2D4847] hover:bg-gray-50 transition-colors"
              >إلغاء</button>
              <button
                onClick={handleSubmit}
                className="
                  flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                  bg-[#00A89D] text-white hover:bg-[#008A80] active:scale-95
                  transition-all duration-150 shadow-sm shadow-[#00A89D]/20
                "
              >
                <Save className="w-4 h-4" />
                {editingId ? "تحديث" : "إضافة"}
              </button>
            </div>
          </div>
        )}

        {/* ── Branches ── */}
        {colleges.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2EDEC] py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F7F6] flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-[#00A89D]" />
            </div>
            <p className="text-[#2D4847] font-semibold">لا توجد فروع أو إدارات</p>
            <p className="text-sm text-[#6B8F8E] mt-1">قم بإضافة فرع جديد للبدء</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#008A80] transition-colors"
            >
              <Plus className="w-4 h-4" /> إضافة فرع / إدارة
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {colleges.map((college: any) => {
              const deptCount = college.departments?.length || 0
              const deanName  = college.users?.full_name

              return (
                <div
                  key={college.college_id}
                  className="
                    group bg-white rounded-xl border border-[#E2EDEC]
                    hover:border-[#B3E8E5] hover:shadow-sm hover:shadow-[#00A89D]/10
                    transition-all duration-200
                  "
                >
                  <div className="p-4">
                    {/* Name + actions row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#E6F7F6] flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-[#00A89D]" />
                        </div>
                        <h3 className="text-sm font-bold text-[#1C2E2D] truncate leading-tight">
                          {college.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleEdit(college)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B8F8E] hover:bg-[#E6F7F6] hover:text-[#00A89D] transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(college.college_id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B8F8E] hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-1 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-[#6B8F8E]">
                        <User className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {deanName || <span className="text-[#9BB5B4]">المدير: غير محدد</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#6B8F8E]">
                        <Building2 className="w-3 h-3 shrink-0 text-[#00A89D]" />
                        <span className="font-medium text-[#2D4847]">{deptCount}</span>
                        <span>أقسام تابعة</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1C2E2D]">هل أنت متأكد من حذف هذا الفرع؟</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B8F8E]">
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف الفرع وجميع الأقسام التابعة له.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="rounded-xl bg-red-500 hover:bg-red-600 text-white">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
