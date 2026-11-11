"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Trash2, ArrowRight, Search, Filter } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Check, Building2, Users } from "lucide-react"
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
import { RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import { EmptyState } from "@/components/ui/empty-state"
import { getAllFormTemplates, deleteFormTemplate, publishFormTemplate, toggleFormStatus } from "@/app/actions/forms"
import { getAllColleges, getOrganizationStructure } from "@/app/actions/organizations"
import { useToast } from "@/hooks/use-toast"
import { WorkflowSelectionDialog } from "@/components/admin/workflow-selection-dialog"

interface FormTemplatesListProps {
  onEditForm: (id: string) => void
  onCreateNewForm: () => void
  onBack: () => void
  currentUserId?: string
}

export default function FormTemplatesList({ onEditForm, onCreateNewForm, onBack, currentUserId }: FormTemplatesListProps) {
  const [forms, setForms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [audienceFilter, setAudienceFilter] = useState<"all" | "student" | "employee">("all")
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false)
  const [selectedAudience, setSelectedAudience] = useState<string>("all_students")
  const [pendingFormId, setPendingFormId] = useState<number | null>(null)
  const [pendingUnpublishId, setPendingUnpublishId] = useState<number | null>(null)
  const [selectedColleges, setSelectedColleges] = useState<number[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<number[]>([])
  const [selectedLevels, setSelectedLevels] = useState<number[]>([])
  const [specificRoleConfig, setSpecificRoleConfig] = useState({ student: true, employee: false })
  const [colleges, setColleges] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchForms()
    loadCollegesAndDepartments()
  }, [])

  const loadCollegesAndDepartments = async () => {
    const result = await getOrganizationStructure()
    if (result.success && result.data) {
      setColleges(result.data)
      const allDepts = result.data.flatMap((c: any) =>
        (c.departments || []).map((d: any) => ({ ...d, college_id: c.college_id }))
      )
      setDepartments(allDepts)
      const allLevels = allDepts.flatMap((d: any) =>
        (d.levels || []).map((l: any) => ({ ...l, dept_name: d.dept_name, college_id: d.college_id }))
      )
      setLevels(allLevels)
    }
  }

  const fetchForms = async () => {
    setError(null)

    try {
      const result = await getAllFormTemplates(1, 100, currentUserId)

      if (result.success && result.data) {
        setForms(result.data)
      } else {
        setError(result.error || "فشل في تحميل النماذج")
      }
    } catch (err) {
      console.error("Failed to fetch forms:", err)
      setError("حدث خطأ في الاتصال بقاعدة البيانات")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: number) => {
    setItemToDelete(id)
    setDeleteDialogOpen(true)
  }

  const executeDelete = async () => {
    if (!itemToDelete) return

    try {
      const result = await deleteFormTemplate(itemToDelete, currentUserId)

      if (result.success) {
        toast({ title: result.message || " تم الحذف بنجاح" })
        await fetchForms()
        setDeleteDialogOpen(false)
        setItemToDelete(null)
      } else {
        toast({ title: " فشل الحذف", description: result.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const [pendingWorkflowName, setPendingWorkflowName] = useState<string | null>(null)
  const [pendingWorkflowData, setPendingWorkflowData] = useState<any>(null)
  // Store original config for comparison
  const [originalAudience, setOriginalAudience] = useState<any>(null)

  const handleToggleStatus = async (id: number, isActive: boolean) => {
    if (!isActive) {
      // Publish (Activate)
      setPendingFormId(id)
      setShowAudienceChangeWarning(false)
      setPendingWorkflowData(null)

      // Find form to get current workflow and audience
      const form = forms.find(f => f.form_id === id)
      let workflowName = null

      if (form) {
        // 1. Get Workflow Name
        if (form.request_types) {
          const rt = Array.isArray(form.request_types) ? form.request_types[0] : form.request_types
          if (rt && rt.workflows) {
            const wf = Array.isArray(rt.workflows) ? rt.workflows[0] : rt.workflows
            workflowName = wf?.name
          }
        }

        // 2. Pre-select Audience
        if (form.audience_config) {
          const conf = form.audience_config as any
          setOriginalAudience(conf)

          if (conf.colleges?.length > 0 || conf.departments?.length > 0 || conf.levels?.length > 0) {
            setSelectedAudience('specific')
            setSelectedColleges(conf.colleges || [])
            setSelectedDepartments(conf.departments || [])
            setSelectedLevels(conf.levels || [])
            setSpecificRoleConfig({
              student: conf.student !== false,
              employee: conf.employee !== false
            })
          } else {
            setSelectedColleges([])
            setSelectedDepartments([])
            setSelectedLevels([])
            setSpecificRoleConfig({ student: true, employee: false })
            if (conf.student && (conf.employee === true)) {
              setSelectedAudience('all')
            } else if (conf.employee) {
              setSelectedAudience('all_employees')
            } else {
              setSelectedAudience('all_students')
            }
          }
        } else {
          setSelectedAudience('all_students')
          setOriginalAudience(null)
          setSelectedColleges([])
          setSelectedDepartments([])
          setSelectedLevels([])
          setSpecificRoleConfig({ student: true, employee: false })
        }
      }
      setPendingWorkflowName(workflowName)
      setPublishDialogOpen(true)
    } else {
      // Unpublish - show confirmation dialog
      setPendingUnpublishId(id)
      setUnpublishDialogOpen(true)
    }
  }

  const confirmUnpublish = async () => {
    if (!pendingUnpublishId) return

    try {
      const result = await toggleFormStatus(pendingUnpublishId, false, currentUserId)

      if (result.success) {
        toast({
          title: " تم إلغاء النشر",
          description: "تم تعطيل النموذج بنجاح"
        })
        setUnpublishDialogOpen(false)
        setPendingUnpublishId(null)
        await fetchForms()
      } else {
        toast({
          title: " فشل إلغاء النشر",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (err) {
      toast({
        title: " خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive"
      })
    }
  }

  // Check for audience change logic
  const [showAudienceChangeWarning, setShowAudienceChangeWarning] = useState(false)
  const [workflowSelectionOpen, setWorkflowSelectionOpen] = useState(false)

  const getNewAudienceConfig = () => {
    return {
      student: selectedAudience === 'all_students' || selectedAudience === 'all' || (selectedAudience === 'specific' && specificRoleConfig.student),
      employee: selectedAudience === 'all_employees' || selectedAudience === 'all' || (selectedAudience === 'specific' && specificRoleConfig.employee),
      colleges: selectedAudience === 'specific' ? selectedColleges : [],
      departments: selectedAudience === 'specific' ? selectedDepartments : [],
      levels: selectedAudience === 'specific' ? selectedLevels : []
    }
  }

  const handleConfirmPublish = async () => {
    if (!pendingFormId) return

    // 1. Calculate New Audience Config
    const newConfig = getNewAudienceConfig()

    // 2. Compare if we have original audience and a workflow, AND the user hasn't already modified the workflow manually
    if (originalAudience && pendingWorkflowName && !showAudienceChangeWarning && !pendingWorkflowData) {
      // Check for changes
      const isStudentChanged = !!newConfig.student !== (originalAudience.student !== false)
      const isEmployeeChanged = !!newConfig.employee !== (originalAudience.employee !== false)

      const arraysEqual = (a: any[], b: any[]) => {
        if ((!a || a.length === 0) && (!b || b.length === 0)) return true
        if (!a || !b) return false
        if (a.length !== b.length) return false
        const aSorted = [...a].sort()
        const bSorted = [...b].sort()
        return aSorted.every((val, index) => val === bSorted[index])
      }

      const isCollegesChanged = !arraysEqual(originalAudience.colleges || [], newConfig.colleges || [])
      const isDepartmentsChanged = !arraysEqual(originalAudience.departments || [], newConfig.departments || [])
      const isLevelsChanged = !arraysEqual(originalAudience.levels || [], newConfig.levels || [])

      if (isStudentChanged || isEmployeeChanged || isCollegesChanged || isDepartmentsChanged || isLevelsChanged) {
        setShowAudienceChangeWarning(true)
        return
      }
    }

    // Direct publish if no warning or approved
    executePublish(newConfig, pendingWorkflowData || undefined)
  }

  const handleWorkflowChangeClick = () => {
    // Open the workflow selection dialog
    // Keep pendingFormId set
    // Close publish warning
    setPublishDialogOpen(false)
    setShowAudienceChangeWarning(false)
    setWorkflowSelectionOpen(true)
  }

  const handleWorkflowSelectionConfirm = (workflowData: any) => {
    if (!pendingFormId) return

    // Store the selected workflow
    setPendingWorkflowData(workflowData)
    
    // Update the displayed name
    if (workflowData.mode === 'existing') {
      setPendingWorkflowName(workflowData.workflowName || "مسار موافقات محدد")
    } else if (workflowData.mode === 'new') {
      setPendingWorkflowName(workflowData.newWorkflow?.name || "مسار مخصص جديد")
    } else {
      setPendingWorkflowName("بدون مسار")
    }

    setShowAudienceChangeWarning(false)
    setWorkflowSelectionOpen(false)
    setPublishDialogOpen(true)
  }

  const executePublish = async (audienceConfig: any, workflowData?: any) => {
    try {
      const result = await publishFormTemplate(pendingFormId!, audienceConfig, workflowData)

      if (result.success) {
        toast({ title: " تم النشر بنجاح" })
        setPublishDialogOpen(false)
        setShowAudienceChangeWarning(false)
        setPendingFormId(null)
        await fetchForms()
      } else {
        toast({ title: " فشل النشر", description: result.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const filteredForms = forms.filter(form => {
    if (form.name === "طلب تفويض صلاحيات") return false
    const matchesSearch = (form?.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())
    // For audience filter, check the target_audience JSON field
    const matchesAudience = audienceFilter === "all" ||
      (form.target_audience && form.target_audience.includes(audienceFilter))
    return matchesSearch && matchesAudience
  })

  if (loading) {
    return (
      <div className="space-y-6" dir="rtl">
        <h1 className="text-3xl font-bold">إدارة النماذج</h1>
        <TableSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6" dir="rtl">
        <h1 className="text-3xl font-bold">إدارة النماذج</h1>
        <ErrorMessage error={error} onRetry={fetchForms} />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 bg-card p-6 rounded-lg border shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">إدارة النماذج</h1>
            <p className="text-muted-foreground mt-1">قم بإدارة نماذج الطلبات، تفعيلها، أو تعديلها</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={onCreateNewForm} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              <Plus className="w-4 h-4" />
              إنشاء نموذج جديد
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن نموذج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select
            value={audienceFilter}
            onValueChange={(value) => setAudienceFilter(value as any)}
          >
            <SelectTrigger className="w-[180px]" dir="rtl">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder="تصفية حسب الجمهور" />
              </div>
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="student">الموظفين</SelectItem>
              <SelectItem value="employee">الإدارة والمدراء</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredForms.length === 0 ? (
        <EmptyState
          icon="📋"
          title="لا توجد نماذج"
          description="لا توجد نماذج حالياً. قم بإنشاء نموذج جديد."
          action={{
            label: "إنشاء نموذج الآن",
            onClick: onCreateNewForm
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredForms.map((form) => (
            <Card key={form.form_id} className={`transition-all hover:shadow-md border-l-4 ${form.is_active ? 'border-l-primary' : 'border-l-slate-300'}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  {/* Form Info */}
                  <div className="flex items-start gap-4 flex-1 w-full">
                    <div className={`p-3 rounded-full ${form.is_active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                      <Edit2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-foreground mb-1">{form.name}</h3>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">
                          {form.target_audience === 'all_students' ? 'جميع الموظفين' :
                            form.target_audience === 'all_employees' ? 'الإدارة والمدراء' :
                              form.target_audience === 'specific' ? (() => {
                                const conf = form.audience_config
                                const parts = []
                                if (conf?.colleges?.length > 0) {
                                  const names = conf.colleges.map((id: number) => colleges.find(c => c.college_id === id)?.name).filter(Boolean)
                                  if (names.length > 0) parts.push(`فروع: ${names.join('، ')}`)
                                }
                                if (conf?.departments?.length > 0) {
                                  const names = conf.departments.map((id: number) => departments.find(d => d.department_id === id)?.dept_name).filter(Boolean)
                                  if (names.length > 0) parts.push(`أقسام: ${names.join('، ')}`)
                                }
                                if (conf?.levels?.length > 0) {
                                  const names = conf.levels.map((id: number) => levels.find(l => l.level_id === id)?.name).filter(Boolean)
                                  if (names.length > 0) parts.push(`فئات: ${names.join('، ')}`)
                                }
                                return parts.length > 0 ? parts.join(' - ') : 'محدد'
                              })() : 'الكل'}
                        </Badge>
                        <span>•</span>
                        <span>{form.is_active ? 'منشور' : 'مسودة'}</span>
                        <span>•</span>
                        <span>آخر تعديل: {form.updated_at ? new Date(form.updated_at).toLocaleDateString('ar-SA') : 'غير محدد'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-lg border">
                      <span className={`text-sm font-medium ${form.is_active ? 'text-primary' : 'text-slate-500'}`}>
                        {form.is_active ? 'مفعّل' : 'معطّل'}
                      </span>
                      <Switch
                        dir="ltr"
                        checked={form.is_active}
                        onCheckedChange={() => handleToggleStatus(form.form_id, form.is_active)}
                        className="data-[state=checked]:bg-primary ml-1"
                      />
                    </div>

                    <Button
                      onClick={() => onEditForm(form.form_id.toString())}
                      variant="outline"
                      className="gap-2 border-primary text-primary hover:bg-primary/5"
                    >
                      <Edit2 className="w-4 h-4" />
                      تعديل
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(form.form_id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-4xl max-w-4xl w-[90vw] gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b bg-slate-50/50">
            <DialogTitle className="text-xl font-bold text-slate-800">
              {showAudienceChangeWarning ? 'تنبيه: تغيير الجمهور المستهدف' : 'إعدادات استهداف ونشر النموذج'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              {showAudienceChangeWarning
                ? 'الجمهور الجديد مختلف عن الإعدادات الأصلية. هذا النموذج مرتبط بمسار عمل.'
                : 'حدد الفئات والإدارات المستهدفة ومسار العمل قبل نشر النموذج للعمل به.'
              }
            </DialogDescription>
          </DialogHeader>

          {showAudienceChangeWarning ? (
            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">مسار العمل الحالي:</p>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-white text-amber-900 border-amber-200">{pendingWorkflowName}</Badge>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  هل تريد الاستمرار بنفس المسار أم تغييره ليناسب الجمهور الجديد؟
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Display Workflow Info */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <span className="text-sm text-slate-600 font-semibold">مسار العمل المرتبط بالنموذج:</span>
                <div className="flex items-center gap-3">
                  {pendingWorkflowName ? (
                    <Badge variant="secondary" className="bg-white shadow-sm border font-bold text-slate-700 px-3 py-1">{pendingWorkflowName}</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">لا يوجد مسار</Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={handleWorkflowChangeClick}
                    className="text-xs font-semibold"
                  >
                    تغيير المسار
                  </Button>
                </div>
              </div>

              {/* Premium Cards for Audience Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">من يستطيع تعبئة هذا النموذج؟ (الجمهور المستهدف)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: "all_students", label: "جميع الموظفين", desc: "متاح لكافة موظفي الشركة", icon: Users, color: "text-blue-600 bg-blue-50/50 border-blue-200" },
                    { id: "all_employees", label: "الإدارة والمدراء", desc: "متاح لمدراء الأقسام والإدارة", icon: Building2, color: "text-purple-600 bg-purple-50/50 border-purple-200" },
                    { id: "all", label: "كافة منسوبي الشركة", desc: "متاح للجميع بدون استثناء", icon: Check, color: "text-emerald-600 bg-emerald-50/50 border-emerald-200" },
                    { id: "specific", label: "استهداف مخصص", desc: "فروع وأقسام وإدارات محددة", icon: Filter, color: "text-orange-600 bg-orange-50/50 border-orange-200" }
                  ].map(option => {
                    const isSelected = selectedAudience === option.id;
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedAudience(option.id)}
                        className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer hover:shadow-md ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 scale-[1.02]"
                            : "border-slate-100 bg-white hover:border-slate-200 text-slate-500"
                        }`}
                      >
                        <div className={`p-2 rounded-lg mb-2 ${isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-slate-800 block mb-0.5">{option.label}</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{option.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedAudience === 'specific' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  {/* Role Selection */}
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-3 cursor-pointer border rounded-lg px-4 py-3 flex-1 transition-all ${specificRoleConfig.student ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={specificRoleConfig.student}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSpecificRoleConfig({ ...specificRoleConfig, student: checked });
                          if (!checked) {
                            setSelectedLevels([]);
                          }
                        }}
                        className="w-4 h-4 rounded text-primary accent-primary"
                      />
                      <div>
                        <span className="text-sm font-semibold block">الموظفين</span>
                        <span className="text-xs text-muted-foreground">تطبيق الاستهداف على الموظفين</span>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 cursor-pointer border rounded-lg px-4 py-3 flex-1 transition-all ${specificRoleConfig.employee ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={specificRoleConfig.employee}
                        onChange={(e) => setSpecificRoleConfig({ ...specificRoleConfig, employee: e.target.checked })}
                        className="w-4 h-4 rounded text-primary accent-primary"
                      />
                      <div>
                        <span className="text-sm font-semibold block">الإداريين والمدراء</span>
                        <span className="text-xs text-muted-foreground">تطبيق الاستهداف على الكادر الإداري</span>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-slate-700">
                        تخصيص الفروع والأقسام والإدارات
                      </Label>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                        {selectedColleges.length} فروع • {selectedDepartments.length} أقسام
                        {specificRoleConfig.student && ` • ${selectedLevels.length} فئات`}
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl bg-slate-50/30 flex h-[350px] overflow-hidden shadow-inner">
                      {/* Column 1: Branches */}
                      <div className={`${specificRoleConfig.student ? 'w-1/3' : 'w-1/2'} flex flex-col bg-white border-l border-slate-200`}>
                        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between shrink-0">
                          <Label className="text-xs font-bold text-slate-700">1. الفروع المستهدفة</Label>
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                            {selectedColleges.length} محدد
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2.5 space-y-1 scrollbar-thin">
                          {colleges.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-2">لا توجد فروع</p>
                          ) : (
                            colleges.map((college: any) => {
                              const isSelected = selectedColleges.includes(college.college_id);
                              return (
                                <button
                                  key={college.college_id}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedColleges(selectedColleges.filter((id: number) => id !== college.college_id));
                                      // Cascade deselect: departments and levels of this college
                                      const collegeDepts = departments.filter((d: any) => d.college_id === college.college_id);
                                      const collegeDeptIds = collegeDepts.map((d: any) => d.department_id);
                                      setSelectedDepartments(prev => prev.filter(id => !collegeDeptIds.includes(id)));
                                      const collegeLevels = collegeDepts.flatMap((d: any) => d.levels || []);
                                      const collegeLevelIds = collegeLevels.map((l: any) => l.level_id);
                                      setSelectedLevels(prev => prev.filter(id => !collegeLevelIds.includes(id)));
                                    } else {
                                      setSelectedColleges([...selectedColleges, college.college_id]);
                                    }
                                  }}
                                  className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border transition-all text-xs text-right w-full ${
                                    isSelected
                                      ? 'bg-primary/5 border-primary/30 text-primary font-semibold'
                                      : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <span className="flex-1 truncate">{college.name}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Column 2: Departments */}
                      <div className={`${specificRoleConfig.student ? 'w-1/3 border-l border-slate-200' : 'w-1/2'} flex flex-col bg-white`}>
                        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between shrink-0">
                          <Label className="text-xs font-bold text-slate-700">2. الأقسام والإدارات المستهدفة</Label>
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                            {selectedDepartments.length} محدد
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 scrollbar-thin">
                          {selectedColleges.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                              <Building2 className="w-8 h-8 mb-2 opacity-40 text-slate-500" />
                              <p className="text-[11px] text-center text-slate-400 px-4">الرجاء اختيار فرع واحد على الأقل من القائمة الأولى</p>
                            </div>
                          ) : (
                            colleges
                              .filter((c: any) => selectedColleges.includes(c.college_id))
                              .map((college: any) => {
                                const collegeDepts = departments.filter((d: any) => d.college_id === college.college_id);
                                if (collegeDepts.length === 0) return null;
                                return (
                                  <div key={college.college_id} className="space-y-1">
                                    <p className="text-[10px] font-bold text-primary mb-1 border-b border-slate-100 pb-0.5">{college.name}</p>
                                    {collegeDepts.map((dept: any) => {
                                      const isSelected = selectedDepartments.includes(dept.department_id);
                                      const isAcademic = dept.is_academic !== false;
                                      return (
                                        <label
                                          key={dept.department_id}
                                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all text-xs hover:bg-slate-50 ${
                                            isSelected ? 'font-semibold text-slate-950 bg-slate-50' : 'text-slate-600'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedDepartments([...selectedDepartments, dept.department_id]);
                                              } else {
                                                setSelectedDepartments(selectedDepartments.filter((id: any) => id !== dept.department_id));
                                                // Cascade deselect: levels under this department
                                                const deptLevels = dept.levels || [];
                                                const deptLevelIds = deptLevels.map((l: any) => l.level_id);
                                                setSelectedLevels(prev => prev.filter(id => !deptLevelIds.includes(id)));
                                              }
                                            }}
                                            className="w-3.5 h-3.5 accent-primary rounded text-primary"
                                          />
                                          <span className="truncate flex-1">{dept.dept_name}</span>
                                          {!isAcademic && (
                                            <span className="text-[8px] bg-orange-50 text-orange-600 px-1 py-0.5 rounded shrink-0">إداري</span>
                                          )}
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>

                      {/* Column 3: Levels */}
                      {specificRoleConfig.student && (
                        <div className="w-1/3 flex flex-col bg-white">
                          <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between shrink-0">
                            <Label className="text-xs font-bold text-slate-700">3. الفئات والدرجات المستهدفة</Label>
                            <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                              {selectedLevels.length} محدد
                            </span>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2.5 space-y-3 scrollbar-thin">
                            {selectedDepartments.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                                <Building2 className="w-8 h-8 mb-2 opacity-40 text-slate-500" />
                                <p className="text-[11px] text-center text-slate-400 px-4">الرجاء اختيار قسم واحد على الأقل من القائمة الثانية</p>
                              </div>
                            ) : (
                              departments
                                .filter((d: any) => selectedDepartments.includes(d.department_id))
                                .map((dept: any) => {
                                  const deptLevels = dept.levels || [];
                                  if (deptLevels.length === 0) return null;
                                  return (
                                    <div key={dept.department_id} className="space-y-1">
                                      <p className="text-[10px] font-bold text-orange-600 mb-1 border-b border-slate-100 pb-0.5">{dept.dept_name}</p>
                                      {deptLevels.map((level: any) => {
                                        const isSelected = selectedLevels.includes(level.level_id);
                                        return (
                                          <label
                                            key={level.level_id}
                                            className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all text-xs hover:bg-slate-50 ${
                                              isSelected ? 'font-semibold text-slate-950 bg-slate-50' : 'text-slate-600'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedLevels([...selectedLevels, level.level_id]);
                                                } else {
                                                  setSelectedLevels(selectedLevels.filter((id: number) => id !== level.level_id));
                                                }
                                              }}
                                              className="w-3.5 h-3.5 accent-orange-500 rounded text-orange-500"
                                            />
                                            <span className="truncate flex-1">{level.name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="p-4 border-t bg-slate-50 gap-2 sm:gap-0">
            {showAudienceChangeWarning ? (
              <>
                <Button variant="outline" size="sm" onClick={handleWorkflowChangeClick}>
                  تغيير المسار
                </Button>
                <Button size="sm" onClick={handleConfirmPublish}>
                  إبقاء ونشر
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setPublishDialogOpen(false)}>إلغاء</Button>
                <Button size="sm" onClick={handleConfirmPublish}>تأكيد النشر</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Selection Dialog */}
      <WorkflowSelectionDialog
        open={workflowSelectionOpen}
        onOpenChange={setWorkflowSelectionOpen}
        onConfirm={handleWorkflowSelectionConfirm}
      />

      {/* Unpublish Confirmation Dialog */}
      <Dialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md gap-4">
          <DialogHeader className="space-y-2">
            <DialogTitle>تأكيد إلغاء النشر</DialogTitle>
            <DialogDescription>
              سيتم إيقاف النموذج ولن يتمكن الموظفون من تعبئته.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-sm text-orange-900">
              <div className="flex gap-2 items-start">
                <span className="text-lg"></span>
                <div className="space-y-1">
                  <p className="font-semibold">تنبيه هام</p>
                  <p className="text-xs text-orange-800 leading-relaxed">
                    إلغاء النشر لا يحذف البيانات السابقة، ولكن يمنع استقبال طلبات جديدة. يمكنك إعادة تفعيله في أي وقت.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setUnpublishDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={confirmUnpublish}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف هذا النموذج؟</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف النموذج وجميع البيانات المرتبطة به نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


