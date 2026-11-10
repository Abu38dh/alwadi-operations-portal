"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Plus, Edit2, Trash2, Save, X,
  Building2, User, GraduationCap, Briefcase
} from "lucide-react"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment, getAllColleges } from "@/app/actions/organizations"
import { getUsers } from "@/app/actions/admin"
import { useToast } from "@/hooks/use-toast"
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
import { translateRole } from "@/lib/translations"

interface AdminDepartmentsPageProps {
  onBack: () => void
  currentUserId?: string
}

export default function AdminDepartmentsPage({ onBack, currentUserId }: AdminDepartmentsPageProps) {
  const [departments, setDepartments] = useState<any[]>([])
  const [colleges, setColleges] = useState<any[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedCollege, setSelectedCollege] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    dept_name: "",
    college_id: null as number | null,
    manager_id: null as number | null,
    is_academic: true,
  })

  useEffect(() => { fetchData() }, [currentUserId])

  const fetchData = async () => {
    setError(null)
    try {
      const [deptsResult, collegesResult, usersResult] = await Promise.all([
        getAllDepartments(),
        getAllColleges(),
        getUsers(1, 1000, currentUserId),
      ])
      if (deptsResult.success && deptsResult.data) setDepartments(deptsResult.data)
      else setError(deptsResult.error || "فشل في تحميل الأقسام")
      if (collegesResult.success && collegesResult.data) setColleges(collegesResult.data)
      if (usersResult.success && usersResult.data) {
        setManagers(usersResult.data.filter((u: any) => u.roles?.role_name?.toLowerCase() !== "student"))
      }
    } catch {
      setError("حدث خطأ في الاتصال بقاعدة البيانات")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.dept_name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم القسم", variant: "destructive" })
      return
    }
    try {
      const result = editingId
        ? await updateDepartment(editingId, { ...formData, college_id: formData.college_id ?? undefined }, currentUserId)
        : await createDepartment({ ...formData, college_id: formData.college_id, manager_id: formData.manager_id }, currentUserId)

      if (result.success) {
        toast({ title: editingId ? "تم التحديث بنجاح" : "تمت الإضافة بنجاح" })
        cancelForm()
        await fetchData()
      } else {
        toast({ title: "فشلت العملية", description: result.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const handleEdit = (dept: any) => {
    setEditingId(dept.department_id)
    setFormData({ dept_name: dept.dept_name, college_id: dept.college_id, manager_id: dept.manager_id, is_academic: dept.is_academic !== false })
    setShowAddForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = (id: number) => { setItemToDelete(id); setDeleteDialogOpen(true) }

  const executeDelete = async () => {
    if (!itemToDelete) return
    try {
      const result = await deleteDepartment(itemToDelete, currentUserId)
      if (result.success) {
        toast({ title: "تم الحذف بنجاح" })
        setDeleteDialogOpen(false)
        setItemToDelete(null)
        await fetchData()
      } else {
        toast({ title: "فشل الحذف", description: result.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const cancelForm = () => {
    setFormData({ dept_name: "", college_id: null, manager_id: null, is_academic: true })
    setShowAddForm(false)
    setEditingId(null)
  }

  const filteredDepartments = selectedCollege
    ? selectedCollege === "none"
      ? departments.filter((d) => !d.college_id)
      : departments.filter((d) => d.college_id === parseInt(selectedCollege))
    : departments



  if (loading) return (
    <div className="p-8" dir="rtl">
      <h1 className="text-2xl font-bold text-[#1C2E2D] mb-6">إدارة الأقسام</h1>
      <TableSkeleton />
    </div>
  )

  if (error) return (
    <div className="p-8" dir="rtl">
      <h1 className="text-2xl font-bold text-[#1C2E2D] mb-6">إدارة الأقسام</h1>
      <ErrorMessage error={error} onRetry={fetchData} />
    </div>
  )

  return (
    <div dir="rtl" className="min-h-full bg-white">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-[#E2EDEC] px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon badge */}
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-[#0B2545]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1C2E2D] leading-tight">إدارة الأقسام</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {departments.length} قسم في المنشأة
              </p>
            </div>
          </div>

          <button
            onClick={() => { setShowAddForm(true); setEditingId(null) }}
            className="
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              bg-[#0B2545] text-white
              hover:bg-[#061629] active:scale-95
              transition-all duration-150 shadow-sm shadow-[#0B2545]/20
            "
          >
            <Plus className="w-4 h-4" />
            قسم جديد
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-8 py-6 space-y-5">

        {/* ── Add / Edit Form ── */}
        {showAddForm && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            {/* Form header bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#0B2545] flex items-center justify-center">
                  {editingId ? <Edit2 className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5 text-white" />}
                </div>
                <h2 className="text-sm font-semibold text-[#0B2545]">
                  {editingId ? "تعديل بيانات القسم" : "إضافة قسم جديد"}
                </h2>
              </div>
              <button
                onClick={cancelForm}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form body */}
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Dept Name */}
              <div className="md:col-span-2">
                <Label className="text-xs font-semibold text-[#2D4847] mb-1.5 block">
                  اسم القسم <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="مثال: إدارة المستودعات المركزية"
                  value={formData.dept_name}
                  onChange={(e) => setFormData({ ...formData, dept_name: e.target.value })}
                  className="
                    h-10 rounded-xl border-[#E2EDEC] text-sm
                    focus:border-[#00A89D] focus:ring-[#00A89D]/20
                  "
                />
              </div>

              {/* Manager */}
              <div>
                <Label className="text-xs font-semibold text-[#2D4847] mb-1.5 block">مدير القسم / الإدارة (اختياري)</Label>
                <Select
                  value={formData.manager_id != null ? formData.manager_id.toString() : "__no_manager"}
                  onValueChange={(val) => setFormData({ ...formData, manager_id: val === "__no_manager" ? null : parseInt(val) })}
                  dir="rtl"
                >
                  <SelectTrigger className="w-full h-10 rounded-xl border-[#E2EDEC] text-sm">
                    <SelectValue placeholder="بدون مدير" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="__no_manager">بدون مدير</SelectItem>
                    {managers.map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id.toString()}>
                        {m.full_name} ({translateRole(m.roles?.role_name)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Form footer */}
            <div className="px-6 py-4 border-t border-[#E2EDEC] flex items-center justify-end gap-3">
              <button
                onClick={cancelForm}
                className="
                  px-4 py-2 rounded-xl text-sm font-medium
                  border border-[#E2EDEC] text-[#2D4847]
                  hover:bg-gray-50 transition-colors
                "
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                className="
                  flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                  bg-[#00A89D] text-white
                  hover:bg-[#008A80] active:scale-95
                  transition-all duration-150 shadow-sm shadow-[#00A89D]/20
                "
              >
                <Save className="w-4 h-4" />
                {editingId ? "تحديث" : "إضافة"}
              </button>
            </div>
          </div>
        )}

        {/* ── Filter ── */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#6B8F8E]">
            إجمالي الأقسام: {departments.length} قسم
          </span>
        </div>

        {/* ── Departments Grid ── */}
        {filteredDepartments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2EDEC] py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F7F6] flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-[#00A89D]" />
            </div>
            <p className="text-[#2D4847] font-semibold">لا توجد أقسام</p>
            <p className="text-sm text-[#6B8F8E] mt-1">قم بإضافة قسم جديد للبدء</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="
                mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                bg-[#00A89D] text-white hover:bg-[#008A80] transition-colors
              "
            >
              <Plus className="w-4 h-4" /> إضافة قسم
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map((dept: any) => {
              const isAcademic = dept.is_academic !== false
              const collegeName = colleges.find((c: any) => c.college_id === dept.college_id)?.name
              const managerName = dept.users_departments_manager_idTousers?.full_name

              return (
                <div
                  key={dept.department_id}
                  className="
                    group bg-white rounded-2xl border border-[#E2EDEC]
                    hover:border-[#B3E8E5] hover:shadow-md hover:shadow-[#00A89D]/8
                    transition-all duration-200 overflow-hidden
                  "
                >
                  {/* Card top accent */}
                  <div className="h-1 w-full bg-[#00A89D]" />

                  <div className="p-5">
                    {/* Title */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-sm font-bold text-[#1C2E2D] leading-snug flex-1">
                        {dept.dept_name}
                      </h3>
                      <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-[#E6F7F6] text-[#008A80] border-[#B3E8E5]">
                        قسم نشط
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[#6B8F8E]">
                        <User className="w-3.5 h-3.5 shrink-0 text-[#6B8F8E]" />
                        <span>المدير المسؤول: {managerName || <span className="text-[#9BB5B4]">غير محدد</span>}</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="mt-4 pt-3 border-t border-[#E2EDEC] flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="
                          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          text-[#00A89D] hover:bg-[#E6F7F6]
                          transition-colors duration-150
                        "
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(dept.department_id)}
                        className="
                          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          text-red-400 hover:bg-red-50 hover:text-red-500
                          transition-colors duration-150
                        "
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1C2E2D]">هل أنت متأكد من حذف هذا القسم؟</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B8F8E]">
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف القسم نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
