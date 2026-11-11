"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Plus, X, ArrowRight, Save, Trash2, CheckSquare, Clock } from "lucide-react"
import { getAllWorkflows } from "@/app/actions/workflows"
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
import { getApproversList } from "@/app/actions/admin"
import { useToast } from "@/hooks/use-toast"

interface WorkflowStep {
    name: string
    order: number
    approver_role_id?: number
    approver_user_id?: number | null
    sla_hours?: number
    is_final?: boolean
    escalation_role_id?: number | null
}

interface WorkflowSelectionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (workflowData: {
        mode: 'existing' | 'new' | 'none'
        workflowId?: number
        newWorkflow?: {
            name: string
            steps: WorkflowStep[]
        }
    }) => void
}

export function WorkflowSelectionDialog({
    open,
    onOpenChange,
    onConfirm,
}: WorkflowSelectionDialogProps) {
    const [mode, setMode] = useState<'existing' | 'new' | 'none'>('existing')
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | undefined>()
    const [workflows, setWorkflows] = useState<any[]>([])
    const [roles, setRoles] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])

    const [workflowName, setWorkflowName] = useState("")
    const [steps, setSteps] = useState<any[]>([])
    const [currentStep, setCurrentStep] = useState({
        name: "",
        approverId: "",
        sla: 48,
        slaUnit: "hours",
        isFinal: false,
        escalationRoleId: "none"
    })

    const sanitizeSteps = (stepList: any[]) => {
        return stepList.map((step, idx) => {
            const isLast = idx === stepList.length - 1;
            return {
                ...step,
                is_final: isLast ? (step.is_final || false) : false
            };
        });
    };

    const { toast } = useToast()

    useEffect(() => {
        if (open) {
            loadData()
            setMode('existing')
            setWorkflowName("")
            setSteps([])
            setCurrentStep({
                name: "",
                approverId: "",
                sla: 48,
                slaUnit: "hours",
                isFinal: false,
                escalationRoleId: "none"
            })
        }
    }, [open])

    const loadData = async () => {
        const [workflowsResult, approversResult] = await Promise.all([
            getAllWorkflows(),
            getApproversList()
        ])

        if (workflowsResult.success && workflowsResult.data) {
            setWorkflows(workflowsResult.data)
        }

        if (approversResult.success && approversResult.data) {
            setRoles(approversResult.data.roles || [])
            setUsers(approversResult.data.users || [])
        }
    }

    const handleFieldChange = (field: string, value: any) => {
        setCurrentStep(prev => ({ ...prev, [field]: value }))
    }

    const handleAddStep = () => {
        if (!currentStep.name || !currentStep.approverId) {
            toast({ title: "تنبيه", description: "يرجى إدخال اسم الخطوة واختيار المسؤول", variant: "destructive" })
            return
        }

        let roleId = 0
        let userId: number | null = null

        if (currentStep.approverId.startsWith('role_')) {
            roleId = parseInt(currentStep.approverId.split('_')[1])
        } else if (currentStep.approverId.startsWith('user_')) {
            userId = parseInt(currentStep.approverId.split('_')[1])
        }

        const selectedRole = roleId ? roles.find(r => r.role_id === roleId) : null
        const selectedUser = userId ? users.find(u => u.user_id === userId) : null

        const hodRole = roles.find(r => r.role_name === 'head_of_department')
        const hodRoleId = hodRole ? hodRole.role_id : null

        const hasEscalation = currentStep.escalationRoleId && currentStep.escalationRoleId !== "none"
        let escRoleId: number | null = null
        if (hasEscalation) {
            if (currentStep.escalationRoleId === "auto") {
                escRoleId = hodRoleId
            } else {
                escRoleId = parseInt(currentStep.escalationRoleId)
            }
        }

        const newStep = {
            name: currentStep.name,
            approver_role_id: roleId,
            approver_user_id: userId,
            roles: selectedRole,
            users: selectedUser,
            sla_hours: hasEscalation ? (currentStep.slaUnit === 'days' ? currentStep.sla * 24 : currentStep.sla) : null,
            is_final: currentStep.isFinal,
            escalation_role_id: escRoleId
        }

        setSteps(sanitizeSteps([...steps, newStep]))
        setCurrentStep({
            name: "",
            approverId: "",
            sla: 48,
            slaUnit: "hours",
            isFinal: false,
            escalationRoleId: "none"
        })
    }

    const removeStep = (index: number) => {
        setSteps(sanitizeSteps(steps.filter((_, i) => i !== index)))
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

    const handleConfirm = () => {
        if (mode === 'existing' && !selectedWorkflowId) {
            toast({ title: "خطأ", description: "يرجى اختيار مسار عمل", variant: "destructive" })
            return
        }

        if (mode === 'new') {
            if (!workflowName.trim()) {
                toast({ title: "خطأ", description: "يرجى إدخال اسم مسار العمل", variant: "destructive" })
                return
            }
            if (steps.length === 0) {
                toast({ title: "خطأ", description: "يرجى إضافة خطوة واحدة على الأقل", variant: "destructive" })
                return
            }
        }

        const data: any = { mode }

        if (mode === 'existing') {
            data.workflowId = selectedWorkflowId
            const selectedWf = workflows.find(w => w.workflow_id === selectedWorkflowId)
            if (selectedWf) {
                data.workflowName = selectedWf.name
            }
        } else if (mode === 'new') {
            data.newWorkflow = {
                name: workflowName,
                steps: steps.map((step, index) => ({
                    name: step.name,
                    order: index + 1,
                    approver_role_id: step.approver_role_id || undefined,
                    approver_user_id: step.approver_user_id || null,
                    sla_hours: step.sla_hours || null,
                    is_final: step.is_final || false,
                    escalation_role_id: step.escalation_role_id || null
                }))
            }
        }

        onConfirm(data)
    }

    const isLastStepFinal = steps.length > 0 && steps[steps.length - 1].is_final

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`${mode === 'new' ? 'max-w-7xl' : 'sm:max-w-2xl'} transition-[max-width] duration-500 ease-in-out max-h-[92dvh] overflow-y-auto overscroll-contain touch-pan-y`} style={{ WebkitOverflowScrolling: 'touch' }} dir="rtl">
                {/* Header - Fixed */}
                <DialogHeader className="p-6 border-b bg-white flex-shrink-0 z-10">
                    <DialogTitle className="text-2xl font-bold">تعيين مسار عمل للنموذج</DialogTitle>
                    <DialogDescription className="text-base mt-2 text-muted-foreground">
                        اختر مسار عمل موجود أو قم بتصميم مسار جديد مخصص لهذا النموذج
                    </DialogDescription>
                </DialogHeader>

                {/* Main Content - Scrollable */}
                <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">

                    {/* Mode Selection Cards */}
                    <RadioGroup value={mode} onValueChange={(value) => setMode(value as any)} className="mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <label
                                htmlFor="existing"
                                className={`relative flex flex-col items-start gap-4 p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md bg-white ${mode === 'existing'
                                    ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                                    : 'border-muted hover:border-muted-foreground/50'
                                    }`}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <div className={`p-3 rounded-full ${mode === 'existing' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                                        <ArrowRight className="w-6 h-6" />
                                    </div>
                                    <RadioGroupItem value="existing" id="existing" className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <div className="font-bold text-lg">مسار عمل موجود</div>
                                    <div className="text-sm text-muted-foreground leading-relaxed">
                                        اختيار مسار تم إعداده مسبقاً من المكتبة
                                    </div>
                                </div>
                            </label>

                            <label
                                htmlFor="new"
                                className={`relative flex flex-col items-start gap-4 p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md bg-white ${mode === 'new'
                                    ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                                    : 'border-muted hover:border-muted-foreground/50'
                                    }`}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <div className={`p-3 rounded-full ${mode === 'new' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                                        <Plus className="w-6 h-6" />
                                    </div>
                                    <RadioGroupItem value="new" id="new" className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <div className="font-bold text-lg">إنشاء مسار جديد</div>
                                    <div className="text-sm text-muted-foreground leading-relaxed">
                                        تصميم مسار مخصص بالكامل لهذا النموذج
                                    </div>
                                </div>
                            </label>
                        </div>
                    </RadioGroup>

                    <div className="relative mt-8 min-h-[120px] overflow-hidden">
                        {/* Mode: Existing Workflow */}
                        <div
                            className={`transition-all duration-500 ease-in-out ${
                                mode === 'existing'
                                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto relative max-h-[500px]'
                                    : 'opacity-0 -translate-y-4 scale-95 pointer-events-none absolute inset-0 max-h-0 overflow-hidden'
                            }`}
                        >
                            <div className="bg-white p-8 rounded-xl border shadow-sm space-y-4 max-w-3xl mx-auto">
                                <div className="space-y-2">
                                    <Label className="text-lg font-bold">اختر مسار العمل المطلوب</Label>
                                    <Select
                                        value={selectedWorkflowId ? String(selectedWorkflowId) : ""}
                                        onValueChange={(value) => setSelectedWorkflowId(value ? parseInt(value) : undefined)}
                                    >
                                        <SelectTrigger className="w-full bg-white border border-[#E2EDEC] rounded-xl py-2 px-3 text-right">
                                            <SelectValue placeholder="-- انقر للاختيار --" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {workflows.map((workflow) => (
                                                <SelectItem key={workflow.workflow_id} value={String(workflow.workflow_id)}>
                                                    {workflow.name} ({workflow.workflow_steps?.length || 0} خطوات)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Mode: New Workflow */}
                        <div
                            className={`transition-all duration-500 ease-in-out ${
                                mode === 'new'
                                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto relative max-h-[2500px]'
                                    : 'opacity-0 translate-y-4 scale-95 pointer-events-none absolute inset-0 max-h-0 overflow-hidden'
                            }`}
                        >
                            <div className="space-y-6 pt-2">
                                {/* Workflow Name */}
                                <div className="bg-white p-4 rounded-lg border shadow-sm">
                                    <Label className="text-base font-bold mb-2 block" required>اسم مسار العمل</Label>
                                    <Input
                                        placeholder="مثال: مسار موافقات طلبات الأجهزة"
                                        value={workflowName}
                                        onChange={(e) => setWorkflowName(e.target.value)}
                                        className="h-11 text-lg bg-gray-50 focus:bg-white transition-colors"
                                    />
                                </div>

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
                                                    استخدم لوحة الإعدادات لإضافة خطوة جديدة لمسار العمل.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {steps.map((step, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="relative group bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border-gray-200 hover:border-teal-300"
                                                    >
                                                        {/* Right Accent Bar */}
                                                        <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-teal-500 rounded-r-xl"></div>

                                                        <div className="p-4 pr-6 flex items-start gap-4">
                                                            {/* Delete Button */}
                                                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                                                                    onClick={() => removeStep(idx)}
                                                                >
                                                                    <Trash2 className="w-5 h-5" />
                                                                </Button>
                                                            </div>

                                                            {/* Step Number */}
                                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm mt-1">
                                                                {idx + 1}
                                                            </div>

                                                            <div className="flex-1">
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
                                                                            {getApproverName(step)}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center text-sm text-gray-500">
                                                                        <Clock className="w-3.5 h-3.5 ml-1.5" />
                                                                        <span>{step.sla_hours ? (step.sla_hours >= 24 ? `${step.sla_hours / 24} يوم المهلة` : `${step.sla_hours} ساعة المهلة`) : '24 ساعة المهلة'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Left Column: Configuration Sidebar (Visual Left in RTL) */}
                                    <div className="lg:col-span-4 space-y-4">
                                        <div className="border-none shadow-md sticky top-6 bg-white rounded-xl overflow-hidden">
                                            <div className="p-4 pb-3 border-b">
                                                <h3 className="text-lg font-bold text-gray-800">إعدادات الخطوة</h3>
                                                <p className="text-sm text-muted-foreground">تكوين خطوة جديدة</p>
                                            </div>
                                            <div className="p-4 space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium" required>اسم الخطوة</Label>
                                                    <Input
                                                        placeholder="مثال: مراجعة المدير"
                                                        value={currentStep.name}
                                                        onChange={(e) => handleFieldChange('name', e.target.value)}
                                                        className="bg-gray-50 focus:bg-white transition-colors"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium" required>المسؤول</Label>
                                                    <Select
                                                        value={currentStep.approverId}
                                                        onValueChange={(value) => handleFieldChange('approverId', value)}
                                                    >
                                                        <SelectTrigger className="w-full bg-white border border-[#E2EDEC] rounded-xl py-2 px-3 text-right mt-1">
                                                            <SelectValue placeholder="اختر المسؤول" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectGroup>
                                                                <SelectLabel>المستخدمين</SelectLabel>
                                                                {users.map((user: any) => (
                                                                    <SelectItem key={`user_${user.user_id}`} value={`user_${user.user_id}`}>
                                                                        {user.full_name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectGroup>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium text-gray-700">يتصعد إلى</Label>
                                                    <Select
                                                        value={currentStep.escalationRoleId}
                                                        onValueChange={(value) => handleFieldChange('escalationRoleId', value)}
                                                    >
                                                        <SelectTrigger className="w-full bg-white border border-[#E2EDEC] rounded-xl py-2 px-3 text-right mt-1">
                                                            <SelectValue placeholder="لا يوجد تصعيد" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">لا يوجد تصعيد</SelectItem>
                                                            <SelectItem value="auto">رئيس القسم (تلقائي)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {currentStep.escalationRoleId && currentStep.escalationRoleId !== "none" && (
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
                                                    </div>
                                                )}

                                                <div className="pt-4 space-y-3 border-t">
                                                    <label className="flex items-start gap-3 cursor-pointer group">
                                                        <div className="relative flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-teal-600 checked:bg-teal-600"
                                                                checked={currentStep.isFinal || false}
                                                                onChange={(e) => handleFieldChange('isFinal', e.target.checked)}
                                                            />
                                                            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                                                                <CheckSquare className="w-3.5 h-3.5" />
                                                            </div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <span className="block text-sm font-medium text-gray-700 group-hover:text-teal-700 transition-colors">خطوة الموافقة النهائية؟</span>
                                                            <span className="block text-xs text-muted-foreground mt-0.5">تحديد الطلب كموافق عليه</span>
                                                        </div>
                                                    </label>
                                                </div>

                                                {isLastStepFinal ? (
                                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mt-4 leading-relaxed">
                                                        * تم تحديد الخطوة الأخيرة كموافقة نهائية. لا يمكن إضافة خطوات بعدها. قم بحذف الخطوة الأخيرة أولاً لتتمكن من إضافة خطوة جديدة.
                                                    </div>
                                                ) : (
                                                    <Button onClick={handleAddStep} className="w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg transition-all h-12 text-base font-bold">
                                                        <Plus className="w-5 h-5 ml-2" />
                                                        إضافة خطوة جديدة
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Footer */}
                <div className="p-5 border-t bg-white flex justify-end gap-3 flex-shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 px-6">
                        إلغاء
                    </Button>
                    <Button onClick={handleConfirm} className="h-10 px-8 font-bold">
                        <Save className="w-4 h-4 ml-2" />
                        تأكيد وحفظ
                    </Button>
                </div>
            </DialogContent>
        </Dialog >
    )
}
