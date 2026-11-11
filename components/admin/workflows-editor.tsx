"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Edit2, Trash2, ArrowRight, ArrowUp, ArrowDown, Save, X, Search, Zap } from "lucide-react"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { ErrorMessage } from "@/components/ui/error-message"
import { EmptyState } from "@/components/ui/empty-state"
import { getAllWorkflows, createWorkflow, updateWorkflow, deleteWorkflow } from "@/app/actions/workflows"
import { getAllRoles, getApproversList } from "@/app/actions/admin"
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

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkflowsEditorProps {
  onBack: () => void
  currentUserId?: string
}

export default function WorkflowsEditor({ onBack, currentUserId }: WorkflowsEditorProps) {
  const [workflows, setWorkflows] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddWorkflow, setShowAddWorkflow] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const [workflowName, setWorkflowName] = useState("")
  const [steps, setSteps] = useState<any[]>([])

  // Step Configuration State
  const [currentStep, setCurrentStep] = useState({
    name: "",
    approverId: "", // Generic ID field: prefix 'role_' or 'user_'
    roleId: "",     // kept for backward compat if needed temporarily
    sla: 48,
    slaUnit: "hours",
    isFinal: false,
    escalatorId: ""
  })
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)

  const sanitizeSteps = (stepList: any[]) => {
    return stepList.map((step, idx) => {
      const isLast = idx === stepList.length - 1;
      return {
        ...step,
        is_final: isLast ? (step.is_final || false) : false
      };
    });
  };

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setError(null)

    try {
      const [workflowsResult, approversResult] = await Promise.all([
        getAllWorkflows(),
        getApproversList(currentUserId)
      ])

      if (workflowsResult.success && workflowsResult.data) {
        setWorkflows(workflowsResult.data)
      } else {
        setError(workflowsResult.error || "فشل في تحميل مسارات العمل")
      }

      if (approversResult.success && approversResult.data) {
        setRoles(approversResult.data.roles)
        setUsers(approversResult.data.users)
      }
    } catch (err) {
      console.error("Failed to fetch data:", err)
      setError("حدث خطأ في الاتصال بقاعدة البيانات")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWorkflow = async () => {
    if (!workflowName) {
      toast({ title: " خطأ", description: "يرجى إدخال اسم مسار العمل", variant: "destructive" })
      return
    }

    if (steps.length === 0) {
      toast({ title: " خطأ", description: "يرجى إضافة خطوة واحدة على الأقل", variant: "destructive" })
      return
    }

    try {
      // Prepare steps data
      const stepsData = steps.map((step, index) => ({
        step_id: step.step_id || undefined,
        name: step.name,
        order: index + 1,
        approver_role_id: step.approver_role_id || 0,
        approver_user_id: step.approver_user_id || null,
        sla_hours: step.sla_hours || 24,
        is_final: index === steps.length - 1,
        escalation_role_id: step.escalation_role_id || null,
        escalation_user_id: step.escalation_user_id || null,
        escalate_to_next: step.escalate_to_next || false
      }))

      if (editingWorkflow) {
        // Update existing workflow
        const result = await updateWorkflow(editingWorkflow.workflow_id, {
          name: workflowName,
          steps: stepsData,
          requesterId: currentUserId
        })

        if (result.success) {
          toast({ title: " تم التحديث بنجاح" })
        } else {
          toast({ title: " فشل التحديث", description: result.error, variant: "destructive" })
          return
        }
      } else {
        // Create new workflow
        const result = await createWorkflow({
          name: workflowName,
          steps: stepsData,
          requesterId: currentUserId
        })

        if (result.success) {
          toast({ title: " تم الإضافة بنجاح" })
        } else {
          toast({ title: " فشلت الإضافة", description: result.error, variant: "destructive" })
          return
        }
      }

      resetForm()
      await fetchData()
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  const handleEditWorkflow = (workflow: any) => {
    setEditingWorkflow(workflow)
    setWorkflowName(workflow.name)

    // Hydrate steps with user/role objects from global lists if missing
    // or ensure they are up to date
    const hydratedSteps = (workflow.workflow_steps || []).map((step: any) => {
      const roleId = step.approver_role_id
      const userId = step.approver_user_id

      const foundRole = roleId ? roles.find(r => r.role_id === roleId) : null
      const foundUser = userId ? users.find(u => u.user_id === userId) : null

      return {
        ...step,
        roles: step.roles || foundRole,
        users: step.users || foundUser
      }
    })

    setSteps(hydratedSteps)
    setShowAddWorkflow(true)
  }

  const handleDeleteWorkflow = (id: number) => {
    setItemToDelete(id)
    setDeleteDialogOpen(true)
  }

  const executeDelete = async () => {
    if (!itemToDelete) return

    try {
      const result = await deleteWorkflow(itemToDelete, currentUserId)

      if (result.success) {
        toast({ title: " تم الحذف بنجاح" })
        await fetchData()
        setDeleteDialogOpen(false)
        setItemToDelete(null)
      } else {
        toast({ title: " فشل الحذف", description: result.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: " خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" })
    }
  }

  // Handle changes to step fields
  const handleFieldChange = (field: keyof typeof currentStep, value: any) => {
    const updatedStep = { ...currentStep, [field]: value }
    setCurrentStep(updatedStep)
  }

  const handleAddStep = () => {
    if (!currentStep.name || !currentStep.approverId) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم الخطوة واختيار المسؤول", variant: "destructive" })
      return
    }

    // Parse ID
    let roleId = 0
    let userId: number | null = null

    if (currentStep.approverId.startsWith('role_')) {
      roleId = parseInt(currentStep.approverId.split('_')[1])
    } else if (currentStep.approverId.startsWith('user_')) {
      userId = parseInt(currentStep.approverId.split('_')[1])
    }

    // Find objects for UI display
    const selectedRole = roleId ? roles.find(r => r.role_id === roleId) : null
    const selectedUser = userId ? users.find(u => u.user_id === userId) : null

    // Parse Escalation ID
    let escRoleId: number | null = null
    let escUserId: number | null = null
    let escToNext = false
    
    if (currentStep.escalatorId === 'next_step') {
      escToNext = true
    } else if (currentStep.escalatorId.startsWith('role_')) {
      escRoleId = parseInt(currentStep.escalatorId.split('_')[1])
    } else if (currentStep.escalatorId.startsWith('user_')) {
      escUserId = parseInt(currentStep.escalatorId.split('_')[1])
    }

    if (editingStepIndex === null) {
      const hasEscalation = currentStep.escalatorId && currentStep.escalatorId !== 'none'
      const newStep = {
        name: currentStep.name,
        approver_role_id: roleId,
        approver_user_id: userId,
        roles: selectedRole, // Attach role object for UI
        users: selectedUser, // Attach user object for UI
        sla_hours: hasEscalation ? (currentStep.slaUnit === 'days' ? currentStep.sla * 24 : currentStep.sla) : null,
        sequence_order: steps.length + 1,
        is_final: currentStep.isFinal,
        escalation_role_id: hasEscalation ? escRoleId : null,
        escalation_user_id: hasEscalation ? escUserId : null,
        escalate_to_next: hasEscalation ? escToNext : false
      }
      setSteps(sanitizeSteps([...steps, newStep]))
      toast({ title: "تمت الإضافة", description: "تم إضافة الخطوة بنجاح" })

      // Reset form after add
      setCurrentStep({
        name: "",
        approverId: "",
        roleId: "",
        sla: 48,
        slaUnit: "hours",
        isFinal: false,
        escalatorId: ""
      })
    } else {
      const updatedSteps = [...steps]
      const currentSequence = updatedSteps[editingStepIndex].sequence_order
      const hasEscalation = currentStep.escalatorId && currentStep.escalatorId !== 'none'

      updatedSteps[editingStepIndex] = {
        step_id: updatedSteps[editingStepIndex].step_id,
        name: currentStep.name,
        approver_role_id: roleId,
        approver_user_id: userId,
        roles: selectedRole,
        users: selectedUser,
        sla_hours: hasEscalation ? (currentStep.slaUnit === 'days' ? currentStep.sla * 24 : currentStep.sla) : null,
        sequence_order: currentSequence,
        is_final: currentStep.isFinal,
        escalation_role_id: hasEscalation ? escRoleId : null,
        escalation_user_id: hasEscalation ? escUserId : null,
        escalate_to_next: hasEscalation ? escToNext : false
      }
      setSteps(sanitizeSteps(updatedSteps))
      toast({ title: "تم التعديل", description: "تم تعديل الخطوة بنجاح" })

      setCurrentStep({
        name: "",
        approverId: "",
        roleId: "",
        sla: 48,
        slaUnit: "hours",
        isFinal: false,
        escalatorId: ""
      })
      setEditingStepIndex(null)
    }
  }

  const handleEditStep = (step: any, index: number) => {
    setEditingStepIndex(index)

    let approverId = ""
    if (step.approver_user_id) {
      approverId = `user_${step.approver_user_id}`
    } else if (step.approver_role_id) {
      approverId = `role_${step.approver_role_id}`
    }

    let escalatorId = ""
    if (step.escalate_to_next) {
      escalatorId = "next_step"
    } else if (step.escalation_user_id) {
      escalatorId = `user_${step.escalation_user_id}`
    } else if (step.escalation_role_id) {
      escalatorId = `role_${step.escalation_role_id}`
    }

    setCurrentStep({
      name: step.name,
      approverId: approverId,
      roleId: "", // Legacy
      sla: step.sla_hours ? (step.sla_hours >= 24 && step.sla_hours % 24 === 0 ? step.sla_hours / 24 : step.sla_hours) : 48,
      slaUnit: step.sla_hours && step.sla_hours >= 24 && step.sla_hours % 24 === 0 ? 'days' : 'hours',
      isFinal: step.is_final || false,
      escalatorId: escalatorId
    })
  }

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index)
    // Reorder
    newSteps.forEach((step, i) => {
      step.sequence_order = i + 1
    })
    setSteps(sanitizeSteps(newSteps))
    if (editingStepIndex === index) {
      setEditingStepIndex(null)
      setCurrentStep({ name: "", approverId: "", roleId: "", sla: 48, slaUnit: "hours", isFinal: false, escalatorId: "" })
    }
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return

    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
      ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]

    // Update sequence
    newSteps.forEach((step, i) => {
      step.sequence_order = i + 1
    })

    setSteps(sanitizeSteps(newSteps))
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((item, index) => (item.id || `step-${index}`) === active.id);
        const newIndex = items.findIndex((item, index) => (item.id || `step-${index}`) === over?.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Re-assign sequence order and sanitize final status
        return sanitizeSteps(newItems.map((item, index) => ({
          ...item,
          sequence_order: index + 1
        })));
      });
    }
  };

  const resetForm = () => {
    setWorkflowName("")
    setSteps([])
    setShowAddWorkflow(false)
    setEditingWorkflow(null)
    setEditingStepIndex(null)
    setCurrentStep({ name: "", approverId: "", roleId: "", sla: 48, slaUnit: "hours", isFinal: false, escalatorId: "" })
  }

  const getApproverName = (step: any) => {
    if (step.approver_user_id) {
      const user = users.find(u => u.user_id === step.approver_user_id)
      return user ? `المستخدم: ${user.full_name}` : "مستخدم غير موجود"
    }

    if (step.approver_role_id) {
      const role = roles.find(r => r.role_id === step.approver_role_id)
      return role ? translateRole(role.role_name) : "غير محدد"
    }

    return "غير محدد"
  }

  if (loading) {
    return (
      <div className="min-h-full bg-white" dir="rtl">
        <div className="bg-white border-b border-[#E2EDEC] px-8 py-5">
          <h1 className="text-xl font-bold text-[#1C2E2D]">إدارة مسارات العمل</h1>
        </div>
        <div className="px-8 py-6"><TableSkeleton /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-full bg-white" dir="rtl">
        <div className="bg-white border-b border-[#E2EDEC] px-8 py-5">
          <h1 className="text-xl font-bold text-[#1C2E2D]">إدارة مسارات العمل</h1>
        </div>
        <div className="px-8 py-6"><ErrorMessage error={error} onRetry={fetchData} /></div>
      </div>
    )
  }

  if (showAddWorkflow) {
    const isLastStepFinal = steps.length > 0 && steps[steps.length - 1].is_final
    const isEditingLastStep = editingStepIndex !== null && editingStepIndex === steps.length - 1

    return (
      <div className="space-y-6 p-6 min-h-screen bg-gray-50/50" dir="rtl">
        {/* Combined Header & Workflow Name Card */}
        <Card className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>إدارة مسارات العمل</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
                <span className="font-semibold text-foreground">{editingWorkflow ? 'تعديل مسار' : 'مسار جديد'}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
                <Button onClick={handleSaveWorkflow} className="bg-primary hover:bg-primary/90">
                  <Save className="w-4 h-4 ml-2" />
                  حفظ المسار
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block" required>اسم مسار العمل</Label>
              <Input
                placeholder="مثال: مسار صرف قطع الغيار والمواد"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardContent>
        </Card>

        {/* Workflow Path Visualization (Breadcrumbs) */}
        {steps.length > 0 && (
          <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm border border-teal-100/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                <label className="text-sm font-medium text-teal-800">معاينة المسار</label>
              </div>

              <div className="flex items-center gap-2 flex-wrap min-h-[40px]">
                {/* Start Node */}
                <div className="flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 shadow-sm">
                  البداية
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 rotate-180 flex-shrink-0 mx-1" />

                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center">
                    <div
                      className={`flex items-center text-sm font-medium border rounded-full px-4 py-1.5 whitespace-nowrap shadow-sm transition-all
                      ${editingStepIndex === idx
                          ? 'bg-teal-50 border-teal-300 text-teal-700 ring-2 ring-teal-100 scale-105'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-teal-200 hover:bg-teal-50/50'
                        }`}
                    >
                      {step.name}
                      {step.is_final && (
                        <span className="mr-2 px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[10px]">نهاية</span>
                      )}
                    </div>
                    {idx < steps.length - 1 && (
                      <ArrowRight className="w-4 h-4 mx-2 text-gray-300 rotate-180 flex-shrink-0" />
                    )}
                  </div>
                ))}

                {/* End Node Arrow if steps exist */}
                <ArrowRight className="w-4 h-4 text-gray-300 rotate-180 flex-shrink-0 mx-1" />
                <div className="flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-teal-600 text-white shadow-sm ring-2 ring-teal-100 ring-offset-2">
                  اعتماد الطلب
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Two Column Layout - Swapped for correct RTL visual (Sidebar Left, List Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Right Column: Steps List (Visual Right in RTL) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">خطوات الموافقة</h2>
                <p className="text-sm text-gray-500">{steps.length} خطوات معدة</p>
              </div>
            </div>


            {steps.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-white">
                <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-teal-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">لا توجد خطوات بعد</h3>
                <p className="text-gray-500 mt-1 max-w-sm mx-auto">
                  استخدم الزر أعلاه لإضافة خطوة جديدة لمسار العمل.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={steps.map((s, i) => s.id || `step-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <SortableStep
                        key={step.id || `step-${index}`}
                        step={{ ...step, id: step.id || `step-${index}` }}
                        index={index}
                        editingStepIndex={editingStepIndex}
                        onEdit={handleEditStep}
                        onDelete={removeStep}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Left Column: Configuration Sidebar (Visual Left in RTL) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-none shadow-md sticky top-6">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg text-gray-800">إعدادات الخطوة</CardTitle>
                <CardDescription>
                  {editingStepIndex !== null ? `تكوين الخطوة #${editingStepIndex + 1}` : 'تكوين خطوة جديدة'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium" required>اسم الخطوة</Label>
                  <Input
                    placeholder="مراجعة الشؤون الإدارية"
                    value={currentStep.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium" required>الموافق</Label>
                  <Select
                    value={currentStep.approverId}
                    onValueChange={(value) => handleFieldChange('approverId', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="اختر المسؤول" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>المستخدمين</SelectLabel>
                        {users.map((user: any) => (
                          <SelectItem key={`user_${user.user_id}`} value={`user_${user.user_id}`}>
                            {user.full_name} ({user.university_id})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">يتصعد إلى</Label>
                  <Select
                    value={currentStep.escalatorId}
                    onValueChange={(value) => handleFieldChange('escalatorId', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="لا يوجد تصعيد" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">لا يوجد تصعيد</SelectItem>
                      <SelectItem value="next_step" className="font-semibold text-teal-700">الخطوة التالية (تلقائي)</SelectItem>
                      <SelectGroup>
                        <SelectLabel>مستخدم معين</SelectLabel>
                        {users.map((user: any) => (
                          <SelectItem key={`esc_user_${user.user_id}`} value={`user_${user.user_id}`}>
                            {user.full_name} ({user.university_id})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {currentStep.escalatorId && currentStep.escalatorId !== "none" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">المهلة</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={currentStep.sla}
                        onChange={(e) => handleFieldChange('sla', parseInt(e.target.value) || 0)}
                        className="flex-1 bg-gray-50 focus:bg-white"
                      />
                      <Select
                        value={currentStep.slaUnit}
                        onValueChange={(value) => handleFieldChange('slaUnit', value)}
                      >
                        <SelectTrigger className="w-24 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hours">ساعة</SelectItem>
                          <SelectItem value="days">يوم</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      التصعيد بعد {currentStep.sla} {currentStep.slaUnit === 'days' ? 'يوم' : 'ساعة'}
                    </p>
                  </div>
                )}

                <div className="pt-4 space-y-3 border-t">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-teal-600 checked:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        checked={currentStep.isFinal || false}
                        onChange={(e) => handleFieldChange('isFinal', e.target.checked)}
                        disabled={editingStepIndex !== null && !isEditingLastStep}
                      />
                      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-medium text-gray-700 group-hover:text-teal-700 transition-colors">خطوة الموافقة النهائية؟</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">تحديد الطلب كموافق عليه وتوليد PDF وإرسال إخطار</span>
                      {editingStepIndex !== null && !isEditingLastStep && (
                        <span className="block text-[10px] text-red-500 mt-1 font-medium">
                          * لا يمكن تفعيل الموافقة النهائية إلا لآخر خطوة في المسار.
                        </span>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-teal-600 checked:bg-teal-600"
                        defaultChecked={true}
                      />
                      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-medium text-gray-700 group-hover:text-teal-700 transition-colors">السماح بالتفويض / الوكيل؟</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">يمكن للموافق تفويض مستخدم آخر</span>
                    </div>
                  </label>
                </div>

                {editingStepIndex === null && isLastStepFinal ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mt-4 leading-relaxed">
                    * تم تحديد الخطوة الأخيرة كموافقة نهائية. لا يمكن إضافة خطوات بعدها. للتمكن من الإضافة، قم بتعديل الخطوة الأخيرة وإلغاء خيار الموافقة النهائية.
                  </div>
                ) : (
                  <Button onClick={handleAddStep} className="w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white">
                    {editingStepIndex !== null ? "حفظ التعديلات" : "+ إضافة خطوة جديدة"}
                  </Button>
                )}

               </CardContent>
            </Card>
          </div>

        </div>
      </div>
    )
  }

  const filtered = workflows.filter(w =>
    (w?.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  )

  return (
    <div dir="rtl" className="min-h-full bg-white">

      {/* ══ Page Header ══ */}
      <div className="bg-white border-b border-[#E2EDEC] px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F7F6] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-[#00A89D]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1C2E2D] leading-tight">مسارات العمل</h1>
              <p className="text-sm text-[#6B8F8E] mt-0.5">{workflows.length} مسار في النظام</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddWorkflow(true)}
            className="
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              bg-[#00A89D] text-white hover:bg-[#008A80] active:scale-95
              transition-all duration-150 shadow-sm shadow-[#00A89D]/20
            "
          >
            <Plus className="w-4 h-4" />
            مسار عمل جديد
          </button>
        </div>
      </div>

      {/* ══ Body ══ */}
      <div className="px-8 py-6 space-y-5">

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B8F8E]" />
          <input
            type="text"
            placeholder="بحث عن مسار..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="
              w-full pr-9 pl-4 py-2 text-sm rounded-xl
              border border-[#E2EDEC] bg-white text-[#1C2E2D]
              focus:outline-none focus:ring-2 focus:ring-[#00A89D]/25 focus:border-[#00A89D]
              transition-all placeholder:text-[#9BB5B4]
            "
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2EDEC] py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F7F6] flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-[#00A89D]" />
            </div>
            <p className="text-[#2D4847] font-semibold">
              {searchTerm ? "لا توجد نتائج" : "لا توجد مسارات عمل"}
            </p>
            <p className="text-sm text-[#6B8F8E] mt-1">
              {searchTerm ? "جرب كلمة بحث أخرى" : "أنشئ مسار عمل جديد للبدء"}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowAddWorkflow(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#008A80] transition-colors"
              >
                <Plus className="w-4 h-4" /> إنشاء مسار
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((workflow: any) => {
              const stepCount = workflow.workflow_steps?.length || 0
              return (
                <div
                  key={workflow.workflow_id}
                  className="
                    group bg-white rounded-2xl border border-[#E2EDEC]
                    hover:border-[#B3E8E5] hover:shadow-md hover:shadow-[#00A89D]/8
                    transition-all duration-200 overflow-hidden
                  "
                >
                  {/* Top section */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Step count badge */}
                        <div className="w-9 h-9 rounded-xl bg-[#E6F7F6] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-sm font-bold text-[#00A89D]">{stepCount}</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[#1C2E2D] truncate">{workflow.name}</h3>
                          <p className="text-xs text-[#6B8F8E] mt-0.5">
                            {stepCount === 0 ? "لا توجد خطوات" : `${stepCount} ${stepCount === 1 ? "خطوة" : "خطوات"} موافقة`}
                          </p>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleEditWorkflow(workflow)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B8F8E] hover:bg-[#E6F7F6] hover:text-[#00A89D] transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteWorkflow(workflow.workflow_id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B8F8E] hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline steps */}
                  {stepCount > 0 && (
                    <div className="px-5 pb-4">
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        {/* Start dot */}
                        <div className="w-2 h-2 rounded-full bg-[#00A89D] shrink-0" />
                        <div className="w-4 h-px bg-[#B3E8E5] shrink-0" />

                        {workflow.workflow_steps.map((step: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div
                              className="
                                flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                                border border-[#E2EDEC] bg-white text-[#2D4847]
                                whitespace-nowrap shrink-0
                              "
                            >
                              <span className="
                                w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
                                bg-[#00A89D] text-white shrink-0
                              ">
                                {idx + 1}
                              </span>
                              {step.name}
                            </div>
                            {idx < workflow.workflow_steps.length - 1 && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="w-3 h-px bg-[#B3E8E5]" />
                                <ArrowRight className="w-3 h-3 text-[#B3E8E5] rotate-180" />
                                <div className="w-3 h-px bg-[#B3E8E5]" />
                              </div>
                            )}
                          </div>
                        ))}

                        <div className="w-4 h-px bg-[#B3E8E5] shrink-0" />
                        {/* End node */}
                        <div className="
                          px-2 py-0.5 rounded-full text-[10px] font-semibold
                          bg-[#00A89D] text-white shrink-0
                        ">اعتماد</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1C2E2D]">هل أنت متأكد من حذف مسار العمل؟</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B8F8E]">
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف مسار العمل وجميع الخطوات المرتبطة به.
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

function ClockIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}


function GripVertical(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  )
}

function SortableStep({ step, index, editingStepIndex, onEdit, onDelete }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: step.id || `step-${index}`,
    transition: {
      duration: 150, // Faster duration (default is 250ms)
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${editingStepIndex === index
        ? 'border-teal-500 ring-1 ring-teal-500'
        : 'border-gray-200 hover:border-teal-300'
        }`}
    >
      {/* Right Accent Bar (Start in RTL) */}
      <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-teal-500 rounded-r-xl"></div>

      <div className="p-4 pr-6 flex items-start gap-4">
        {/* Delete Button (Left - End in RTL) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Button
            variant="ghost"
            size="icon"
            className="text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(index)
            }}
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Step Number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm mt-1">
          {index + 1}
        </div>

        <div className="flex-1 cursor-pointer" onClick={() => onEdit(step, index)}>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-lg">{step.name}</h3>
            {step.is_final && (
              <span className="text-[10px] font-medium px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">
                موافقة نهائية
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between pl-16">
              <p className="text-gray-600 text-sm">
                <span className="text-gray-400 ml-1">المسؤول:</span>
                {step.users?.full_name ? `المستخدم: ${step.users.full_name}` :
                  step.roles?.role_name ? `الدور: ${translateRole(step.roles.role_name)}` :
                    step.approver_user_id ? `مستخدم #${step.approver_user_id}` :
                      step.approver_role_id ? `دور #${step.approver_role_id}` :
                        "غير محدد"}
              </p>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <ClockIcon className="w-3.5 h-3.5 ml-1.5" />
              <span>{step.sla_hours ? (step.sla_hours >= 24 ? `${step.sla_hours / 24} يوم المهلة` : `${step.sla_hours} ساعة المهلة`) : '24 ساعة المهلة'}</span>
            </div>
          </div>
        </div>

        {/* Drag Handle (Top Right) */}
        <div
          className="absolute top-3 left-3 text-gray-300 cursor-move hover:text-teal-600 p-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}


