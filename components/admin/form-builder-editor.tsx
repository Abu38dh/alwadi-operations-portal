"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import {
  FileText,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  Upload,
  Heading3,
  Trash2,
  GripVertical,
  Copy,
  Eye,
  Save,
  UploadIcon,
  X,
  Plus,
  ArrowRight,
  Users,
  Check,
  Building2,
  Filter,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { saveFormTemplate, publishFormTemplate, getFormTemplate } from "@/app/actions/forms"
import { getAllColleges, getOrganizationStructure } from "@/app/actions/organizations"

import { Switch } from "@/components/ui/switch"
import { WorkflowSelectionDialog } from "@/components/admin/workflow-selection-dialog"
import PdfTemplateEditor from "@/components/admin/pdf-template-editor"

interface FormField {
  id: string
  label: string
  key: string
  type: "text" | "longtext" | "number" | "date" | "select" | "radio" | "checkbox" | "file" | "section" | "absence_picker"
  required: boolean
  placeholder?: string
  options?: { id: string; label: string }[]
}

interface FormBuilderEditorProps {
  formId: string
  onBack: () => void
  currentUserId?: string
}

const fieldTypes = [
  { id: "text", label: "نص قصير", icon: Type, color: "bg-blue-50 text-blue-700" },
  { id: "longtext", label: "نص طويل", icon: FileText, color: "bg-purple-50 text-purple-700" },
  { id: "number", label: "رقم", icon: Hash, color: "bg-primary/10 text-primary" },
  { id: "date", label: "تاريخ", icon: Calendar, color: "bg-secondary/10 text-secondary" },
  { id: "select", label: "قائمة منسدلة", icon: List, color: "bg-cyan-50 text-cyan-700" },
  { id: "radio", label: "اختيار واحد", icon: CheckSquare, color: "bg-indigo-50 text-indigo-700" },
  { id: "checkbox", label: "اختيارات متعددة", icon: CheckSquare, color: "bg-pink-50 text-pink-700" },
  { id: "file", label: "رفع ملف", icon: Upload, color: "bg-red-50 text-red-700" },
  { id: "absence_picker", label: "جدول بنود تفصيلي (آلي)", icon: Calendar, color: "bg-emerald-50 text-emerald-700" },
  { id: "section", label: "عنوان قسم", icon: Heading3, color: "bg-gray-50 text-gray-700" },
]

export default function FormBuilderEditor({ formId, onBack, currentUserId }: FormBuilderEditorProps) {
  const isNewForm = formId === "new"
  const [formName, setFormName] = useState("")
  const [fields, setFields] = useState<FormField[]>([])
  const [pdfTemplate, setPdfTemplate] = useState<string | undefined>(undefined)
  const [generateDocument, setGenerateDocument] = useState<boolean>(true)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false)
  const [savedFormId, setSavedFormId] = useState<number | null>(isNewForm ? null : parseInt(formId))
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!isNewForm)
  const [signatures, setSignatures] = useState<Array<{ id: string, url: string, name: string }>>([])
  const [stamps, setStamps] = useState<Array<{ id: string, url: string, name: string }>>([])

  // Workflow state
  const [workflowData, setWorkflowData] = useState<any>(null)
  const [currentWorkflow, setCurrentWorkflow] = useState<any>(null)

  // Audience targeting
  const [targetAudience, setTargetAudience] = useState<"student" | "employee" | "both" | "specific">("student")
  const [selectedColleges, setSelectedColleges] = useState<number[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<number[]>([])
  const [selectedLevels, setSelectedLevels] = useState<number[]>([])
  const [colleges, setColleges] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [specificRoleConfig, setSpecificRoleConfig] = useState({ student: true, employee: false })

  // Original state for change detection
  const [originalAudienceConfig, setOriginalAudienceConfig] = useState<any>(null)
  const [showAudienceWarning, setShowAudienceWarning] = useState(false)

  const { toast } = useToast()

  const selectedField = fields.find((f) => f.id === selectedFieldId)

  // Load form data when editing
  useEffect(() => {
    if (!isNewForm && formId) {
      loadFormData()
    }
  }, [formId, isNewForm])

  const loadFormData = async () => {
    setIsLoading(true)
    try {
      const result = await getFormTemplate(parseInt(formId))
      if (result.success && result.data) {
        setFormName(result.data.name || "")
        if (result.data.schema && Array.isArray(result.data.schema)) {
          const formFields = result.data.schema as unknown as FormField[]
          setFields(formFields)
          if (formFields.length > 0 && formFields[0]) {
            setSelectedFieldId(formFields[0].id)
          }
        }

        // Load PDF Template
        if ((result.data as any).pdf_template) {
            setPdfTemplate((result.data as any).pdf_template)
        }

        if ((result.data as any).generate_document !== undefined) {
            setGenerateDocument((result.data as any).generate_document !== false)
        }

        // Load Signature and Stamp
        if ((result.data as any).signature_url) {
            try {
              const parsed = JSON.parse((result.data as any).signature_url)
              if (Array.isArray(parsed)) {
                setSignatures(parsed)
              } else {
                setSignatures([{ id: 'default', url: (result.data as any).signature_url, name: 'التوقيع 1' }])
              }
            } catch (e) {
              setSignatures([{ id: 'default', url: (result.data as any).signature_url, name: 'التوقيع 1' }])
            }
        }
        if ((result.data as any).stamp_url) {
            try {
              const parsed = JSON.parse((result.data as any).stamp_url)
              if (Array.isArray(parsed)) {
                setStamps(parsed)
              } else {
                setStamps([{ id: 'default', url: (result.data as any).stamp_url, name: 'الختم 1' }])
              }
            } catch (e) {
              setStamps([{ id: 'default', url: (result.data as any).stamp_url, name: 'الختم 1' }])
            }
        }

        // Load Audience Config
        if (result.data.audience_config) {
          const config = result.data.audience_config as any
          setOriginalAudienceConfig(config)

          if (config.colleges?.length > 0 || config.departments?.length > 0 || config.levels?.length > 0) {
            setTargetAudience("specific")
            setSelectedColleges(config.colleges || [])
            setSelectedDepartments(config.departments || [])
            setSelectedLevels(config.levels || [])
            setSpecificRoleConfig({
              student: config.student !== false,
              employee: config.employee !== false
            })
          } else if (config.student && config.employee) {
            setTargetAudience("both")
          } else if (config.employee) {
            setTargetAudience("employee")
          } else {
            setTargetAudience("student")
          }
        }

        // Load Workflow safely
        if (result.data.request_types) {
          const rt = result.data.request_types as any
          // Handle potential array/object mismatch
          const actualRt = Array.isArray(rt) ? rt[0] : rt

          if (actualRt && actualRt.workflows) {
            const wf = actualRt.workflows
            // Handle potential array/object mismatch for workflows
            const finalWf = Array.isArray(wf) ? wf[0] : wf

            console.log("Workflow loaded:", finalWf)
            setCurrentWorkflow(finalWf)
          }
        }
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل في تحميل النموذج",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Load form error:", error)
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل النموذج",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load colleges, departments, and levels
  useEffect(() => {
    const loadData = async () => {
      const result = await getOrganizationStructure()
      if (result.success && result.data) {
        setColleges(result.data)
        // Extract all departments
        const allDepts = result.data.flatMap((c: any) =>
          (c.departments || []).map((d: any) => ({ ...d, college_id: c.college_id }))
        )
        setDepartments(allDepts)
      }
    }
    loadData()
  }, [])

  const addField = (typeId: string) => {
    const fieldType = fieldTypes.find((t) => t.id === typeId)
    const newField: FormField = {
      id: Date.now().toString(),
      label: `حقل جديد - ${fieldType?.label}`,
      key: `field_${Date.now()}`,
      type: typeId as FormField["type"],
      required: false,
      options: ["select", "radio", "checkbox"].includes(typeId) ? [{ id: "1", label: "الخيار 1" }] : undefined,
    }
    setFields([...fields, newField])
    setSelectedFieldId(newField.id)
  }

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  const deleteField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id))
    if (selectedFieldId === id) {
      setSelectedFieldId(fields.length > 1 ? fields[0].id : null)
    }
  }

  const duplicateField = (id: string) => {
    const fieldToDuplicate = fields.find((f) => f.id === id)
    if (!fieldToDuplicate) return
    const newField: FormField = {
      ...fieldToDuplicate,
      id: Date.now().toString(),
      key: `${fieldToDuplicate.key}_copy`,
    }
    const index = fields.findIndex((f) => f.id === id)
    setFields([...fields.slice(0, index + 1), newField, ...fields.slice(index + 1)])
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedFieldId(id)
    e.dataTransfer.effectAllowed = "move"
    // Set a transparent image or just let default behavior happen, 
    // but identifying the dragged item is key.
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault() // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedFieldId || draggedFieldId === targetId) return

    const newFields = [...fields]
    const draggedIndex = newFields.findIndex((f) => f.id === draggedFieldId)
    const targetIndex = newFields.findIndex((f) => f.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Remove dragged item
    const [draggedItem] = newFields.splice(draggedIndex, 1)
    // Insert at new position
    newFields.splice(targetIndex, 0, draggedItem)

    setFields(newFields)
    setDraggedFieldId(null)
  }

  const handleDragEnd = () => {
    setDraggedFieldId(null)
  }

  const addOption = (fieldId: string) => {
    updateField(fieldId, {
      options: [...(selectedField?.options || []), { id: Date.now().toString(), label: "خيار جديد" }],
    })
  }

  const updateOption = (fieldId: string, optionId: string, label: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (field?.options) {
      updateField(fieldId, {
        options: field.options.map((o) => (o.id === optionId ? { ...o, label } : o)),
      })
    }
  }

  const deleteOption = (fieldId: string, optionId: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (field?.options) {
      updateField(fieldId, {
        options: field.options.filter((o) => o.id !== optionId),
      })
    }
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال اسم للنموذج قبل الحفظ",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await saveFormTemplate({
        form_id: savedFormId || undefined,
        name: formName,
        schema: fields,
        requesterId: currentUserId,
        pdf_template: pdfTemplate,
        signature_url: signatures.length > 0 ? JSON.stringify(signatures) : undefined,
        stamp_url: stamps.length > 0 ? JSON.stringify(stamps) : undefined,
        generate_document: generateDocument
      })

      if (result.success && result.data) {
        setSavedFormId(result.data.form_id)
        toast({
          title: "تم الحفظ بنجاح",
          description: `تم حفظ النموذج "${formName}" مع ${fields.length} حقول`,
          duration: 3000,
        })
      } else {
        toast({
          title: "فشل الحفظ",
          description: result.error || "حدث خطأ أثناء الحفظ",
          variant: "destructive",
          duration: 3000,
        })
      }
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getNormalizedAudienceConfig = () => {
    const config: any = {}
    if (targetAudience === 'student') {
      config.student = true
      config.employee = false
    } else if (targetAudience === 'employee') {
      config.student = false
      config.employee = true
    } else if (targetAudience === 'specific') {
      config.student = specificRoleConfig.student
      config.employee = specificRoleConfig.employee
      if (selectedColleges.length > 0) config.colleges = selectedColleges
      if (selectedDepartments.length > 0) config.departments = selectedDepartments
      if (selectedLevels.length > 0) config.levels = selectedLevels
    } else {
      config.student = true
      config.employee = true
    }
    return config
  }

  const isAudienceChanged = () => {
    if (!originalAudienceConfig) return true

    const nextConfig = getNormalizedAudienceConfig()

    // Debug logging
    console.log("Audience Check - Original:", originalAudienceConfig)
    console.log("Audience Check - Next:", nextConfig)

    const arraysEqual = (a: any[], b: any[]) => {
      if ((!a || a.length === 0) && (!b || b.length === 0)) return true
      if (!a || !b) return false
      if (a.length !== b.length) return false
      const aSorted = [...a].sort()
      const bSorted = [...b].sort()
      return aSorted.every((val, index) => val === bSorted[index])
    }

    // Strict comparison
    const originalStudent = originalAudienceConfig.student === true
    const nextStudent = nextConfig.student === true
    if (originalStudent !== nextStudent) return true

    const originalEmployee = originalAudienceConfig.employee === true
    const nextEmployee = nextConfig.employee === true
    if (originalEmployee !== nextEmployee) return true

    if (!arraysEqual(originalAudienceConfig.colleges || [], nextConfig.colleges || [])) return true
    if (!arraysEqual(originalAudienceConfig.departments || [], nextConfig.departments || [])) return true
    if (!arraysEqual(originalAudienceConfig.levels || [], nextConfig.levels || [])) return true

    return false
  }

  const handlePublish = () => {
    if (fields.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب إضافة حقل واحد على الأقل قبل النشر",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    if (!formName.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال اسم للنموذج قبل النشر",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    // Check logic
    if (currentWorkflow) {
      // Pre-populate workflowData with existing workflow, and show publish confirm dialog directly
      setWorkflowData({
        mode: 'existing',
        workflowId: currentWorkflow.workflow_id,
        workflowName: currentWorkflow.name
      })
      setShowPublishConfirm(true)
      return
    }

    // New form or no workflow
    setShowWorkflowDialog(true)
  }

  const handleKeepWorkflow = () => {
    if (currentWorkflow) {
      setWorkflowData({ mode: 'existing', workflowId: currentWorkflow.workflow_id })
      setShowAudienceWarning(false)
      setShowPublishConfirm(true)
    }
  }

  const handleChangeWorkflow = () => {
    setShowAudienceWarning(false)
    setShowWorkflowDialog(true)
  }

  const handleWorkflowConfirm = (workflow: any) => {
    setWorkflowData(workflow)
    setShowWorkflowDialog(false)
    // Now show audience selection
    setShowPublishConfirm(true)
  }

  const confirmPublish = async () => {
    setIsSaving(true)
    try {
      // أولاً: احفظ النموذج إذا لم يُحفظ بعد
      let formIdToPublish = savedFormId

      if (!formIdToPublish) {
        const saveResult = await saveFormTemplate({
          form_id: savedFormId || undefined,
          name: formName,
          schema: fields,
          requesterId: currentUserId,
          pdf_template: pdfTemplate,
          generate_document: generateDocument
        })

        if (!saveResult.success || !saveResult.data) {
          toast({
            title: "فشل الحفظ",
            description: saveResult.error || "لا يمكن حفظ النموذج قبل النشر",
            variant: "destructive",
            duration: 3000,
          })
          setIsSaving(false)
          return
        }

        formIdToPublish = saveResult.data.form_id
        setSavedFormId(formIdToPublish)
      }

      // ثانياً: انشر النموذج مع معلومات الجمهور ومسار العمل
      const audienceConfig: any = {}
      if (targetAudience === 'student') {
        audienceConfig.student = true
        audienceConfig.employee = false
      } else if (targetAudience === 'employee') {
        audienceConfig.student = false
        audienceConfig.employee = true
      } else if (targetAudience === 'specific') {
        audienceConfig.student = specificRoleConfig.student
        audienceConfig.employee = specificRoleConfig.employee
        if (selectedColleges.length > 0) {
          audienceConfig.colleges = selectedColleges
        }
        if (selectedDepartments.length > 0) {
          audienceConfig.departments = selectedDepartments
        }
        if (selectedLevels.length > 0) {
          audienceConfig.levels = selectedLevels
        }
      } else {
        audienceConfig.student = true
        audienceConfig.employee = true
      }

      if (!formIdToPublish) {
        toast({
          title: "خطأ",
          description: "تعذر العثور على معرّف النموذج للنشر",
          variant: "destructive"
        })
        setIsSaving(false)
        return
      }

      const publishResult = await publishFormTemplate(
        formIdToPublish,
        audienceConfig,
        workflowData,
        currentUserId
      )

      if (publishResult.success) {
        const audienceLabel = targetAudience === 'student' ? 'لكافة الموظفين' : targetAudience === 'employee' ? 'للإدارة والمدراء' : 'لكافة منسوبي الشركة'
        toast({
          title: "تم النشر بنجاح",
          description: `تم نشر النموذج "${formName}" بنجاح ${audienceLabel}`,
          duration: 3000,
          className: "bg-primary text-white border-primary",
        })
        setShowPublishConfirm(false)
        setWorkflowData(null)
        // العودة لقائمة النماذج
        setTimeout(() => onBack(), 500)
      } else {
        toast({
          title: "فشل النشر",
          description: publishResult.error || "حدث خطأ أثناء النشر",
          variant: "destructive",
          duration: 3000,
        })
      }
    } catch (error) {
      console.error("Publish error:", error)
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background" dir="rtl">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">جارٍ تحميل النموذج...</p>
          </div>
        </div>
      ) : (
        <>
          <Tabs defaultValue="form" className="flex-1 flex flex-col overflow-hidden">
            {/* Unified Sleek Header */}
            <div className="bg-white border-b flex items-center justify-between px-4 py-3 shadow-sm shrink-0 relative z-10">
              {/* Right Side: Back Button & Title */}
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg">
                  <ArrowRight className="w-4 h-4" />
                  رجوع
                </Button>
                
                <div className="h-8 w-px bg-slate-200"></div>
                
                <div className="flex flex-col justify-center">
                  <label className="text-[10px] text-slate-500 font-bold mb-0.5 px-1">اسم النموذج <span className="text-red-500">*</span></label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="h-8 min-w-[280px] font-medium bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary px-3 text-sm shadow-inner rounded-md"
                    placeholder={isNewForm ? "اكتب اسم النموذج هنا..." : "اسم النموذج"}
                  />
                </div>
              </div>

              {/* Center: Tabs */}
              <div className="absolute left-1/2 -translate-x-1/2 hidden lg:block">
                <TabsList className="bg-slate-100/80 p-1 h-10 border border-slate-200 shadow-inner rounded-lg">
                  <TabsTrigger value="form" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm px-6 py-1.5 rounded-md transition-all font-medium text-slate-600 data-[state=active]:text-primary">تصميم النموذج</TabsTrigger>
                  <TabsTrigger value="template" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm px-6 py-1.5 rounded-md transition-all font-medium text-slate-600 data-[state=active]:text-primary">قالب الوثيقة الرسمية</TabsTrigger>
                </TabsList>
              </div>

              {/* Left Side: Actions */}
              <div className="flex items-center gap-2.5">
                <Button onClick={() => setShowPreview(true)} variant="outline" size="sm" className="gap-2 bg-white border-slate-200 hover:bg-slate-50 h-9 text-sm font-medium shadow-sm rounded-lg text-slate-700">
                  <Eye className="w-4 h-4 text-slate-500" />
                  معاينة
                </Button>
                <Button onClick={handleSave} disabled={isSaving} variant="outline" size="sm" className="gap-2 bg-white border-slate-200 hover:bg-slate-50 h-9 text-sm font-medium shadow-sm rounded-lg text-slate-700">
                  <Save className="w-4 h-4 text-slate-500" />
                  {isSaving ? "حفظ..." : "حفظ"}
                </Button>
                <Button onClick={handlePublish} disabled={isSaving} size="sm" className="bg-primary hover:bg-primary/90 text-white gap-2 h-9 text-sm font-medium shadow-sm rounded-lg">
                  <UploadIcon className="w-4 h-4" />
                  {isSaving ? "نشر..." : "نشر"}
                </Button>
              </div>
            </div>

            <TabsContent value="form" className="flex-1 flex flex-col p-0 m-0 data-[state=inactive]:hidden">
              <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* RIGHT COLUMN - Field Settings Panel (Now on Left/Start in LTR-rendered RTL) */}
                <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                  <div className="h-full overflow-y-auto border-l p-4">
                    {selectedField ? (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-semibold" required>تسمية الحقل</Label>
                          <Input
                            value={selectedField.label}
                            onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-semibold" required>نوع الحقل</Label>
                          <Select
                            value={selectedField.type}
                            onValueChange={(value) =>
                              updateField(selectedField.id, {
                                type: value as FormField["type"],
                              })
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="اختر النوع" />
                            </SelectTrigger>
                            <SelectContent>
                              {fieldTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="required"
                            checked={selectedField.required}
                            onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="required" className="text-sm font-semibold cursor-pointer">
                            حقل مطلوب
                          </Label>
                        </div>

                        {selectedField.type !== "section" && (
                          <div>
                            <Label className="text-sm font-semibold">نص التلميح</Label>
                            <Input
                              value={selectedField.placeholder || ""}
                              onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                              className="mt-1"
                              placeholder="أدخل نص التلميح"
                            />
                          </div>
                        )}

                        {["select", "radio", "checkbox"].includes(selectedField.type) && (
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-sm font-semibold">الخيارات</Label>
                            <div className="space-y-2">
                              {selectedField.options?.map((option) => (
                                <div key={option.id} className="flex gap-2 items-center">
                                  <Input
                                    value={option.label}
                                    onChange={(e) => updateOption(selectedField.id, option.id, e.target.value)}
                                    className="text-sm"
                                    placeholder="تسمية الخيار"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteOption(selectedField.id, option.id)}
                                    className="text-destructive hover:bg-destructive/10"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addOption(selectedField.id)}
                                className="w-full gap-1 text-sm"
                              >
                                <Plus className="w-3 h-3" />
                                إضافة خيار
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Info Note */}
                        {selectedField.type === "absence_picker" ? (
                          <div className="mt-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 text-right">
                            <p className="font-semibold mb-1">حقل آلي ✨</p>
                            <p>هذا الحقل يتيح لمقدم الطلب إدراج جدول بنود وتواريخ محددة ليتم تدقيقها واعتمادها آلياً ضمن الطلب.</p>
                          </div>
                        ) : (
                          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 text-right">
                            <p className="font-semibold mb-1">معلومة</p>
                            <p>هذه الإعدادات تتحكم في كيفية ظهور هذا الحقل في نماذج الطلبات الخاصة بموظفي ومنسوبي الشركة.</p>
                          </div>
                        )}

                        {/* Field Actions */}
                        <div className="space-y-2 pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateField(selectedField.id)}
                            className="w-full gap-2 text-sm"
                          >
                            <Copy className="w-4 h-4" />
                            نسخ الحقل
                          </Button>
                          <div className="flex gap-2">
                            {/* Drag and Drop enabled - Buttons removed */}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteField(selectedField.id)}
                            className="w-full gap-2 text-destructive hover:bg-destructive/10 text-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                            حذف الحقل
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <FileText className="w-12 h-12 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">حدد حقلاً لتحرير خصائصه</p>
                      </div>
                    )}
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* MIDDLE COLUMN - Form Canvas */}
                <ResizablePanel defaultSize={40} minSize={25}>
                  <div className="h-full overflow-y-auto p-4">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-foreground mb-4">حقول النموذج ({fields.length})</h3>
                      {fields.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <FileText className="w-12 h-12 text-muted-foreground mb-2" />
                          <p className="text-muted-foreground text-sm">اسحب أنواع الحقول من اليسار لإنشاء نموذجك</p>
                        </div>
                      ) : (
                        fields.map((field) => {
                          const fieldType = fieldTypes.find((t) => t.id === field.type)
                          const Icon = fieldType?.icon
                          return (
                            <div
                              key={field.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, field.id)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, field.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedFieldId(field.id)}
                              className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-150 ${selectedFieldId === field.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-card hover:bg-slate-50 hover:border-slate-200'}`}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                                <div className="flex-1 min-w-0 text-right">
                                  <p className="font-medium text-sm text-foreground truncate">{field.label}</p>
                                  <div className="flex items-center gap-2 mt-1 justify-end">
                                    {field.required && <Badge className="bg-red-100 text-red-800 text-xs">مطلوب</Badge>}
                                    <Badge variant="outline" className="text-xs">
                                      {fieldType?.label}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* LEFT COLUMN - Field Toolbox (Now on Right/End in LTR-rendered RTL) */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                  <div className="h-full overflow-y-auto border-r p-4">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-foreground mb-4">أنواع الحقول</h3>
                      {fieldTypes.map((type) => {
                        const Icon = type.icon
                        return (
                          <button
                            key={type.id}
                            onClick={() => addField(type.id)}
                            className={`w-full p-3 rounded-lg border-2 border-transparent hover:border-primary transition-all ${type.color}`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 flex-shrink-0" />
                              <div className="text-right">
                                <div className="text-sm font-medium">{type.label}</div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </ResizablePanel>

              </ResizablePanelGroup>
          </TabsContent>

          {/* Preview Dialog */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>معاينة النموذج: {formName}</DialogTitle>
                <DialogDescription>هذه معاينة لكيفية ظهور النموذج للمستخدمين</DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {fields.map((field) => {
                  const fieldType = fieldTypes.find((t) => t.id === field.type)
                  return (
                    <div key={field.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="font-medium text-foreground flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-red-500 font-bold">*</span>}
                        </label>
                      </div>

                      {field.type === "text" && (
                        <input
                          type="text"
                          placeholder={field.placeholder}
                          disabled
                          className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
                        />
                      )}
                      {field.type === "longtext" && (
                        <textarea
                          placeholder={field.placeholder}
                          disabled
                          rows={4}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
                        />
                      )}
                      {field.type === "number" && (
                        <input
                          type="number"
                          placeholder={field.placeholder}
                          disabled
                          className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
                        />
                      )}
                      {field.type === "date" && (
                        <Button
                          disabled
                          variant="outline"
                          className="w-full justify-start text-right font-normal border border-border rounded-lg bg-muted text-muted-foreground h-10 px-3 opacity-100"
                        >
                          <Calendar className="ml-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span>تاريخ...</span>
                        </Button>
                      )}
                      {field.type === "file" && (
                        <input
                          type="file"
                          disabled
                          className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
                        />
                      )}
                      {field.type === "section" && (
                        <div className="text-sm font-semibold text-foreground mt-2">{field.label}</div>
                      )}
                      {["select", "radio", "checkbox"].includes(field.type) && (
                        <div className="space-y-2">
                          {field.options?.map((option) =>
                            field.type === "select" ? (
                              <div key={option.id}>{option.label}</div>
                            ) : (
                              <div key={option.id} className="flex items-center gap-2">
                                {field.type === "radio" ? (
                                  <input type="radio" disabled className="w-4 h-4" />
                                ) : (
                                  <input type="checkbox" disabled className="w-4 h-4" />
                                )}
                                <label className="text-sm text-foreground">{option.label}</label>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  إغلاق
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Publish Confirmation Dialog */}
          {/* Publish Confirmation Dialog */}
          <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
            <DialogContent dir="rtl" className="sm:max-w-4xl max-w-4xl w-[90vw] gap-0 p-0 overflow-hidden">
              <DialogHeader className="p-5 border-b bg-slate-50/50">
                <DialogTitle className="text-xl font-bold text-slate-800">إعدادات استهداف ونشر النموذج</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  حدد الفئات والإدارات المستهدفة ومسار العمل قبل نشر النموذج للعمل به.
                </DialogDescription>
              </DialogHeader>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Form Info Box */}
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-start gap-4">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-slate-800">{formName}</p>
                    <p className="text-xs text-slate-500">
                      يحتوي على {fields.length} حقول • {targetAudience === 'student' ? 'متاح لجميع الموظفين' : targetAudience === 'employee' ? 'متاح للإداريين والمدراء' : targetAudience === 'both' ? 'متاح للجميع' : 'استهداف مخصص'}
                    </p>
                  </div>
                </div>

                {/* Workflow Info Box */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col text-right">
                    <span className="text-sm text-slate-600 font-semibold">مسار العمل المرتبط بالنموذج:</span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {workflowData?.mode === 'new' 
                        ? 'مسار مخصص جديد تم تصميمه' 
                        : 'مسار جاهز من مكتبة مسارات العمل'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-white shadow-sm border font-bold text-slate-700 px-3 py-1">
                      {workflowData?.mode === 'new' 
                        ? workflowData.newWorkflow?.name 
                        : (workflowData?.workflowName || currentWorkflow?.name || 'لا يوجد مسار')}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      type="button"
                      onClick={() => {
                        setShowPublishConfirm(false)
                        setShowWorkflowDialog(true)
                      }}
                      className="text-xs font-semibold"
                    >
                      تغيير المسار
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Premium Cards for Audience Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">من يستطيع تعبئة هذا النموذج؟ (الجمهور المستهدف)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: "student", label: "جميع الموظفين", desc: "متاح لكافة موظفي الشركة", icon: Users, color: "text-blue-600 bg-blue-50/50 border-blue-200" },
                        { id: "employee", label: "الإدارة والمدراء", desc: "متاح لمدراء الأقسام والإدارة", icon: Building2, color: "text-purple-600 bg-purple-50/50 border-purple-200" },
                        { id: "both", label: "كافة منسوبي الشركة", desc: "متاح للجميع بدون استثناء", icon: Check, color: "text-emerald-600 bg-emerald-50/50 border-emerald-200" },
                        { id: "specific", label: "استهداف مخصص", desc: "فروع وأقسام وإدارات محددة", icon: Filter, color: "text-orange-600 bg-orange-50/50 border-orange-200" }
                      ].map(option => {
                        const isSelected = targetAudience === option.id;
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setTargetAudience(option.id as any)}
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

                  {targetAudience === 'specific' && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
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

                      {/* Cascading Selection Flow */}
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
                                    <label 
                                      key={college.college_id} 
                                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border transition-all text-xs ${
                                        isSelected 
                                          ? 'bg-primary/5 border-primary/30 text-primary font-semibold' 
                                          : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedColleges([...selectedColleges, college.college_id]);
                                          } else {
                                            setSelectedColleges(selectedColleges.filter((id: number) => id !== college.college_id));
                                            // Cascade deselect: departments and levels of this college
                                            const collegeDepts = departments.filter((d: any) => d.college_id === college.college_id);
                                            const collegeDeptIds = collegeDepts.map((d: any) => d.department_id);
                                            setSelectedDepartments(prev => prev.filter(id => !collegeDeptIds.includes(id)));
                                            const collegeLevels = collegeDepts.flatMap((d: any) => d.levels || []);
                                            const collegeLevelIds = collegeLevels.map((l: any) => l.level_id);
                                            setSelectedLevels(prev => prev.filter(id => !collegeLevelIds.includes(id)));
                                          }
                                        }}
                                        className="w-4 h-4 accent-primary rounded text-primary"
                                      />
                                      <span className="truncate flex-1">{college.name}</span>
                                    </label>
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
                                            </label>
                                          );
                                        })}
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </div>

                          {/* Column 3: Job Levels / Categories */}
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
                                    <Users className="w-8 h-8 mb-2 opacity-40 text-slate-500" />
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
              </div>

              <DialogFooter className="p-4 border-t bg-slate-50 gap-2 sm:gap-0">
                <Button variant="outline" size="sm" onClick={() => setShowPublishConfirm(false)}>
                  إلغاء
                </Button>
                <Button size="sm" onClick={confirmPublish} className="bg-primary hover:bg-primary/90">
                  تأكيد النشر
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Audience Change Warning Dialog */}
          <Dialog open={showAudienceWarning} onOpenChange={setShowAudienceWarning}>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">تنبيه: تغيير الجمهور المستهدف</DialogTitle>
                <DialogDescription className="pt-2 text-base">
                  لقد قمت بتغيير الجمهور المستهدف لهذا النموذج. هل تريد الاستمرار في استخدام مسار العمل الحالي أم تغييره؟
                </DialogDescription>
              </DialogHeader>

              {currentWorkflow && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2">
                  <p className="text-sm font-semibold text-gray-700 mb-1">المسار الحالي:</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white">{currentWorkflow.name}</Badge>
                    {/* @ts-ignore */}
                    <span className="text-xs text-muted-foreground">({currentWorkflow.workflow_steps?.length || 0} خطوات)</span>
                  </div>
                </div>
              )}

              <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
                <Button variant="outline" onClick={handleChangeWorkflow} className="flex-1">
                  تغيير المسار
                </Button>
                <Button onClick={handleKeepWorkflow} className="flex-1 bg-primary hover:bg-primary/90">
                  إبقاء المسار الحالي
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Workflow Selection Dialog */}
          <WorkflowSelectionDialog
            open={showWorkflowDialog}
            onOpenChange={setShowWorkflowDialog}
            onConfirm={handleWorkflowConfirm}
          />

            <TabsContent value="template" className="flex-1 overflow-y-auto p-6 data-[state=inactive]:hidden">
              <div className="w-full space-y-6">
                {/* Premium Switch Section */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4 transition-all hover:bg-slate-50/80" dir="rtl">
                  <div className="flex items-center gap-3 text-right">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <Label className="text-sm font-bold text-slate-800 block text-right">توليد وثيقة رسمية عند اعتماد الطلب</Label>
                      <p className="text-xs text-slate-500 text-right mt-0.5" dir="rtl">
                        عند تفعيل هذا الخيار، سيقوم النظام تلقائياً بتوليد وثيقة قرار/إفادة رسمية بصيغة PDF لمقدم الطلب عند الموافقة النهائية على طلبه.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={generateDocument}
                    onCheckedChange={setGenerateDocument}
                    className="cursor-pointer shrink-0"
                  />
                </div>

                {generateDocument ? (
                  <div className="border border-slate-100 rounded-xl bg-white overflow-hidden shadow-sm">
                    <PdfTemplateEditor 
                      template={pdfTemplate || undefined}
                      onTemplateChange={setPdfTemplate}
                      signatures={signatures}
                      stamps={stamps}
                      onSignaturesChange={setSignatures}
                      onStampsChange={setStamps}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 border-2 border-dashed rounded-xl min-h-[300px]">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-slate-700 text-lg mb-1">إصدار الوثيقة الرسمية غير نشط</h3>
                    <p className="text-sm text-slate-500 max-w-md">
                      تم إلغاء تفعيل توليد وثيقة رسمية لهذا النموذج. عند الموافقة على الطلب، سيتم تغيير حالته فقط دون تصدير أي وثائق PDF رسمية.
                    </p>
                    <Button 
                      onClick={() => setGenerateDocument(true)}
                      className="mt-4 bg-primary text-white"
                      size="sm"
                    >
                      تفعيل إصدار الوثيقة
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}


