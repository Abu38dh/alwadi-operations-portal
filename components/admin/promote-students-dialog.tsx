"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Loader2, GraduationCap, Users, Building2, School, Layers, CheckSquare, Search, X } from "lucide-react"
import { getStudentsForPromotion } from "@/app/actions/absences"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"

export type PromotionScope = 'level' | 'department' | 'global'

interface PromoteStudentsDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (selectedStudentIds: number[]) => Promise<void>
    scope: PromotionScope
    scopeId?: number
    title: string
}

export function PromoteStudentsDialog({ isOpen, onClose, onConfirm, scope, scopeId, title }: PromoteStudentsDialogProps) {
    const [students, setStudents] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        if (isOpen) {
            fetchStudents()
        } else {
            setStudents([])
            setSelectedIds(new Set())
            setSearchQuery("")
        }
    }, [isOpen, scope, scopeId])

    const fetchStudents = async () => {
        setLoading(true)
        const res = await getStudentsForPromotion(scope, scopeId)
        if (res.success && res.data) {
            setStudents(res.data)
            setSelectedIds(new Set(res.data.map(s => s.user_id)))
        }
        setLoading(false)
    }

    const handleConfirm = async () => {
        setSaving(true)
        await onConfirm(Array.from(selectedIds))
        setSaving(false)
        onClose()
    }

    const toggleStudent = (id: number) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const toggleGroup = (studentIds: number[], isSelected: boolean) => {
        const next = new Set(selectedIds)
        studentIds.forEach(id => {
            if (isSelected) next.add(id)
            else next.delete(id)
        })
        setSelectedIds(next)
    }

    const filteredStudents = students.filter(student => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = student.full_name && student.full_name.toLowerCase().includes(q)
        const idMatch = student.university_id && student.university_id.toString().includes(q)
        return nameMatch || idMatch
    })

    type GroupedStudents = Record<string, Record<string, Record<string, any[]>>>

    const grouped: GroupedStudents = filteredStudents.reduce((acc: GroupedStudents, student: any) => {
        const collegeName = student.college_name || "فرع غير محددة"
        const deptName = student.dept_name || "قسم غير محدد"
        const levelName = student.level_name || "تصنيف غير محدد"
        
        if (!acc[collegeName]) acc[collegeName] = {}
        if (!acc[collegeName][deptName]) acc[collegeName][deptName] = {}
        if (!acc[collegeName][deptName][levelName]) acc[collegeName][deptName][levelName] = []
        
        acc[collegeName][deptName][levelName].push(student)
        return acc
    }, {} as GroupedStudents)

    const allSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.has(s.user_id))

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50" dir="rtl">
                <DialogHeader className="p-6 pb-5 bg-white border-b shadow-sm z-10 relative">
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-800">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-7 h-7 text-primary" />
                        </div>
                        {title}
                    </DialogTitle>
                    <DialogDescription className="text-base mt-3 text-slate-500 font-medium px-1">
                        يرجى تحديد الموظفين الذين ترغب في ترقيتهم للتصنيف التالي. سيتم استبعاد الموظفين غير المحددين بحيث يبقون في مستواهم الحالي.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col relative">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground h-full">
                            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                            <p className="text-lg font-medium">جاري جلب بيانات الموظفين...</p>
                        </div>
                    ) : students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground h-full">
                            <Users className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">لا يوجد موظفين مؤهلين للترقية في هذا النطاق.</p>
                            <p className="text-sm mt-2 opacity-70">تأكد من وجود موظفين في التصنيفات المحددة.</p>
                        </div>
                    ) : (
                        <>
                            {/* Search Input Container */}
                            <div className="px-5 pt-5 pb-1 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                                    <Input
                                        placeholder="ابحث عن موظف باسمه أو رقمه الشركةي..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pr-10 pl-10 h-11 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 transition-all rounded-xl text-base"
                                    />
                                    {searchQuery && (
                                        <button 
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {filteredStudents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground flex-1">
                                    <Search className="w-16 h-16 mb-4 opacity-20 text-slate-400" />
                                    <p className="text-lg font-bold text-slate-700">لا توجد نتائج تطابق "{searchQuery}"</p>
                                    <p className="text-sm mt-1 text-slate-500 font-medium">تأكد من كتابة الاسم بشكل صحيح أو جرب البحث عن موظف آخر.</p>
                                    <Button 
                                        variant="link" 
                                        onClick={() => setSearchQuery("")} 
                                        className="mt-4 text-primary font-black hover:no-underline"
                                    >
                                        مسح البحث
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-white border border-slate-200 p-4 m-5 rounded-2xl flex justify-between items-center shadow-sm">
                                        <label htmlFor="select-all" className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`flex items-center justify-center w-6 h-6 rounded-md border-2 transition-colors ${allSelected ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary'}`}>
                                                <Checkbox 
                                                    id="select-all" 
                                                    checked={allSelected} 
                                                    onCheckedChange={(c) => toggleGroup(filteredStudents.map(s => s.user_id), !!c)}
                                                    className="opacity-0 absolute"
                                                />
                                                {allSelected && <CheckSquare className="w-4 h-4 text-white" />}
                                            </div>
                                            <span className="text-lg font-bold text-slate-800 group-hover:text-primary transition-colors">
                                                تحديد الكل ({filteredStudents.length} موظف)
                                            </span>
                                        </label>
                                        <Badge variant="default" className="text-sm px-4 py-1.5 shadow-sm">
                                            المحدد للترقية: {selectedIds.size}
                                        </Badge>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto px-5 pb-5">
                                        <Accordion key={searchQuery} type="multiple" defaultValue={Object.keys(grouped)} className="w-full space-y-4">
                                            {Object.entries(grouped).map(([collegeName, depts]: [string, Record<string, Record<string, any[]>>]) => {
                                                const collegeStudents = Object.values(depts).flatMap((levels: Record<string, any[]>) => Object.values(levels).flat())
                                        
                                        return (
                                            <AccordionItem value={collegeName} key={collegeName} className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden">
                                                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-slate-50 transition-colors border-b">
                                                    <div className="flex flex-1 items-center gap-4 text-right ml-4">
                                                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                                                            <Building2 className="w-6 h-6 text-blue-600" />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-bold text-slate-900 text-lg">{collegeName}</span>
                                                            <span className="text-sm text-slate-500 font-medium">{Object.keys(depts).length} أقسام</span>
                                                        </div>
                                                        <Badge variant="secondary" className="mr-auto px-3 py-1 bg-slate-100 text-slate-700 text-sm">
                                                            {collegeStudents.length} موظفين
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 bg-slate-50/50">
                                                    
                                                    <Accordion type="multiple" defaultValue={Object.keys(depts)} className="w-full space-y-3">
                                                        {Object.entries(depts).map(([deptName, levels]: [string, Record<string, any[]>]) => {
                                                            const deptStudents = (Object.values(levels) as any[][]).flat()
                                                            
                                                            return (
                                                                <AccordionItem value={deptName} key={deptName} className="border border-slate-200 shadow-sm rounded-xl bg-white overflow-hidden">
                                                                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 transition-colors border-b">
                                                                        <div className="flex flex-1 items-center gap-3 text-right ml-4">
                                                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                                                                                <School className="w-5 h-5 text-indigo-600" />
                                                                            </div>
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="font-bold text-slate-800 text-base">{deptName}</span>
                                                                                <span className="text-xs text-slate-500 font-medium">{Object.keys(levels).length} تصنيفات</span>
                                                                            </div>
                                                                            <Badge variant="outline" className="mr-auto px-2 py-0.5 border-slate-200 text-slate-600">
                                                                                {deptStudents.length} موظفين
                                                                            </Badge>
                                                                        </div>
                                                                    </AccordionTrigger>
                                                                    <AccordionContent className="p-4 bg-slate-50/80">
                                                                        
                                                                        <div className="space-y-4">
                                                                            {Object.entries(levels).map(([levelName, levelStudents]: [string, any[]]) => {
                                                                                const levelSelected = levelStudents.every((s: any) => selectedIds.has(s.user_id))
                                                                                
                                                                                return (
                                                                                    <div key={levelName} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-slate-300">
                                                                                        <div className="bg-white border-b p-3 px-4 flex justify-between items-center">
                                                                                            <label htmlFor={`level-${levelName}`} className="flex items-center gap-3 cursor-pointer group">
                                                                                                <Checkbox 
                                                                                                    id={`level-${levelName}`}
                                                                                                    checked={levelSelected}
                                                                                                    onCheckedChange={(c) => toggleGroup(levelStudents.map((s: any) => s.user_id), !!c)}
                                                                                                    className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                                                                />
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <Layers className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                                                                                    <span className="text-base font-bold text-slate-800 group-hover:text-primary transition-colors">
                                                                                                        {levelName}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </label>
                                                                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                                                                {levelStudents.length} موظفين
                                                                                            </Badge>
                                                                                        </div>
                                                                                        
                                                                                        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 bg-slate-50/50">
                                                                                            {levelStudents.map((student: any) => {
                                                                                                const isSelected = selectedIds.has(student.user_id)
                                                                                                return (
                                                                                                    <label 
                                                                                                        key={student.user_id}
                                                                                                        htmlFor={`student-${student.user_id}`}
                                                                                                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${
                                                                                                            isSelected 
                                                                                                            ? "border-primary bg-primary/5 shadow-sm" 
                                                                                                            : "border-slate-200 hover:border-slate-300 bg-white"
                                                                                                        }`}
                                                                                                    >
                                                                                                        <Checkbox 
                                                                                                            id={`student-${student.user_id}`} 
                                                                                                            checked={isSelected}
                                                                                                            onCheckedChange={() => toggleStudent(student.user_id)}
                                                                                                            className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                                                                                        />
                                                                                                        <div className="flex flex-col overflow-hidden">
                                                                                                            <span className="text-xs font-bold text-slate-900 truncate">
                                                                                                                {student.full_name}
                                                                                                            </span>
                                                                                                            <span className="text-[10px] text-slate-500 font-mono truncate">
                                                                                                                {student.university_id || 'بدون رقم شركةي'}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </label>
                                                                                                )
                                                                                            })}
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </AccordionContent>
                                                                </AccordionItem>
                                                            )
                                                        })}
                                                    </Accordion>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                        </Accordion>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="p-5 bg-white border-t z-10 flex sm:justify-end gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={saving} className="px-6 border-slate-300 hover:bg-slate-100">
                        إلغاء
                    </Button>
                    <Button onClick={handleConfirm} disabled={saving || students.length === 0} className="px-8 gap-2 bg-primary hover:bg-primary/90 text-white shadow-md">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        تأكيد الترقية ({selectedIds.size} موظف)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


