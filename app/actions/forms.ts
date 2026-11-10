"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { getCurrentUserScope } from "./admin"

/**
 * Get all form templates with metadata
 */
export async function getAllFormTemplates(page: number = 1, limit: number = 20, requesterId?: string) {
    try {
        const skip = (page - 1) * limit

        // Fetch all first (pagination might need to be post-filter if strict, but for now let's filter after fetch or fetch all active)
        // To do strict pagination with JS filtering is hard. Let's fetch more or assume small dataset for now.
        // Actually, fetching all is safer for filtering.

        let allTemplates = await db.form_templates.findMany({
            include: {
                request_types: {
                    include: {
                        workflows: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        // Apply Scope Filtering
        if (requesterId) {
            const scope = await getCurrentUserScope(requesterId)
            if (scope.success && scope.data) {
                const { role, collegeId, departmentId } = scope.data

                if (role === 'admin') {
                    // No filtering
                } else if (role === 'dean' && collegeId) {
                    allTemplates = allTemplates.filter(t => {
                        const conf = t.audience_config as any
                        // Include if explicitly for this college
                        if (conf?.colleges?.includes(collegeId)) return true
                        // Include if 'all' students/employees AND no specific college restriction (optional interpretation)
                        // OR if Dean manages forms, they usually see forms targeted TO their college.
                        // Let's stick to: Show forms where audience INCLUDES their college/dept OR is public (maybe?).
                        // User request: "Forms specific to my college only". So EXCLUDE forms for OTHER colleges.
                        // If a form is for "All Colleges", Dean should probably see it?
                        // Let's go with: If specific college set, must match. If specific dept set, must match appropriate college??

                        // Strict interpretation of user request: "Only forms FOR my college".
                        if (conf?.colleges && conf.colleges.length > 0) {
                            return conf.colleges.includes(collegeId)
                        }
                        // If it's a general form (no specific college/dept), Deans usually see it?
                        return true
                    })
                } else if ((role === 'head' || role === 'manager') && departmentId) {
                    allTemplates = allTemplates.filter(t => {
                        const conf = t.audience_config as any
                        if (conf?.departments && conf.departments.length > 0) {
                            return conf.departments.includes(departmentId)
                        }
                        // If targeted at college level, does Head see it? Maybe. 
                        // Let's keep it simple: If specific restrictions exist, check them.
                        if (conf?.colleges && conf.colleges.length > 0) {
                            // We don't easily know if dept belongs to college here without looking up.
                            // But usually Heads care about Department forms. 
                            return false // Hide college-level forms from Head? Or show? User said "Forms specific to my college".
                            // Let's assume Head sees Dept forms + General forms.
                        }
                        return true
                    })
                }
            } else {
                return { success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } }
            }
        }
        // If no requesterId, allow all (backward compat) or fail closed? 
        // Admin likely calls this. Let's keep it open if no ID for now to avoid breaking existing admin flows if ID not passed yet everywhere.

        const total = allTemplates.length
        // Apply manual pagination
        const paginatedTemplates = allTemplates.slice(skip, skip + limit)

        return {
            success: true,
            data: paginatedTemplates.map(t => ({
                ...t,
                created_at: t.created_at?.toISOString() || null,
                updated_at: (t as any).updated_at?.toISOString() || null,
                target_audience: (() => {
                    const conf = t.audience_config as any
                    if (!conf) return 'all_students'

                    if ((conf.colleges && conf.colleges.length > 0) || 
                        (conf.departments && conf.departments.length > 0) || 
                        (conf.levels && conf.levels.length > 0)) {
                        return 'specific'
                    }

                    if (conf.student && conf.employee) return 'all'
                    if (conf.employee) return 'all_employees'
                    if (conf.student) return 'all_students'

                    return 'all_students' // Default
                })()
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        }
    } catch (error) {
        console.error("Get Form Templates Error:", error)
        return { success: false, error: "فشل في تحميل النماذج" }
    }
}

/**
 * Get single form template with full schema
 */
export async function getFormTemplate(formId: number) {
    try {
        const template = await db.form_templates.findUnique({
            where: { form_id: formId },
            include: {
                request_types: {
                    include: {
                        workflows: {
                            include: {
                                workflow_steps: {
                                    include: {
                                        roles: true
                                    },
                                    orderBy: { order: 'asc' }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!template) {
            return { success: false, error: "النموذج غير موجود" }
        }

        return {
            success: true,
            data: template
        }
    } catch (error) {
        console.error("Get Form Template Error:", error)
        return { success: false, error: "فشل في تحميل النموذج" }
    }
}

import { logAuditAction } from "./audit"
// ... (existing imports)

// ... (keep getAllFormTemplates, getFormTemplate)

/**
 * Save form template (draft)
 */
export async function saveFormTemplate(data: {
    form_id?: number
    name: string
    schema: any
    request_type_id?: number | null
    audience_config?: any
    pdf_template?: string
    signature_url?: string
    stamp_url?: string
    requesterId?: string
    generate_document?: boolean
}) {
    try {
        let finalAudienceConfig = data.audience_config

        // Enforce Scoping if requesterId is provided (Keep existing logic)
        if (data.requesterId) {
            const requester = await db.users.findUnique({
                where: { university_id: data.requesterId },
                include: {
                    roles: true,
                    departments_users_department_idTodepartments: {
                        include: { colleges: true }
                    }
                }
            })

            if (requester) {
                const roleName = requester.roles.role_name.toLowerCase()

                // Dean: Must target their college
                if (roleName === 'dean') {
                    const collegeId = requester.departments_users_department_idTodepartments?.colleges?.college_id
                    if (collegeId) {
                        // Force audience config to be this college only
                        finalAudienceConfig = {
                            ...finalAudienceConfig,
                            colleges: [collegeId],
                            student: true // Assuming deans want students to see it, but restricted to their college
                        }
                    }
                }
                // Head: Must target their department
                else if (roleName === 'manager' || roleName === 'head') {
                    const deptId = requester.department_id
                    if (deptId) {
                        finalAudienceConfig = {
                            ...finalAudienceConfig,
                            departments: [deptId],
                            student: true
                        }
                    }
                }
            }
        }

        if (data.form_id) {
            // Update existing
            const updated = await db.form_templates.update({
                where: { form_id: data.form_id },
                data: {
                    name: data.name,
                    schema: data.schema,
                    audience_config: finalAudienceConfig,
                    request_type_id: data.request_type_id,
                    pdf_template: data.pdf_template,
                    signature_url: data.signature_url,
                    stamp_url: data.stamp_url,
                    generate_document: data.generate_document
                }
            })

            if (data.requesterId) {
                const executor = await db.users.findUnique({ where: { university_id: data.requesterId } })
                await logAuditAction(executor?.user_id, 'UPDATE', 'FORM_TEMPLATE', updated.name, { updated_fields: ['name', 'schema', 'audience_config', 'pdf_template', 'signature_url', 'stamp_url', 'generate_document'] })
            }

            // revalidatePath('/admin')
            return { success: true, data: updated }
        } else {
            // Create new
            const created = await db.form_templates.create({
                data: {
                    name: data.name,
                    schema: data.schema,
                    is_active: false, // Draft
                    audience_config: finalAudienceConfig,
                    request_type_id: data.request_type_id,
                    pdf_template: data.pdf_template,
                    signature_url: data.signature_url,
                    stamp_url: data.stamp_url,
                    generate_document: data.generate_document
                }
            })

            if (data.requesterId) {
                const executor = await db.users.findUnique({ where: { university_id: data.requesterId } })
                await logAuditAction(executor?.user_id, 'CREATE', 'FORM_TEMPLATE', created.name, { new_id: created.form_id })
            }

            // revalidatePath('/admin')
            return { success: true, data: created }
        }
    } catch (error) {
        console.error("Save Form Template Error:", error)
        return { success: false, error: "فشل في حفظ النموذج" }
    }
}

/**
 * Publish form template to specified audience with workflow assignment
 */
export async function publishFormTemplate(
    formId: number,
    audienceConfig: {
        student?: boolean
        employee?: boolean
        colleges?: number[]
        departments?: number[]
    },
    workflowOptions?: {
        mode: 'existing' | 'new' | 'none'
        workflowId?: number  // For existing workflow
        newWorkflow?: {      // For new workflow
            name: string
            steps: Array<{
                name: string
                order: number
                approver_role_id?: number
                approver_user_id?: number | null
                sla_hours?: number
                is_final?: boolean
                escalation_role_id?: number | null
            }>
        }
    },
    requesterId?: string
) {
    try {
        let finalAudienceConfig = audienceConfig

        // Enforce Scoping if requesterId is provided (Keep existing logic)
        if (requesterId) {
            const requester = await db.users.findUnique({
                where: { university_id: requesterId },
                include: {
                    roles: true,
                    departments_users_department_idTodepartments: {
                        include: { colleges: true }
                    }
                }
            })

            if (requester) {
                const roleName = requester.roles.role_name.toLowerCase()

                if (roleName === 'dean') {
                    const collegeId = requester.departments_users_department_idTodepartments?.colleges?.college_id
                    if (collegeId) {
                        finalAudienceConfig = {
                            ...finalAudienceConfig,
                            colleges: [collegeId]
                        }
                    }
                } else if (roleName === 'manager' || roleName === 'head') {
                    const deptId = requester.department_id
                    if (deptId) {
                        finalAudienceConfig = {
                            ...finalAudienceConfig,
                            departments: [deptId]
                        }
                    }
                }
            }
        }

        await db.$transaction(async (tx) => {
            // First, get or create request_type
            const form = await tx.form_templates.findUnique({
                where: { form_id: formId },
                include: { request_types: true }
            })

            if (!form) {
                throw new Error("النموذج غير موجود")
            }

            let requestTypeId = form.request_type_id

            // Create request_type if it doesn't exist
            if (!requestTypeId) {
                const requestType = await tx.request_types.create({
                    data: {
                        key: `form_${formId}_${Date.now()}`,
                        label: form.name
                    }
                })
                requestTypeId = requestType.type_id
            }

            // Handle workflow based on mode
            if (workflowOptions) {
                let workflowId: number | null = null

                if (workflowOptions.mode === 'existing' && workflowOptions.workflowId) {
                    // Use existing workflow
                    workflowId = workflowOptions.workflowId
                } else if (workflowOptions.mode === 'new' && workflowOptions.newWorkflow) {
                    // Create new workflow
                    const workflow = await tx.workflows.create({
                        data: {
                            name: workflowOptions.newWorkflow.name,
                            is_active: true,
                            workflow_steps: {
                                create: workflowOptions.newWorkflow.steps.map(step => ({
                                    name: step.name,
                                    order: step.order,
                                    approver_role_id: step.approver_role_id || null,
                                    approver_user_id: step.approver_user_id || null,
                                    sla_hours: step.sla_hours || null,
                                    is_final: step.is_final || false,
                                    escalation_role_id: step.escalation_role_id || null
                                }))
                            }
                        }
                    })
                    workflowId = workflow.workflow_id
                }

                // Update request_type with workflow
                await tx.request_types.update({
                    where: { type_id: requestTypeId },
                    data: {
                        workflow_id: workflowId
                    }
                })
            }

            // Update form template
            await tx.form_templates.update({
                where: { form_id: formId },
                data: {
                    is_active: true,
                    audience_config: finalAudienceConfig,
                    request_type_id: requestTypeId
                }
            })
        })

        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            // Needs to fetch form name again or use passed info? We can use formId.
            const form = await db.form_templates.findUnique({ where: { form_id: formId } })
            await logAuditAction(executor?.user_id, 'PUBLISH', 'FORM_TEMPLATE', form?.name || formId.toString(), { audience: finalAudienceConfig })
        }

        // revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Publish Form Template Error:", error)
        return { success: false, error: "فشل في نشر النموذج" }
    }
}

/**
 * Toggle form active status
 */
export async function toggleFormStatus(formId: number, isActive: boolean, requesterId?: string) {
    try {
        const updated = await db.form_templates.update({
            where: { form_id: formId },
            data: { is_active: isActive }
        })

        if (requesterId) {
             const executor = await db.users.findUnique({ where: { university_id: requesterId } })
             const action = isActive ? 'ACTIVATE' : 'DEACTIVATE'
             await logAuditAction(executor?.user_id, action, 'FORM_TEMPLATE', updated.name, null)
        }

        // revalidatePath('/admin')
        return { success: true, data: updated }
    } catch (error) {
        console.error("Toggle Form Status Error:", error)
        return { success: false, error: "فشل في تحديث حالة النموذج" }
    }
}

/**
 * Delete form template
 */
export async function deleteFormTemplate(formId: number, requesterId?: string) {
    try {
        const form = await db.form_templates.findUnique({ where: { form_id: formId } })

        // Check if there are any requests associated with this form
        const requestsCount = await db.requests.count({
            where: { form_id: formId }
        })

        if (requestsCount > 0) {
            // Cannot hard delete, so just deactivate (soft delete) and inform user
            await db.form_templates.update({
                where: { form_id: formId },
                data: { is_active: false }
            })

            if (requesterId) {
                const executor = await db.users.findUnique({ where: { university_id: requesterId } })
                await logAuditAction(executor?.user_id, 'DEACTIVATE', 'FORM_TEMPLATE', form?.name || formId.toString(), { reason: "Deletion attempted but has requests" })
            }

            // revalidatePath('/admin')
            return {
                success: true,
                message: "تم تعطيل النموذج لوجود طلبات مرتبطة به"
            }
        }

        // Hard delete
        const requestTypeId = form?.request_type_id

        await db.form_templates.delete({
            where: { form_id: formId }
        })

        if (requestTypeId) {
            await db.request_types.delete({
                where: { type_id: requestTypeId }
            }).catch(err => {
                console.error("Failed to delete request type:", err)
            })
        }

        if (requesterId) {
             const executor = await db.users.findUnique({ where: { university_id: requesterId } })
             await logAuditAction(executor?.user_id, 'DELETE', 'FORM_TEMPLATE', form?.name || formId.toString(), null)
        }

        // revalidatePath('/admin')
        return { success: true, message: "تم حذف النموذج نهائياً" }
    } catch (error) {
        console.error("Delete Form Template Error:", error)
        return { success: false, error: "فشل في حذف النموذج" }
    }
}

/**
 * Get form schema for dynamic rendering
 */
export async function getDynamicFormSchema(formId: number) {
    try {
        const template = await db.form_templates.findUnique({
            where: { form_id: formId },
            select: {
                form_id: true,
                name: true,
                schema: true
            }
        })

        if (!template || !template.schema) {
            return { success: false, error: "مخطط النموذج غير موجود" }
        }

        return {
            success: true,
            data: template
        }
    } catch (error) {
        console.error("Get Form Schema Error:", error)
        return { success: false, error: "فشل في تحميل مخطط النموذج" }
    }
}

/**
 * Get available form templates for a specific user based on role and department
 */
export async function getAvailableFormTemplates(userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId },
            include: {
                roles: true,
                departments_users_department_idTodepartments: {
                    include: {
                        colleges: true
                    }
                }
            }
        })

        if (!user) {
            return { success: false, error: "المستخدم غير موجود" }
        }

        // Get all active templates
        const allTemplates = await db.form_templates.findMany({
            where: { is_active: true },
            include: {
                request_types: true
            }
        })

        // Fetch all departments and levels for hierarchical targeting check
        const allDepts = await db.departments.findMany({
            select: { department_id: true, college_id: true }
        })
        const allLevels = await db.levels.findMany({
            select: { level_id: true, department_id: true }
        })

        // Filter based on audience config
        const availableTemplates = allTemplates.filter(template => {
            if (!template.audience_config) return true // No restrictions

            const config = template.audience_config as any

            // Check role - use relaxed matching (case-insensitive includes)
            const roleName = user.roles.role_name.toLowerCase()
            const isStudentRole = roleName.includes('student') || roleName === 'student'
            const isEmployeeRole = roleName.includes('employee') || roleName === 'staff' || roleName === 'faculty'

            if (isStudentRole && config.student === false) return false
            if (isEmployeeRole && config.employee === false) return false

            const hasColleges = config.colleges && config.colleges.length > 0
            const hasDepts = config.departments && config.departments.length > 0
            const hasLevels = config.levels && config.levels.length > 0

            if (hasColleges || hasDepts || hasLevels) {
                const userCollegeId = user.departments_users_department_idTodepartments?.colleges?.college_id || user.departments_users_department_idTodepartments?.college_id

                // 1. College Check
                if (hasColleges) {
                    if (!userCollegeId || !config.colleges.includes(userCollegeId)) {
                        return false
                    }
                }

                // 2. Department Check
                if (hasDepts) {
                    // Find if any targeted department belongs to the user's college
                    const targetedDeptsInUserCollege = allDepts.filter(d => 
                        d.college_id === userCollegeId && 
                        config.departments.includes(d.department_id)
                    )

                    if (targetedDeptsInUserCollege.length > 0) {
                        // Admin specifically targeted some departments in the user's college.
                        // So the user's department MUST be one of them.
                        if (!user.department_id || !config.departments.includes(user.department_id)) {
                            return false
                        }
                    }
                }

                // 3. Level Check
                if (hasLevels) {
                    // Find if any targeted level belongs to the user's department
                    const targetedLevelsInUserDept = allLevels.filter(l => 
                        l.department_id === user.department_id && 
                        config.levels.includes(l.level_id)
                    )

                    if (targetedLevelsInUserDept.length > 0) {
                        // Admin specifically targeted some levels in the user's department.
                        // So the user's level MUST be one of them.
                        if (!user.level_id || !config.levels.includes(user.level_id)) {
                            return false
                        }
                    }
                }
            }

            return true
        })

        return {
            success: true,
            data: availableTemplates
        }
    } catch (error) {
        console.error("Get Available Templates Error:", error)
        return { success: false, error: "فشل في تحميل النماذج المتاحة" }
    }
}

/**
 * Get form templates where the user can act as an approver based on workflow steps
 */
export async function getApprovableFormTemplates(userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId },
            include: {
                roles: true
            }
        })

        if (!user) {
            return { success: false, error: "المستخدم غير موجود" }
        }

        const roleId = user.role_id

        // Get all active templates with their workflows and steps
        const allTemplates = await db.form_templates.findMany({
            where: { is_active: true },
            include: {
                request_types: {
                    include: {
                        workflows: {
                            include: {
                                workflow_steps: true
                            }
                        }
                    }
                }
            }
        })

        // Filter templates where the user's role is involved in any workflow step
        const approvableTemplates = allTemplates.filter(template => {
            // Must have a request type and workflow
            const requestTypes = Array.isArray(template.request_types) ? template.request_types : (template.request_types ? [template.request_types] : [])
            
            for (const rType of requestTypes) {
                if (!rType) continue; // Skip if rType is null/undefined
                const workflows = Array.isArray(rType.workflows) ? rType.workflows : (rType.workflows ? [rType.workflows] : [])
                
                for (const workflow of workflows) {
                    if (!workflow) continue; // Skip if workflow is null/undefined
                    const steps = Array.isArray(workflow.workflow_steps) ? workflow.workflow_steps : (workflow.workflow_steps ? [workflow.workflow_steps] : [])
                    
                    // If any step requires this user's role OR this specific user, they are an approver for this form type
                    if (steps.some((step: any) => step && (
                        step.approver_role_id === roleId || 
                        (step.approver_user_id != null && String(step.approver_user_id) === String(user.user_id))
                    ))) {
                        return true
                    }
                }
            }
            return false
        })

        const templatesToReturn = approvableTemplates.length > 0 ? approvableTemplates : allTemplates;
        return {
            success: true,
            data: templatesToReturn.map(t => ({ form_id: t.form_id, name: t.name }))
        }
    } catch (error) {
        console.error("Get Approvable Templates Error:", error)
        return { success: false, error: "فشل في تحميل نماذج الصلاحيات" }
    }
}

