"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
    Plus, Trash2, Edit2, Save, X, BookOpen, Layers,
    GraduationCap, Users, Loader2, Building2, School,
    CalendarCheck, ArrowLeftRight, ChevronLeft, Eye, EyeOff
} from "lucide-react"
import {
    getCollegesWithDepartments, createLevel, updateLevel, deleteLevel,
    createLevelTerm, updateLevelTerm, deleteLevelTerm,
    createSubject, updateSubject, deleteSubject,
    graduateStudents, promoteStudentsToNextLevel,
    promoteStudentsToNextTerm, assignStudentsToTerm,
    promoteAllLevelsInDepartment, promoteAllStudentsGlobally
} from "@/app/actions/absences"
import {
    updateCollegeAbsenceVisibility,
    updateDepartmentAbsenceVisibility,
    updateLevelAbsenceVisibility
} from "@/app/actions/organizations"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { PromoteStudentsDialog, PromotionScope } from "./promote-students-dialog"

interface LevelsSubjectsManagerProps {
    onBack: () => void
    currentUserId?: string
}

// Navigation levels
type NavView = "colleges" | "departments" | "levels" | "terms" | "subjects"

export default function LevelsSubjectsManager({ currentUserId }: LevelsSubjectsManagerProps) {
    const { toast } = useToast()
    const [colleges, setColleges] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Drill-down navigation state
    const [view, setView] = useState<NavView>("colleges")
    const [selectedCollege, setSelectedCollege] = useState<any>(null)
    const [selectedDept, setSelectedDept] = useState<any>(null)
    const [selectedLevel, setSelectedLevel] = useState<any>(null)
    const [selectedTerm, setSelectedTerm] = useState<any>(null)

    // Inline forms
    const [addingLevel, setAddingLevel] = useState(false)
    const [newLevelName, setNewLevelName] = useState("")
    const [newLevelOrder, setNewLevelOrder] = useState(1)
    const [savingLevel, setSavingLevel] = useState(false)

    const [editingLevelId, setEditingLevelId] = useState<number | null>(null)
    const [editLevelName, setEditLevelName] = useState("")
    const [editLevelOrder, setEditLevelOrder] = useState(0)

    const [addingTerm, setAddingTerm] = useState(false)
    const [newTermName, setNewTermName] = useState("")
    const [newTermOrder, setNewTermOrder] = useState(1)
    const [savingTerm, setSavingTerm] = useState(false)

    const [editingTermId, setEditingTermId] = useState<number | null>(null)
    const [editTermName, setEditTermName] = useState("")
    const [editTermOrder, setEditTermOrder] = useState(0)

    const [addingSubject, setAddingSubject] = useState(false)
    const [newSubjectName, setNewSubjectName] = useState("")
    const [newSubjectCode, setNewSubjectCode] = useState("")

    const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null)
    const [editSubjectName, setEditSubjectName] = useState("")
    const [editSubjectCode, setEditSubjectCode] = useState("")

    const [graduateDialog, setGraduateDialog] = useState<{
        levelId: number; levelName: string
    } | null>(null)
    // Term-level promotion
    const [promoteTermDialog, setPromoteTermDialog] = useState<{
        fromTermId: number; toTermId: number; fromName: string; toName: string
    } | null>(null)
    const [assignTermDialog, setAssignTermDialog] = useState<{
        levelId: number; levelName: string; terms: any[]
    } | null>(null)
    const [assignTermId, setAssignTermId] = useState<number | null>(null)
    const [academicYear, setAcademicYear] = useState(
        `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    )
    const [migrating, setMigrating] = useState(false)

    const [deleteLevel_, setDeleteLevel_] = useState<number | null>(null)
    const [deleteTerm_, setDeleteTerm_] = useState<number | null>(null)
    const [deleteSubject_, setDeleteSubject_] = useState<number | null>(null)
    
    const [selectivePromoteDialog, setSelectivePromoteDialog] = useState<{
        isOpen: boolean;
        scope: PromotionScope;
        scopeId?: number;
        title: string;
        fromLevelId?: number;
        toLevelId?: number;
    }>({
        isOpen: false,
        scope: 'global',
        title: ''
    })

    const load = async () => {
        setLoading(true)
        const res = await getCollegesWithDepartments(currentUserId)
        if (res.success) {
            const data = res.data ?? []
            setColleges(data)

            // Refresh embedded selected objects after reload
            if (selectedCollege) {
                const updatedCollege = data.find((c: any) => c.college_id === selectedCollege.college_id)
                if (updatedCollege) {
                    setSelectedCollege(updatedCollege)
                    if (selectedDept) {
                        const updatedDept = updatedCollege.departments?.find((d: any) => d.department_id === selectedDept.department_id)
                        if (updatedDept) {
                            setSelectedDept(updatedDept)
                            if (selectedLevel) {
                                const updatedLevel = updatedDept.levels?.find((l: any) => l.level_id === selectedLevel.level_id)
                                if (updatedLevel) {
                                    setSelectedLevel(updatedLevel)
                                    if (selectedTerm) {
                                        const updatedTerm = updatedLevel.terms?.find((t: any) => t.term_id === selectedTerm.term_id)
                                        if (updatedTerm) setSelectedTerm(updatedTerm)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    // CRUD handlers
    const handleAddLevel = async () => {
        if (!newLevelName.trim()) return toast({ title: "اسم التصنيف مطلوب", variant: "destructive" })
        setSavingLevel(true)
        const res = await createLevel(newLevelName.trim(), newLevelOrder, selectedDept.department_id)
        setSavingLevel(false)
        if (res.success) {
            toast({ title: "تم إضافة التصنيف بنجاح" })
            setNewLevelName(""); 
            setAddingLevel(false);
            setNewLevelOrder((selectedDept.levels?.length ?? 0) + 2); // Set for next one
            load()
        } else {
            toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
        }
    }

    const handleUpdateLevel = async (levelId: number) => {
        const res = await updateLevel(levelId, editLevelName, editLevelOrder)
        if (res.success) {
            toast({ title: "تم التحديث" })
            setEditingLevelId(null)
            load()
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handleDeleteLevel = async () => {
        if (!deleteLevel_) return
        const res = await deleteLevel(deleteLevel_)
        if (res.success) {
            toast({ title: "تم حذف التصنيف" })
            setDeleteLevel_(null)
            load()
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handleAddTerm = async () => {
        if (!newTermName.trim()) return toast({ title: "اسم الفصل مطلوب", variant: "destructive" })
        setSavingTerm(true)
        const res = await createLevelTerm(newTermName.trim(), newTermOrder, selectedLevel.level_id)
        setSavingTerm(false)
        if (res.success) {
            toast({ title: "تم إضافة الفصل الدراسي" })
            setNewTermName(""); setNewTermOrder(1); setAddingTerm(false)
            load()
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handleUpdateTerm = async (termId: number) => {
        const res = await updateLevelTerm(termId, editTermName, editTermOrder)
        if (res.success) {
            toast({ title: "تم التحديث" })
            setEditingTermId(null)
            load()
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handleDeleteTerm = async () => {
        if (!deleteTerm_) return
        const res = await deleteLevelTerm(deleteTerm_)
        if (res.success) {
            toast({ title: "تم حذف الفصل الدراسي" })
            setDeleteTerm_(null)
            load()
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handleAddSubject = async () => {
        if (!newSubjectName.trim()) return toast({ title: "اسم المادة مطلوب", variant: "destructive" })
        const res = await createSubject(selectedTerm.term_id, newSubjectName.trim(), newSubjectCode.trim() || undefined)
        if (res.success) {
            toast({ title: "تم إضافة المادة" })
            setNewSubjectName(""); setNewSubjectCode(""); setAddingSubject(false)
            load()
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handleUpdateSubject = async (subjectId: number) => {
        const res = await updateSubject(subjectId, editSubjectName, editSubjectCode || undefined)
        if (res.success) {
            toast({ title: "تم تحديث المادة" })
            setEditingSubjectId(null)
            load()
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handleDeleteSubject = async () => {
        if (!deleteSubject_) return
        const res = await deleteSubject(deleteSubject_)
        if (res.success) {
            toast({ title: "تم حذف المادة" })
            setDeleteSubject_(null)
            load()
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handlePromoteConfirmation = async (selectedIds: number[]) => {
        if (selectivePromoteDialog.scope === 'level') {
            if (!selectivePromoteDialog.fromLevelId || !selectivePromoteDialog.toLevelId) return
            const res = await promoteStudentsToNextLevel(selectivePromoteDialog.fromLevelId, selectivePromoteDialog.toLevelId, selectedIds)
            if (res.success) {
                toast({ title: `تم ترقية ${(res as any).count} موظف` })
            } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
        } else if (selectivePromoteDialog.scope === 'department') {
            if (!selectivePromoteDialog.scopeId) return
            const res = await promoteAllLevelsInDepartment(selectivePromoteDialog.scopeId, selectedIds)
            if (res.success) {
                toast({ title: `تمت الترقية الجماعية — ${(res as any).count} موظف انتقل لتصنيف أعلى` })
            } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
        } else if (selectivePromoteDialog.scope === 'global') {
            const res = await promoteAllStudentsGlobally(selectedIds)
            if (res.success) {
                toast({ title: `اكتملت الترقية الشاملة — ${(res as any).count} موظف انتقل لتصنيف أعلى` })
            } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
        }
        setSelectivePromoteDialog(prev => ({ ...prev, isOpen: false }))
        load()
    }

    const handleGraduate = async () => {
        if (!graduateDialog) return
        setMigrating(true)
        const res = await graduateStudents(graduateDialog.levelId, academicYear)
        setMigrating(false)
        if (res.success) {
            toast({ title: `تم أرشفة ${(res as any).count} موظف` })
            setGraduateDialog(null)
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handlePromoteTerm = async () => {
        if (!promoteTermDialog) return
        setMigrating(true)
        const res = await promoteStudentsToNextTerm(promoteTermDialog.fromTermId, promoteTermDialog.toTermId)
        setMigrating(false)
        if (res.success) {
            toast({ title: `تم نقل ${(res as any).count} موظف إلى ${promoteTermDialog.toName}` })
            setPromoteTermDialog(null)
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }

    const handleAssignTerm = async () => {
        if (!assignTermDialog || !assignTermId) return
        setMigrating(true)
        const res = await assignStudentsToTerm(assignTermDialog.levelId, assignTermId)
        setMigrating(false)
        if (res.success) {
            toast({ title: `تم تعيين الفصل الدراسي لـ ${(res as any).count} موظف` })
            setAssignTermDialog(null)
            setAssignTermId(null)
        } else toast({ title: "خطأ", description: (res as any).error, variant: "destructive" })
    }



    // Breadcrumb items based on current view
    const breadcrumbs = [
        { label: "الفروع", view: "colleges" as NavView },
        ...(selectedCollege ? [{ label: selectedCollege.name, view: "departments" as NavView }] : []),
        ...(selectedDept ? [{ label: selectedDept.dept_name, view: "levels" as NavView }] : []),
        ...(selectedLevel ? [{ label: selectedLevel.name, view: "terms" as NavView }] : []),
        ...(selectedTerm ? [{ label: selectedTerm.name, view: "subjects" as NavView }] : []),
    ]

    const navigateTo = (v: NavView) => {
        setView(v)
        setAddingLevel(false); setAddingTerm(false); setAddingSubject(false)
        setEditingLevelId(null); setEditingTermId(null); setEditingSubjectId(null)
        if (v === "colleges") { setSelectedCollege(null); setSelectedDept(null); setSelectedLevel(null); setSelectedTerm(null) }
        if (v === "departments") { setSelectedDept(null); setSelectedLevel(null); setSelectedTerm(null) }
        if (v === "levels") { setSelectedLevel(null); setSelectedTerm(null) }
        if (v === "terms") { setSelectedTerm(null) }
    }

    return (
        <div className="p-6 space-y-6" dir="rtl">
            {/* Page Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-foreground">التصنيفات والمواد الدراسية</h1>
                    <p className="text-lg text-muted-foreground mt-2">إدارة الهيكل الإداري لفرعك / إدارتك</p>
                </div>
                {colleges.length > 0 && (
                    <Button
                        variant="outline"
                        className="gap-2 border-red-300 text-red-700 hover:bg-red-50 shrink-0 mt-1"
                        onClick={() => setSelectivePromoteDialog({
                            isOpen: true,
                            scope: 'global',
                            title: `ترقية شاملة لكل الشركة`
                        })}
                    >
                        <GraduationCap className="w-4 h-4" />
                        ترقية كل الشركة
                    </Button>
                )}
            </div>

            {/* Breadcrumb Trail */}
            {breadcrumbs.length > 0 && (
                <nav className="flex items-center gap-1 flex-wrap">
                    {breadcrumbs.map((crumb, idx) => {
                        const isLast = idx === breadcrumbs.length - 1
                        return (
                            <div key={crumb.view} className="flex items-center gap-1">
                                {idx > 0 && <ChevronLeft className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
                                {isLast ? (
                                    <span className="text-sm font-bold text-foreground bg-primary/10 px-3 py-1 rounded-full">
                                        {crumb.label}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => navigateTo(crumb.view)}
                                        className="text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-1 rounded-full hover:bg-muted"
                                    >
                                        {crumb.label}
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </nav>
            )}

            {/* Content Area */}
            {loading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" /> جارٍ تحميل البيانات...
                </div>
            ) : (
                <>
                    {/* ====== COLLEGES VIEW ====== */}
                    {view === "colleges" && (
                        <div className="space-y-3">
                            {colleges.length === 0 ? (
                                <Card>
                                    <CardContent className="py-16 text-center text-muted-foreground">
                                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">لا توجد فروع مسجّلة</p>
                                        <p className="text-xs mt-1">يمكنك إضافة الفروع من صفحة &quot;إدارة التنظيم&quot;.</p>
                                    </CardContent>
                                </Card>
                            ) : colleges.map((college: any) => (
                                <Card key={college.college_id} className="border-0 shadow-sm hover:shadow-md transition-all">
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Building2 className="w-6 h-6 text-primary" />
                                        </div>
                                        <button
                                            className="flex-1 text-right"
                                            onClick={() => { setSelectedCollege(college); setView("departments") }}
                                        >
                                            <p className="text-lg font-bold text-foreground hover:text-primary transition-colors">{college.name}</p>
                                            <p className="text-sm text-muted-foreground mt-0.5">{college.departments?.length ?? 0} قسم إداري</p>
                                        </button>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation()
                                                const newVal = !college.show_absences
                                                // Optimistic update
                                                setColleges(prev => prev.map(c => 
                                                    c.college_id === college.college_id ? { ...c, show_absences: newVal } : c
                                                ))
                                                if (selectedCollege?.college_id === college.college_id) {
                                                    setSelectedCollege((prev: any) => prev ? { ...prev, show_absences: newVal } : null)
                                                }
                                                
                                                await updateCollegeAbsenceVisibility(college.college_id, newVal)
                                                toast({ title: newVal ? "تم إظهار السجلات للفرع" : "تم إخفاء السجلات عن الفرع" })
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                                college.show_absences
                                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                            }`}
                                            title={college.show_absences ? 'إخفاء السجلات عن موظفين الفرع' : 'إظهار السجلات لموظفين الفرع'}
                                        >
                                            {college.show_absences ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                            {college.show_absences ? 'ظاهر' : 'مخفي'}
                                        </button>
                                        <button
                                            onClick={() => { setSelectedCollege(college); setView("departments") }}
                                            className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium shrink-0"
                                        >
                                            فتح الأقسام ←
                                        </button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* ====== DEPARTMENTS VIEW ====== */}
                    {view === "departments" && selectedCollege && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-primary" />
                                    أقسام فرع {selectedCollege.name}
                                </h2>
                            </div>
                            {(selectedCollege.departments ?? []).length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        <School className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p>لا توجد أقسام في هذه الفرع</p>
                                    </CardContent>
                                </Card>
                            ) : (selectedCollege.departments ?? []).map((dept: any) => (
                                <Card key={dept.department_id} className="border-0 shadow-sm hover:shadow-md transition-all">
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                                            <School className="w-5 h-5 text-violet-600" />
                                        </div>
                                        <button className="flex-1 text-right" onClick={() => { setSelectedDept(dept); setView("levels") }}>
                                            <p className="text-base font-bold text-foreground hover:text-violet-700 transition-colors">{dept.dept_name}</p>
                                            <p className="text-sm text-muted-foreground mt-0.5">{dept.levels?.length ?? 0} تصنيف دراسي</p>
                                        </button>
                                        {selectedCollege.show_absences ? (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation()
                                                    const newVal = !dept.show_absences
                                                    // Optimistic update
                                                    setColleges(prev => prev.map(c => 
                                                        c.college_id === selectedCollege.college_id
                                                        ? { ...c, departments: c.departments.map((d: any) => d.department_id === dept.department_id ? { ...d, show_absences: newVal } : d) }
                                                        : c
                                                    ))
                                                    setSelectedCollege((prev: any) => prev ? {
                                                        ...prev,
                                                        departments: prev.departments.map((d: any) => d.department_id === dept.department_id ? { ...d, show_absences: newVal } : d)
                                                    } : null)
                                                    if (selectedDept?.department_id === dept.department_id) {
                                                        setSelectedDept((prev: any) => prev ? { ...prev, show_absences: newVal } : null)
                                                    }
                                                    
                                                    await updateDepartmentAbsenceVisibility(dept.department_id, newVal)
                                                    toast({ title: newVal ? "تم إظهار السجلات للقسم" : "تم إخفاء السجلات عن القسم" })
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                                    dept.show_absences
                                                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                                }`}
                                            >
                                                {dept.show_absences ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                {dept.show_absences ? 'ظاهر' : 'مخفي'}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">الفرع مخفية</span>
                                        )}
                                        <button onClick={() => { setSelectedDept(dept); setView("levels") }} className="text-sm text-muted-foreground hover:text-violet-600 transition-colors font-medium shrink-0">
                                            فتح التصنيفات ←
                                        </button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* ====== LEVELS VIEW ====== */}
                    {view === "levels" && selectedDept && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-blue-600" />
                                    تصنيفات قسم {selectedDept.dept_name}
                                </h2>
                                <div className="flex gap-2">
                                    {(selectedDept.levels ?? []).length >= 2 && (
                                        <Button
                                            variant="outline"
                                            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                                            onClick={() => setSelectivePromoteDialog({
                                                isOpen: true,
                                                scope: 'department',
                                                scopeId: selectedDept.department_id,
                                                title: `ترقية جميع تصنيفات قسم ${selectedDept.dept_name}`
                                            })}
                                        >
                                            <GraduationCap className="w-4 h-4" />
                                            ترقية جميع التصنيفات
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => {
                                            setAddingLevel(true);
                                            setNewLevelOrder((selectedDept.levels?.length ?? 0) + 1);
                                        }}
                                        className="gap-2"
                                        disabled={addingLevel}
                                    >
                                        <Plus className="w-4 h-4" />
                                        إضافة تصنيف جديد
                                    </Button>
                                </div>
                            </div>

                            {addingLevel && (
                                <Card className="border-2 border-dashed border-blue-300 bg-blue-50/30">
                                    <CardContent className="p-4">
                                        <p className="text-sm font-semibold text-blue-800 mb-3">تصنيف دراسي جديد</p>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <Label className="text-xs mb-1 block text-muted-foreground">اسم التصنيف</Label>
                                                <Input
                                                    placeholder="مثال: التصنيف الأول"
                                                    value={newLevelName}
                                                    onChange={e => setNewLevelName(e.target.value)}
                                                    onKeyDown={e => e.key === "Enter" && handleAddLevel()}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="w-28">
                                                <Label className="text-xs mb-1 block text-muted-foreground">رقم الترتيب</Label>
                                                <Input
                                                    type="number"
                                                    value={newLevelOrder}
                                                    onChange={e => setNewLevelOrder(parseInt(e.target.value) || 1)}
                                                    min={1}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <Button onClick={handleAddLevel} disabled={savingLevel} className="gap-1.5">
                                                {savingLevel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                حفظ التصنيف
                                            </Button>
                                            <Button variant="ghost" onClick={() => { setAddingLevel(false); setNewLevelName("") }}>إلغاء</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {(selectedDept.levels ?? []).length === 0 && !addingLevel ? (
                                <Card>
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        <Layers className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p>لا توجد تصنيفات في هذا القسم</p>
                                        <p className="text-xs mt-1">اضغط &quot;إضافة تصنيف جديد&quot; للبدء</p>
                                    </CardContent>
                                </Card>
                            ) : (selectedDept.levels ?? []).map((level: any, idx: number) => (
                                <Card key={level.level_id} className="border-0 shadow-sm overflow-hidden">
                                    <CardContent className="p-0">
                                        {editingLevelId === level.level_id ? (
                                            <div className="p-4 bg-blue-50/50 flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <Label className="text-xs mb-1 block text-muted-foreground">اسم التصنيف</Label>
                                                    <Input value={editLevelName} onChange={e => setEditLevelName(e.target.value)} autoFocus />
                                                </div>
                                                <div className="w-28">
                                                    <Label className="text-xs mb-1 block text-muted-foreground">الترتيب</Label>
                                                    <Input type="number" value={editLevelOrder} onChange={e => setEditLevelOrder(parseInt(e.target.value) || 1)} />
                                                </div>
                                                <Button onClick={() => handleUpdateLevel(level.level_id)} className="gap-1.5">
                                                    <Save className="w-4 h-4" /> حفظ
                                                </Button>
                                                <Button variant="ghost" onClick={() => setEditingLevelId(null)} className="gap-1.5">
                                                    <X className="w-4 h-4" /> إلغاء
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4 p-4">
                                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 text-sm font-bold text-blue-700">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-800">{level.name}</p>
                                                    <div className="flex gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs gap-1 border-blue-200 text-blue-700">
                                                            <CalendarCheck className="w-3 h-3" /> {level.terms?.length ?? 0} فصل
                                                        </Badge>
                                                        <Badge variant="outline" className="text-xs gap-1 border-blue-200 text-blue-700">
                                                            <Users className="w-3 h-3" /> {level._count?.users ?? 0} موظف
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {(selectedCollege?.show_absences && selectedDept?.show_absences) ? (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation()
                                                            const newVal = !level.show_absences
                                                            // Optimistic update
                                                            setColleges(prev => prev.map(c => 
                                                                c.college_id === selectedCollege.college_id
                                                                ? {
                                                                    ...c,
                                                                    departments: c.departments.map((d: any) => 
                                                                        d.department_id === selectedDept.department_id 
                                                                        ? { ...d, levels: d.levels.map((l: any) => l.level_id === level.level_id ? { ...l, show_absences: newVal } : l) }
                                                                        : d
                                                                    )
                                                                  }
                                                                : c
                                                            ))
                                                            setSelectedCollege((prev: any) => prev ? {
                                                                ...prev,
                                                                departments: prev.departments.map((d: any) => 
                                                                    d.department_id === selectedDept.department_id 
                                                                    ? { ...d, levels: d.levels.map((l: any) => l.level_id === level.level_id ? { ...l, show_absences: newVal } : l) }
                                                                    : d
                                                                )
                                                            } : null)
                                                            setSelectedDept((prev: any) => prev ? {
                                                                ...prev,
                                                                levels: prev.levels.map((l: any) => l.level_id === level.level_id ? { ...l, show_absences: newVal } : l)
                                                            } : null)
                                                            if (selectedLevel?.level_id === level.level_id) {
                                                                setSelectedLevel((prev: any) => prev ? { ...prev, show_absences: newVal } : null)
                                                            }
                                                            
                                                            await updateLevelAbsenceVisibility(level.level_id, newVal)
                                                            toast({ title: newVal ? "تم إظهار السجلات للتصنيف" : "تم إخفاء السجلات عن التصنيف" })
                                                        }}
                                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                                            level.show_absences
                                                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                                        }`}
                                                    >
                                                        {level.show_absences ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                                        {level.show_absences ? 'ظاهر' : 'مخفي'}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                                                        {!selectedCollege?.show_absences ? 'الفرع مخفية' : 'القسم مخفي'}
                                                    </span>
                                                )}
                                                    {idx < (selectedDept.levels ?? []).length - 1 && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                                            onClick={() => setSelectivePromoteDialog({
                                                                isOpen: true,
                                                                scope: 'level',
                                                                scopeId: level.level_id,
                                                                title: `ترقية موظفين ${level.name} إلى ${selectedDept.levels[idx + 1].name}`,
                                                                fromLevelId: level.level_id,
                                                                toLevelId: selectedDept.levels[idx + 1].level_id
                                                            })}
                                                        >
                                                            <ArrowLeftRight className="w-3 h-3" /> ترقية الموظفين
                                                        </Button>
                                                    )}
                                                    {idx === (selectedDept.levels ?? []).length - 1 && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                                            onClick={() => setGraduateDialog({ levelId: level.level_id, levelName: level.name })}
                                                        >
                                                            <GraduationCap className="w-3 h-3" /> أرشفة
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm" variant="outline"
                                                        className="gap-1.5 text-xs"
                                                        onClick={() => { setEditingLevelId(level.level_id); setEditLevelName(level.name); setEditLevelOrder(level.order) }}
                                                    >
                                                        <Edit2 className="w-3 h-3" /> تعديل
                                                    </Button>
                                                    <Button
                                                        size="sm" variant="outline"
                                                        className="gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                                        onClick={() => setDeleteLevel_(level.level_id)}
                                                    >
                                                        <Trash2 className="w-3 h-3" /> حذف
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="gap-1.5 text-xs"
                                                        onClick={() => { setSelectedLevel(level); setView("terms") }}
                                                    >
                                                        فتح الفصول ←
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* ====== TERMS VIEW ====== */}
                    {view === "terms" && selectedLevel && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <CalendarCheck className="w-5 h-5 text-indigo-600" />
                                    فصول {selectedLevel.name}
                                </h2>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                                        onClick={() => setAssignTermDialog({
                                            levelId: selectedLevel.level_id,
                                            levelName: selectedLevel.name,
                                            terms: selectedLevel.terms ?? []
                                        })}
                                        disabled={(selectedLevel.terms ?? []).length === 0}
                                    >
                                        <ArrowLeftRight className="w-4 h-4" />
                                        تعيين فصل للموظفين
                                    </Button>
                                    <Button onClick={() => setAddingTerm(true)} className="gap-2" disabled={addingTerm}>
                                        <Plus className="w-4 h-4" /> إضافة فترة تشغيلية
                                    </Button>
                                </div>
                            </div>

                            {addingTerm && (
                                <Card className="border-2 border-dashed border-indigo-300 bg-indigo-50/30">
                                    <CardContent className="p-4">
                                        <p className="text-sm font-semibold text-indigo-800 mb-3">فترة تشغيلية جديد</p>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <Label className="text-xs mb-1 block text-muted-foreground">اسم الفصل</Label>
                                                <Input
                                                    placeholder="مثال: الفصل الأول"
                                                    value={newTermName}
                                                    onChange={e => setNewTermName(e.target.value)}
                                                    onKeyDown={e => e.key === "Enter" && handleAddTerm()}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="w-28">
                                                <Label className="text-xs mb-1 block text-muted-foreground">الترتيب</Label>
                                                <Input type="number" value={newTermOrder} onChange={e => setNewTermOrder(parseInt(e.target.value) || 1)} min={1} />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <Button onClick={handleAddTerm} disabled={savingTerm} className="gap-1.5">
                                                {savingTerm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                حفظ الفصل
                                            </Button>
                                            <Button variant="ghost" onClick={() => { setAddingTerm(false); setNewTermName("") }}>إلغاء</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {(selectedLevel.terms ?? []).length === 0 && !addingTerm ? (
                                <Card>
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p>لا توجد فصول دراسية في هذا التصنيف</p>
                                        <p className="text-xs mt-1">اضغط &quot;إضافة فترة تشغيلية&quot; للبدء</p>
                                    </CardContent>
                                </Card>
                            ) : (selectedLevel.terms ?? []).map((term: any, idx: number) => (
                                <Card key={term.term_id} className="border-0 shadow-sm overflow-hidden">
                                    <CardContent className="p-0">
                                        {editingTermId === term.term_id ? (
                                            <div className="p-4 bg-indigo-50/50 flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <Label className="text-xs mb-1 block text-muted-foreground">اسم الفصل</Label>
                                                    <Input value={editTermName} onChange={e => setEditTermName(e.target.value)} autoFocus />
                                                </div>
                                                <div className="w-28">
                                                    <Label className="text-xs mb-1 block text-muted-foreground">الترتيب</Label>
                                                    <Input type="number" value={editTermOrder} onChange={e => setEditTermOrder(parseInt(e.target.value) || 1)} />
                                                </div>
                                                <Button onClick={() => handleUpdateTerm(term.term_id)} className="gap-1.5">
                                                    <Save className="w-4 h-4" /> حفظ
                                                </Button>
                                                <Button variant="ghost" onClick={() => setEditingTermId(null)} className="gap-1.5">
                                                    <X className="w-4 h-4" /> إلغاء
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4 p-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-700">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-800">{term.name}</p>
                                                    <p className="text-sm text-muted-foreground mt-0.5">{term.subjects?.length ?? 0} مادة دراسية</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* Move students to next term */}
                                                    {idx < (selectedLevel.terms ?? []).length - 1 && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                                            onClick={() => setPromoteTermDialog({
                                                                fromTermId: term.term_id,
                                                                toTermId: selectedLevel.terms[idx + 1].term_id,
                                                                fromName: term.name,
                                                                toName: selectedLevel.terms[idx + 1].name
                                                            })}
                                                        >
                                                            <ArrowLeftRight className="w-3 h-3" /> نقل الموظفين للفصل التالي
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm" variant="outline"
                                                        className="gap-1.5 text-xs"
                                                        onClick={() => { setEditingTermId(term.term_id); setEditTermName(term.name); setEditTermOrder(term.order) }}
                                                    >
                                                        <Edit2 className="w-3 h-3" /> تعديل
                                                    </Button>
                                                    <Button
                                                        size="sm" variant="outline"
                                                        className="gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                                        onClick={() => setDeleteTerm_(term.term_id)}
                                                    >
                                                        <Trash2 className="w-3 h-3" /> حذف
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="gap-1.5 text-xs"
                                                        onClick={() => { setSelectedTerm(term); setView("subjects") }}
                                                    >
                                                        فتح المواد ←
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* ====== SUBJECTS VIEW ====== */}
                    {view === "subjects" && selectedTerm && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-emerald-600" />
                                    مواد {selectedTerm.name}
                                </h2>
                                <Button onClick={() => setAddingSubject(true)} className="gap-2" disabled={addingSubject}>
                                    <Plus className="w-4 h-4" /> إضافة مادة
                                </Button>
                            </div>

                            {addingSubject && (
                                <Card className="border-2 border-dashed border-emerald-300 bg-emerald-50/30">
                                    <CardContent className="p-4">
                                        <p className="text-sm font-semibold text-emerald-800 mb-3">مادة دراسية جديدة</p>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <Label className="text-xs mb-1 block text-muted-foreground">اسم المادة *</Label>
                                                <Input
                                                    placeholder="مثال: رياضيات متقدمة"
                                                    value={newSubjectName}
                                                    onChange={e => setNewSubjectName(e.target.value)}
                                                    onKeyDown={e => e.key === "Enter" && handleAddSubject()}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="w-36">
                                                <Label className="text-xs mb-1 block text-muted-foreground">رمز المادة (اختياري)</Label>
                                                <Input placeholder="مثال: MATH301" value={newSubjectCode} onChange={e => setNewSubjectCode(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <Button onClick={handleAddSubject} className="gap-1.5">
                                                <Save className="w-4 h-4" /> حفظ المادة
                                            </Button>
                                            <Button variant="ghost" onClick={() => { setAddingSubject(false); setNewSubjectName(""); setNewSubjectCode("") }}>إلغاء</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {(selectedTerm.subjects ?? []).length === 0 && !addingSubject ? (
                                <Card>
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p>لا توجد مواد في هذا الفصل</p>
                                        <p className="text-xs mt-1">اضغط &quot;إضافة مادة&quot; للبدء</p>
                                    </CardContent>
                                </Card>
                            ) : (selectedTerm.subjects ?? []).map((subject: any, idx: number) => (
                                <Card key={subject.subject_id} className="border-0 shadow-sm overflow-hidden">
                                    <CardContent className="p-0">
                                        {editingSubjectId === subject.subject_id ? (
                                            <div className="p-4 bg-emerald-50/50 flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <Label className="text-xs mb-1 block text-muted-foreground">اسم المادة</Label>
                                                    <Input value={editSubjectName} onChange={e => setEditSubjectName(e.target.value)} autoFocus />
                                                </div>
                                                <div className="w-36">
                                                    <Label className="text-xs mb-1 block text-muted-foreground">الرمز (اختياري)</Label>
                                                    <Input value={editSubjectCode} onChange={e => setEditSubjectCode(e.target.value)} placeholder="مثال: MATH301" />
                                                </div>
                                                <Button onClick={() => handleUpdateSubject(subject.subject_id)} className="gap-1.5">
                                                    <Save className="w-4 h-4" /> حفظ
                                                </Button>
                                                <Button variant="ghost" onClick={() => setEditingSubjectId(null)} className="gap-1.5">
                                                    <X className="w-4 h-4" /> إلغاء
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4 p-4">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                                    <BookOpen className="w-5 h-5 text-emerald-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-800">{subject.name}</p>
                                                    {subject.code && (
                                                        <Badge variant="outline" className="text-xs mt-1 border-emerald-200 text-emerald-700">{subject.code}</Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm" variant="outline"
                                                        className="gap-1.5 text-xs"
                                                        onClick={() => { setEditingSubjectId(subject.subject_id); setEditSubjectName(subject.name); setEditSubjectCode(subject.code ?? "") }}
                                                    >
                                                        <Edit2 className="w-3 h-3" /> تعديل
                                                    </Button>
                                                    <Button
                                                        size="sm" variant="outline"
                                                        className="gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                                        onClick={() => setDeleteSubject_(subject.subject_id)}
                                                    >
                                                        <Trash2 className="w-3 h-3" /> حذف
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ====== DIALOGS ====== */}
            <PromoteStudentsDialog 
                isOpen={selectivePromoteDialog.isOpen}
                onClose={() => setSelectivePromoteDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handlePromoteConfirmation}
                scope={selectivePromoteDialog.scope}
                scopeId={selectivePromoteDialog.scopeId}
                title={selectivePromoteDialog.title}
            />

            <AlertDialog open={!!graduateDialog} onOpenChange={(open) => !open && setGraduateDialog(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-green-600" />
                            أرشفة موظفين {graduateDialog?.levelName}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم تحويل حالة جميع الموظفين في هذا التصنيف إلى &quot;متخرج&quot;.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-6 py-2 space-y-2" dir="rtl">
                        <Label className="text-sm font-medium">السنة الدراسية</Label>
                        <Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2024-2025" />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleGraduate} disabled={migrating} className="bg-green-600 hover:bg-green-700">
                            {migrating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                            تأكيد الأرشفة
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteLevel_} onOpenChange={(open) => !open && setDeleteLevel_(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف التصنيف</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف التصنيف وجميع فصوله ومواده. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteLevel} className="bg-destructive hover:bg-destructive/90">حذف التصنيف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteTerm_} onOpenChange={(open) => !open && setDeleteTerm_(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف الفصل الدراسي</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف الفصل وجميع مواده. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTerm} className="bg-destructive hover:bg-destructive/90">حذف الفصل</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteSubject_} onOpenChange={(open) => !open && setDeleteSubject_(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف المادة الدراسية</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف المادة وجميع سجلات السجلات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSubject} className="bg-destructive hover:bg-destructive/90">حذف المادة</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ====== Promote students to next TERM dialog ====== */}
            <AlertDialog open={!!promoteTermDialog} onOpenChange={(open) => !open && setPromoteTermDialog(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <ArrowLeftRight className="w-5 h-5 text-amber-600" />
                            نقل الموظفين إلى الفصل التالي
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم نقل جميع الموظفين الذين فصلهم الحالي هو{" "}
                            <strong>{promoteTermDialog?.fromName}</strong>{" "}
                            إلى <strong>{promoteTermDialog?.toName}</strong>.
                            <br />
                            <span className="text-amber-700 text-xs font-medium mt-2 block">
                                 يؤثر هذا فقط على الموظفين الذين تم تعيين فترة تشغيلية لهم مسبقاً.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePromoteTerm} disabled={migrating} className="bg-amber-600 hover:bg-amber-700">
                            {migrating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                            تأكيد النقل
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ====== Assign term to ALL students in a level ====== */}
            <AlertDialog open={!!assignTermDialog} onOpenChange={(open) => { if (!open) { setAssignTermDialog(null); setAssignTermId(null) } }}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-indigo-600" />
                            تعيين فترة تشغيلية لموظفين {assignTermDialog?.levelName}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            اختر الفصل الدراسي الذي تريد تعيينه لجميع الموظفين النشطين في هذا التصنيف.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-6 py-3 space-y-3" dir="rtl">
                        <Label className="text-sm font-medium">اختر الفصل الدراسي</Label>
                        <div className="space-y-2">
                            {(assignTermDialog?.terms ?? []).map((term: any) => (
                                <button
                                    key={term.term_id}
                                    onClick={() => setAssignTermId(term.term_id)}
                                    className={`w-full text-right p-3 rounded-lg border-2 transition-all ${
                                        assignTermId === term.term_id
                                            ? "border-indigo-500 bg-indigo-50 text-indigo-800 font-bold"
                                            : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <CalendarCheck className={`w-4 h-4 ${assignTermId === term.term_id ? "text-indigo-600" : "text-muted-foreground"}`} />
                                        {term.name}
                                        <span className="text-xs text-muted-foreground mr-auto">{term.subjects?.length ?? 0} مادة</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            سيتم تحديث الفصل الحالي لجميع الموظفين النشطين في هذا التصنيف.
                        </p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleAssignTerm}
                            disabled={migrating || !assignTermId}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {migrating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                            تعيين الفصل للموظفين
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteLevel_} onOpenChange={(open) => !open && setDeleteLevel_(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف التصنيف</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف التصنيف وجميع فصوله ومواده. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteLevel} className="bg-destructive hover:bg-destructive/90">حذف التصنيف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteTerm_} onOpenChange={(open) => !open && setDeleteTerm_(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف الفصل الدراسي</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف الفصل وجميع مواده. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTerm} className="bg-destructive hover:bg-destructive/90">حذف الفصل</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteSubject_} onOpenChange={(open) => !open && setDeleteSubject_(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف المادة الدراسية</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف المادة وجميع سجلات السجلات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSubject} className="bg-destructive hover:bg-destructive/90">حذف المادة</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


        </div>
    )
}


