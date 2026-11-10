"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import {
    Search, Plus, Trash2, CheckCircle2, XCircle, CalendarDays,
    ChevronDown, ChevronUp, BookOpen, User, Loader2, Building2,
    ShieldAlert, AlertCircle, FileClock, GraduationCap, Phone, Mail, Hash
} from "lucide-react"
import {
    searchStudents,
    getStudentAbsences,
    addAbsenceRecord,
    updateAbsenceRecord,
    deleteAbsenceRecord
} from "@/app/actions/absences"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { arSA } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

interface AbsenceManagerProps {
    currentUserId: string
}

export default function AbsenceManager({ currentUserId }: AbsenceManagerProps) {
    const { toast } = useToast()


    // Search state
    const [query, setQuery] = useState("")
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [searching, setSearching] = useState(false)

    const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
    const [subjectData, setSubjectData] = useState<any[]>([])
    const [isHidden, setIsHidden] = useState(false)
    const [loadingAbsences, setLoadingAbsences] = useState(false)

    // Expanded subject
    const [expandedSubjectId, setExpandedSubjectId] = useState<number | null>(null)

    // Add record form
    const [addingTo, setAddingTo] = useState<number | null>(null)
    const [newDate, setNewDate] = useState("")
    const [newIsExcused, setNewIsExcused] = useState(false)
    const [newNotes, setNewNotes] = useState("")
    const [saving, setSaving] = useState(false)

    // Delete record dialog
    const [deleteRecordId, setDeleteRecordId] = useState<number | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Search
    const handleSearch = useCallback(async () => {
        // We allow initial load with empty query to show college students
        setSearching(true)
        setSelectedStudent(null)
        setSubjectData([])
        try {
            const res = await searchStudents(query, currentUserId)
            if (res.success) setSearchResults(res.data ?? [])
            else toast({ title: " خطأ", description: res.error, variant: "destructive" })
        } finally {
            setSearching(false)
        }
    }, [query, currentUserId, toast])

    useEffect(() => {
        // Initial load
        handleSearch()
    }, [])

    useEffect(() => {
        const t = setTimeout(() => {
            if (!selectedStudent && (query.length >= 2 || query.length === 0)) {
                handleSearch()
            }
        }, 400)
        return () => clearTimeout(t)
    }, [query, handleSearch, selectedStudent])

    // Select student
    const selectStudent = async (student: any) => {
        setSelectedStudent(student)
        setSearchResults([])
        setQuery(student.full_name)
        setLoadingAbsences(true)
        try {
            const res = await getStudentAbsences(student.university_id)
            if (res.success) {
                setSubjectData((res as any).subjects ?? [])
                setIsHidden((res as any).isHidden ?? false)
            } else {
                toast({ title: " خطأ", description: (res as any).error, variant: "destructive" })
            }
        } finally {
            setLoadingAbsences(false)
        }
    }

    // Add record
    const handleAddRecord = async (subjectId: number) => {
        if (!newDate) {
            toast({ title: " خطأ", description: "يرجى تحديد تاريخ السجلات", variant: "destructive" })
            return
        }
        setSaving(true)
        try {
            const res = await addAbsenceRecord(
                selectedStudent.university_id,
                subjectId,
                newDate,
                newIsExcused,
                newNotes || undefined,
                currentUserId
            )
            if (res.success) {
                toast({ title: " تم تسجيل السجلات" })
                setNewDate("")
                setNewIsExcused(false)
                setNewNotes("")
                setAddingTo(null)
                // Refresh
                const updated = await getStudentAbsences(selectedStudent.university_id)
                if (updated.success) {
                    setSubjectData((updated as any).subjects ?? [])
                    setIsHidden((updated as any).isHidden ?? false)
                }
            } else {
                toast({ title: " خطأ", description: (res as any).error, variant: "destructive" })
            }
        } finally {
            setSaving(false)
        }
    }

    // Toggle excused
    const handleToggleExcused = async (recordId: number, currentExcused: boolean, subjectId: number) => {
        try {
            const res = await updateAbsenceRecord(recordId, !currentExcused)
            if (res.success) {
                const updated = await getStudentAbsences(selectedStudent.university_id)
                if (updated.success) {
                    setSubjectData((updated as any).subjects ?? [])
                    setIsHidden((updated as any).isHidden ?? false)
                }
                toast({ title: currentExcused ? " تم إلغاء العذر" : " تم التأشير بعذر" })
            }
        } catch {
            toast({ title: " خطأ", description: "تعذر التحديث", variant: "destructive" })
        }
    }

    // Delete record
    const handleDeleteRecord = async () => {
        if (!deleteRecordId) return
        setDeleting(true)
        try {
            const res = await deleteAbsenceRecord(deleteRecordId)
            if (res.success) {
                toast({ title: " تم حذف السجل" })
                setDeleteRecordId(null)
                const updated = await getStudentAbsences(selectedStudent.university_id)
                if (updated.success) {
                    setSubjectData((updated as any).subjects ?? [])
                    setIsHidden((updated as any).isHidden ?? false)
                }
            } else {
                toast({ title: " خطأ", description: (res as any).error, variant: "destructive" })
            }
        } finally {
            setDeleting(false)
        }
    }

    const groupedResults = useMemo(() => {
        const groups: Record<string, Record<string, any[]>> = {}
        searchResults.forEach(s => {
            const deptNode = s.departments_users_department_idTodepartments;
            const college = deptNode?.colleges;
            const deptName = deptNode ? `${college?.name ? college.name + ' - ' : ''}${deptNode.dept_name}` : 'قسم غير محدد';
            const levelName = s.levels?.name || 'تصنيف غير محدد';

            if (!groups[deptName]) groups[deptName] = {};
            if (!groups[deptName][levelName]) groups[deptName][levelName] = [];
            
            groups[deptName][levelName].push(s);
        });
        return groups;
    }, [searchResults]);

    return (
        <div className="p-6 space-y-6" dir="rtl">
            <div>
                <h1 className="text-4xl font-black tracking-tight text-foreground">إدارة السجلات</h1>
                <p className="text-lg text-muted-foreground mt-2">ابحث عن موظف لعرض وتعديل سجل سجلاته في فرعك / إدارتك</p>
            </div>

            {/* Student Search */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        بحث عن موظف
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="pr-10"
                                disabled={!!selectedStudent}
                            />
                        </div>
                        {selectedStudent && (
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setSelectedStudent(null);
                                    setQuery("");
                                    handleSearch(); // Refresh list automatically
                                }}
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                                <XCircle className="w-4 h-4 ml-2" />
                                العودة للقائمة
                            </Button>
                        )}
                    </div>
                    {searching && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" /> جارٍ البحث...
                        </div>
                    )}
                    {!selectedStudent && searchResults.length > 0 && (
                        <div className="border rounded-xl bg-card shadow-lg max-h-[500px] overflow-y-auto mt-2 transition-all p-2">
                            <Accordion type="multiple" className="w-full space-y-2">
                                {Object.entries(groupedResults).map(([deptName, levels]) => (
                                    <AccordionItem value={deptName} key={deptName} className="border bg-slate-50/50 rounded-lg overflow-hidden">
                                        <AccordionTrigger className="hover:no-underline px-4 py-3 bg-slate-50 border-b">
                                            <div className="flex items-center gap-2 font-bold text-primary text-base">
                                                <Building2 className="w-5 h-5" />
                                                {deptName}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-3 bg-white">
                                            <Accordion type="multiple" className="w-full space-y-3">
                                                {Object.entries(levels).map(([levelName, students]) => (
                                                    <AccordionItem value={`${deptName}-${levelName}`} key={`${deptName}-${levelName}`} className="border rounded-lg overflow-hidden shadow-sm">
                                                        <AccordionTrigger className="hover:no-underline bg-slate-50/80 px-4 py-2 border-b">
                                                            <div className="flex items-center gap-2 font-semibold text-slate-700">
                                                                <GraduationCap className="w-4 h-4" />
                                                                {levelName}
                                                                <Badge variant="secondary" className="mr-2 text-xs">{students.length} موظفين</Badge>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="p-3 bg-white">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {students.map((s: any) => (
                                                                    <button
                                                                        key={s.user_id}
                                                                        onClick={() => selectStudent(s)}
                                                                        className="w-full text-right px-4 py-3 bg-white border hover:border-primary/50 hover:shadow-md transition-all rounded-lg flex items-center justify-start gap-3 group"
                                                                    >
                                                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                                            <User className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">{s.full_name}</p>
                                                                            <p className="text-xs font-mono text-muted-foreground mt-0.5">{s.university_id}</p>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    )}

                    {!selectedStudent && !searching && query.length >= 2 && searchResults.length === 0 && (
                        <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20">
                            <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">لم يتم العثور على موظفين في فرعك / إدارتك يطابقون هذا البحث</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            {/* Student Absence Data */}
            {selectedStudent && (
                <>
                    {/* Student Info Card (Premium Layout) */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm mb-6 bg-white shrink-0">
                        {/* Gradient Banner */}
                        <div className="relative bg-gradient-to-l from-[#38a39e] to-[#2b7c78] p-5">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10 w-full">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm shrink-0">
                                        <User className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm">
                                            {selectedStudent.full_name}
                                        </h2>
                                        <p className="text-white/80 text-sm mt-0.5">
                                            {selectedStudent.levels ? selectedStudent.levels.name : "لا يوجد تصنيف"}
                                        </p>
                                    </div>
                                </div>
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-white/20 text-white border border-white/30 backdrop-blur-sm shadow-sm">
                                    {(() => {
                                        const dept = selectedStudent.departments_users_department_idTodepartments
                                        return dept ? "موظف مقيد" : "بيانات غير مكتملة"
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100">
                            {/* Student Data (Right Column) */}
                            <div className="p-5 sm:p-6">
                                <p className="text-xs font-bold text-[#38a39e]/80 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-4 h-px bg-[#38a39e]/50 inline-block"/>
                                    معلومات اتصال الموظف
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-start gap-3">
                                        <span className="w-8 h-8 rounded-full bg-[#38a39e]/10 flex items-center justify-center shrink-0">
                                            <Hash className="w-4 h-4 text-[#38a39e]" />
                                        </span>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-0.5">الرقم الشركةي</p>
                                            <p className="font-mono font-semibold text-slate-900 text-sm">{selectedStudent.university_id}</p>
                                        </div>
                                    </div>

                                    {selectedStudent.phone && (
                                        <div className="flex items-start gap-3">
                                            <span className="w-8 h-8 rounded-full bg-[#38a39e]/10 flex items-center justify-center shrink-0">
                                                <Phone className="w-4 h-4 text-[#38a39e]" />
                                            </span>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">رقم الجوال</p>
                                                <div className="text-right" dir="ltr">
                                                    <a href={`https://wa.me/${selectedStudent.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-blue-600 hover:text-blue-800 text-sm">
                                                        {selectedStudent.phone}
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedStudent.email && (
                                        <div className="flex items-start gap-3">
                                            <span className="w-8 h-8 rounded-full bg-[#38a39e]/10 flex items-center justify-center shrink-0">
                                                <Mail className="w-4 h-4 text-[#38a39e]" />
                                            </span>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">البريد الإلكتروني</p>
                                                <a href={`mailto:${selectedStudent.email}`} className="font-semibold text-blue-600 hover:text-blue-800 text-sm line-clamp-1 truncate" title={selectedStudent.email}>
                                                    {selectedStudent.email}
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {(() => {
                                        const dept = selectedStudent.departments_users_department_idTodepartments;
                                        const college = dept?.colleges;
                                        const levelDept = selectedStudent.levels?.departments;
                                        const deptName = dept?.dept_name ?? levelDept?.dept_name;
                                        
                                        if (!deptName && !college?.name) return null;
                                        
                                        return (
                                            <div className="flex items-start gap-3">
                                                <span className="w-8 h-8 rounded-full bg-[#38a39e]/10 flex items-center justify-center shrink-0">
                                                    <Building2 className="w-4 h-4 text-[#38a39e]" />
                                                </span>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">الفرع والقسم</p>
                                                    <p className="font-semibold text-slate-900 text-sm line-clamp-2" title={`${college?.name || ''} - ${deptName || ''}`}>
                                                        {college?.name ? `${college.name} - ` : ''}{deptName || ''}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Academic Meta (Left Column) */}
                            <div className="p-5 sm:p-6 bg-slate-50/50">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-4 h-px bg-slate-400 inline-block"/>
                                    السجل الإداري
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 h-[calc(100%-2rem)]">
                                    <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                                        <BookOpen className="w-5 h-5 text-slate-400 mb-1.5" />
                                        <p className="text-[11px] font-medium text-slate-500 mb-0.5">مواد مسجلة</p>
                                        <p className="font-mono font-bold text-xl text-slate-700">{subjectData.length}</p>
                                    </div>
                                    <div className="bg-emerald-50/50 p-3 rounded border border-emerald-100 shadow-sm flex flex-col items-center justify-center text-center">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1.5" />
                                        <p className="text-[11px] font-medium text-emerald-600 mb-0.5">سجل بعذر</p>
                                        <p className="font-mono font-bold text-xl text-emerald-700">
                                            {subjectData.reduce((a, s) => a + s.excused_count, 0)}
                                        </p>
                                    </div>
                                    <div className="bg-rose-50/50 p-3 rounded border border-rose-100 shadow-sm flex flex-col items-center justify-center text-center">
                                        <ShieldAlert className="w-5 h-5 text-rose-500 mb-1.5" />
                                        <p className="text-[11px] font-medium text-rose-600 mb-0.5">سجل بدون عذر</p>
                                        <p className="font-mono font-bold text-xl text-rose-700">
                                            {subjectData.reduce((a, s) => a + (s.total_absences - s.excused_count), 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {loadingAbsences ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            جارٍ تحميل السجلات...
                        </div>
                    ) : !selectedStudent.levels ? (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground py-12">
                                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium">لم يتم تعيين تصنيف لهذا الموظف</p>
                                <p className="text-sm mt-1">يرجى تعيين التصنيف من صفحة إدارة المستخدمين أو إدارة التصنيفات</p>
                            </CardContent>
                        </Card>
                    ) : subjectData.length === 0 ? (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground py-12">
                                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium">لا توجد مواد مسجلة لهذا الموظف</p>
                                <p className="text-sm mt-1">تأكد من إضافة مواد دراسية لهذا التصنيف والفصل الدراسي من إدارة التصنيفات</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold">سجل السجلات بالمواد</h2>

                            {/* Summary row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-slate-50 border border-slate-200 shadow-sm">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500 mb-1">إجمالي السجلات</p>
                                            <p className="text-2xl font-bold text-slate-900">
                                                {subjectData.reduce((a, s) => a + s.total_absences, 0)}
                                            </p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                            <FileClock className="w-5 h-5 text-slate-600" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-emerald-50 border border-emerald-100 shadow-sm">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-emerald-600 mb-1">بعذر</p>
                                            <p className="text-2xl font-bold text-emerald-900">
                                                {subjectData.reduce((a, s) => a + s.excused_count, 0)}
                                            </p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-emerald-200/50 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-rose-50 border border-rose-100 shadow-sm">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-rose-600 mb-1">بدون عذر</p>
                                            <p className="text-2xl font-bold text-rose-900">
                                                {subjectData.reduce((a, s) => a + (s.total_absences - s.excused_count), 0)}
                                            </p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-rose-200/50 flex items-center justify-center">
                                            <ShieldAlert className="w-5 h-5 text-rose-600" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Group subjects by term */}
                            { (Object.entries(
                                subjectData.reduce((acc, subject) => {
                                    const term = subject.term_name || 'مواد أخرى';
                                    if (!acc[term]) acc[term] = [];
                                    acc[term].push(subject);
                                    return acc;
                                }, {} as Record<string, any[]>)
                            ) as [string, any[]][]).map(([termName, termSubjects]) => (
                                <div key={termName} className="space-y-4">
                                    <div className="flex items-center gap-2 mt-6 mb-2">
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                        <h3 className="text-sm font-semibold text-slate-500 uppercase px-2 tracking-wider">
                                            {termName === 'مواد أخرى' ? termName : `الفصل الدراسي ${termName}`}
                                        </h3>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                    <div className="space-y-3">
                                        {termSubjects.map((subject: any) => (
                                            <Card key={subject.subject_id} className={`overflow-hidden border transition-shadow ${expandedSubjectId === subject.subject_id ? "shadow-sm border-primary/40 ring-1 ring-primary/10" : "shadow-sm hover:border-slate-300"}`}>
                                                {/* Subject Header */}
                                                <button
                                                    className={`w-full text-right transition-colors ${expandedSubjectId === subject.subject_id ? "bg-slate-50/50" : "hover:bg-slate-50"}`}
                                                    onClick={() => setExpandedSubjectId(
                                                        expandedSubjectId === subject.subject_id ? null : subject.subject_id
                                                    )}
                                                >
                                                    <CardHeader className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-md shrink-0 bg-primary/10 text-primary">
                                                                <BookOpen className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1 text-right">
                                                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                                                    {subject.name}
                                                                    {subject.code && (
                                                                        <span className="text-xs font-normal text-muted-foreground mr-1">({subject.code})</span>
                                                                    )}
                                                                </CardTitle>
                                                                <div className="flex gap-3 mt-1.5">
                                                                    <div className="flex items-center gap-1.5 min-w-[70px]">
                                                                        <span className="text-xs text-muted-foreground font-medium">إجمالي السجلات:</span>
                                                                        <span className="text-sm font-bold">{subject.total_absences}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 min-w-[70px]">
                                                                        <span className="text-xs text-emerald-600 font-medium">بعذر:</span>
                                                                        <span className="text-sm font-bold text-emerald-700">{subject.excused_count}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 min-w-[70px]">
                                                                        <span className="text-xs text-rose-500 font-medium">بدون عذر:</span>
                                                                        <span className="text-sm font-bold text-rose-600">{subject.total_absences - subject.excused_count}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="p-1.5">
                                                                {expandedSubjectId === subject.subject_id
                                                                    ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                                                    : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                                                }
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                </button>
            
                                                {/* Expanded Content */}
                                                {expandedSubjectId === subject.subject_id && (
                                                    <CardContent className="pt-0 border-t">
                                                        {/* Records Table */}
                                                        <div className="mt-4 space-y-2">
                                                            {subject.records.length === 0 ? (
                                                                <p className="text-sm text-muted-foreground text-center py-4">
                                                                    لا توجد سجلات سجل لهذه المادة
                                                                </p>
                                                            ) : (
                                                                <div className="rounded-lg border overflow-hidden">
                                                                    <table className="w-full text-sm">
                                                                        <thead className="bg-muted/50">
                                                                            <tr>
                                                                                <th className="text-right p-3 font-medium">التاريخ</th>
                                                                                <th className="text-right p-3 font-medium">الحالة</th>
                                                                                <th className="text-right p-3 font-medium">ملاحظات</th>
                                                                                <th className="text-right p-3 font-medium">إجراء</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y">
                                                                            {subject.records.map((record: any) => (
                                                                                <tr key={record.record_id} className="hover:bg-muted/30 transition-colors">
                                                                                    <td className="p-3 font-mono">
                                                                                        {new Date(record.absence_date).toLocaleDateString('ar-SA')}
                                                                                    </td>
                                                                                    <td className="p-3">
                                                                                        {record.is_excused ? (
                                                                                            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                                                                                                <CheckCircle2 className="w-3 h-3" />
                                                                                                بعذر
                                                                                            </Badge>
                                                                                        ) : (
                                                                                            <Badge variant="outline" className="text-red-600 border-red-200 gap-1">
                                                                                                <XCircle className="w-3 h-3" />
                                                                                                بدون عذر
                                                                                            </Badge>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="p-3 text-muted-foreground text-xs">
                                                                                        {record.notes || "—"}
                                                                                    </td>
                                                                                    <td className="p-3">
                                                                                        <div className="flex gap-1">
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className={record.is_excused
                                                                                                    ? "text-orange-500 hover:text-orange-600 h-7 w-7"
                                                                                                    : "text-green-600 hover:text-green-700 h-7 w-7"
                                                                                                }
                                                                                                title={record.is_excused ? "إلغاء العذر" : "تأشير بعذر"}
                                                                                                onClick={() => handleToggleExcused(record.record_id, record.is_excused, subject.subject_id)}
                                                                                            >
                                                                                                <CheckCircle2 className="w-4 h-4" />
                                                                                            </Button>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="text-destructive hover:text-destructive h-7 w-7"
                                                                                                title="حذف السجل"
                                                                                                onClick={() => setDeleteRecordId(record.record_id)}
                                                                                            >
                                                                                                <Trash2 className="w-4 h-4" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
            
                                                        {/* Add new record */}
                                                        {addingTo === subject.subject_id ? (
                                                            <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                                                                <h4 className="font-medium text-sm">تسجيل سجل جديد</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    <div>
                                                                        <Label className="text-xs mb-1 block">التاريخ *</Label>
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    className={`w-full justify-start text-right font-normal border-input rounded-md bg-background focus:ring-ring/50 focus:ring-[3px] focus:outline-none transition-[color,box-shadow] h-10 px-3 ${!newDate && "text-muted-foreground"}`}
                                                                                >
                                                                                    <CalendarIcon className="ml-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                                                    {newDate ? (
                                                                                        format(new Date(newDate), "PPP", { locale: arSA })
                                                                                    ) : (
                                                                                        <span>اختر التاريخ...</span>
                                                                                    )}
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                                <Calendar
                                                                                    mode="single"
                                                                                    selected={newDate ? new Date(newDate) : undefined}
                                                                                    onSelect={(date) => setNewDate(date ? format(date, "yyyy-MM-dd") : "")}
                                                                                    disabled={(date) => date > new Date()}
                                                                                    initialFocus
                                                                                />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-xs mb-1 block">ملاحظات (اختياري)</Label>
                                                                        <Input
                                                                            placeholder="ملاحظات إضافية..."
                                                                            value={newNotes}
                                                                            onChange={e => setNewNotes(e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={newIsExcused}
                                                                        onChange={e => setNewIsExcused(e.target.checked)}
                                                                        className="w-4 h-4 rounded"
                                                                    />
                                                                    تسجيل كسجل بعذر
                                                                </label>
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleAddRecord(subject.subject_id)}
                                                                        disabled={saving}
                                                                    >
                                                                        {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                                                                        حفظ
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => { setAddingTo(null); setNewDate(""); setNewNotes(""); setNewIsExcused(false) }}
                                                                    >
                                                                        إلغاء
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="mt-4 gap-2"
                                                                onClick={() => { setAddingTo(subject.subject_id); setExpandedSubjectId(subject.subject_id) }}
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                                تسجيل سجل جديد
                                                            </Button>
                                                        )}
                                                    </CardContent>
                                                )}
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteRecordId} onOpenChange={(open) => !open && setDeleteRecordId(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل تريد حذف سجل السجلات؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            لا يمكن التراجع عن هذا الإجراء. سيتم حذف السجل وتحديث العداد تلقائياً.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteRecord}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={deleting}
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                            حذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

