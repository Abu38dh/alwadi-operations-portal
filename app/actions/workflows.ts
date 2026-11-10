"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

/**
 * Get all workflows with their steps
 */
export async function getAllWorkflows() {
    try {
        const workflows = await db.workflows.findMany({
            include: {
                workflow_steps: {
                    include: {
                        roles: true
                    },
                    orderBy: { order: 'asc' }
                },
                request_types: true
            },
            orderBy: { workflow_id: 'asc' }
        })

        return {
            success: true,
            data: workflows
        }
    } catch (error) {
        console.error("Get Workflows Error:", error)
        return { success: false, error: "فشل في تحميل مسارات العمل" }
    }
}

/**
 * Get single workflow with details
 */
export async function getWorkflow(workflowId: number) {
    try {
        const workflow = await db.workflows.findUnique({
            where: { workflow_id: workflowId },
            include: {
                workflow_steps: {
                    include: {
                        roles: true,
                        users: true
                    },
                    orderBy: { order: 'asc' }
                },
                request_types: true
            }
        })

        if (!workflow) {
            return { success: false, error: "مسار العمل غير موجود" }
        }

        return {
            success: true,
            data: workflow
        }
    } catch (error) {
        console.error("Get Workflow Error:", error)
        return { success: false, error: "فشل في تحميل مسار العمل" }
    }
}

import { logAuditAction } from "./audit"

// ─── Shared Scope Validation Helper ───────────────────────────────────────────
/**
 * Validates that a candidate user (approver OR escalation target) belongs to
 * the same college/department as the requester when the requester is a
 * scoped role (dean / manager / head).
 *
 * Throws a localised error if the constraint is violated.
 */
async function validateUserInScope(
    candidateUserId: number,
    requester: {
        roles: { role_name: string }
        department_id: number | null
        departments_users_department_idTodepartments: { colleges: { college_id: number } | null } | null
    },
    label: string   // used in the Arabic error message, e.g. "موافق" or "مستهدف التصعيد"
) {
    const roleName = requester.roles.role_name.toLowerCase()
    if (roleName !== 'dean' && roleName !== 'manager' && roleName !== 'head') return

    const candidate = await db.users.findUnique({
        where: { user_id: candidateUserId },
        include: { departments_users_department_idTodepartments: { include: { colleges: true } } }
    })
    if (!candidate) return

    if (roleName === 'dean') {
        const reqCollege = requester.departments_users_department_idTodepartments?.colleges?.college_id
        const candCollege = candidate.departments_users_department_idTodepartments?.colleges?.college_id
        if (reqCollege && reqCollege !== candCollege) {
            throw new Error(`لا يمكنك إضافة ${label} من خارج فرعك / إدارتك لهذا المسار (${candidate.full_name})`)
        }
    } else if (requester.department_id !== candidate.department_id) {
        // manager / head → department scope
        throw new Error(`لا يمكنك إضافة ${label} من خارج قسمك لهذا المسار (${candidate.full_name})`)
    }
}
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create new workflow with steps
 */
export async function createWorkflow(data: {
    name: string
    steps: Array<{
        name: string
        order: number
        approver_role_id?: number
        approver_user_id?: number | null
        sla_hours?: number
        is_final?: boolean
        escalation_role_id?: number | null
        escalation_user_id?: number | null
        escalate_to_next?: boolean
    }>
    requesterId?: string
}) {
    try {
        // Enforce Scoping (Keep existing logic)
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

                // Validate both approver and escalation user for every step
                for (const step of data.steps) {
                    if (step.approver_user_id) {
                        await validateUserInScope(step.approver_user_id, requester, 'موافق')
                    }
                    if (step.escalation_user_id) {
                        await validateUserInScope(step.escalation_user_id, requester, 'مستهدف التصعيد')
                    }
                }
            }
        }

        const workflow = await db.workflows.create({
            data: {
                name: data.name,
                is_active: true,
                workflow_steps: {
                    create: data.steps.map(step => ({
                        name: step.name,
                        order: step.order,
                        approver_role_id: step.approver_role_id || null,
                        approver_user_id: step.approver_user_id || null,
                        sla_hours: step.sla_hours || null,
                        is_final: step.is_final || false,
                        escalation_role_id: step.escalation_role_id || null,
                        escalation_user_id: step.escalation_user_id || null,
                        escalate_to_next: step.escalate_to_next || false,
                    }))
                }
            },
            include: {
                workflow_steps: true
            }
        })

        if (data.requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: data.requesterId } })
            await logAuditAction(executor?.user_id, 'CREATE', 'WORKFLOW', workflow.name, { new_id: workflow.workflow_id })
        }

        // revalidatePath('/admin')
        return { success: true, data: workflow }
    } catch (error: any) {
        console.error("Create Workflow Error:", error)
        return { success: false, error: error.message || "فشل في إنشاء مسار العمل" }
    }
}

/**
 * Update workflow
 */
export async function updateWorkflow(
    workflowId: number,
    data: {
        name?: string
        is_active?: boolean
        steps?: Array<{
            step_id?: number
            name: string
            order: number
            approver_role_id?: number
            approver_user_id?: number | null
            sla_hours?: number
            is_final?: boolean
            escalation_role_id?: number | null
            escalation_user_id?: number | null
            escalate_to_next?: boolean
        }>
        requesterId?: string
    }
) {
    try {
        // Enforce Scoping (Keep existing logic)
        if (data.requesterId && data.steps) {
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

                // Validate both approver and escalation user for every step
                for (const step of data.steps) {
                    if (step.approver_user_id) {
                        await validateUserInScope(step.approver_user_id, requester, 'موافق')
                    }
                    if (step.escalation_user_id) {
                        await validateUserInScope(step.escalation_user_id, requester, 'مستهدف التصعيد')
                    }
                }
            }
        }

        // Update workflow basic info
        const updateData: any = {}
        if (data.name !== undefined) updateData.name = data.name
        if (data.is_active !== undefined) updateData.is_active = data.is_active

        const currentWorkflow = await db.workflows.findUnique({ where: { workflow_id: workflowId } })

        await db.workflows.update({
            where: { workflow_id: workflowId },
            data: updateData
        })

        // Update steps if provided
        if (data.steps) {
            const existingSteps = await db.workflow_steps.findMany({
                where: { workflow_id: workflowId },
                orderBy: { order: 'asc' }
            })

            // Map incoming steps to existing steps
            const matchedStepIds = new Set<number>()
            const stepsToUpdate: Array<{ step_id: number, data: any }> = []
            const stepsToCreate: Array<any> = []

            for (let i = 0; i < data.steps.length; i++) {
                const incomingStep = data.steps[i]
                
                // Try matching by step_id first
                let matchedStep = incomingStep.step_id 
                    ? existingSteps.find(es => es.step_id === incomingStep.step_id)
                    : null

                // Fallback: match by index if step_id is missing and we have an existing step at this index
                if (!matchedStep && !incomingStep.step_id && i < existingSteps.length) {
                    matchedStep = existingSteps[i]
                }

                if (matchedStep) {
                    matchedStepIds.add(matchedStep.step_id)
                    stepsToUpdate.push({
                        step_id: matchedStep.step_id,
                        data: incomingStep
                    })
                } else {
                    stepsToCreate.push(incomingStep)
                }
            }

            // 1. Update matched steps in-place
            for (const item of stepsToUpdate) {
                await db.workflow_steps.update({
                    where: { step_id: item.step_id },
                    data: {
                        name: item.data.name,
                        order: item.data.order,
                        approver_role_id: item.data.approver_role_id || null,
                        approver_user_id: item.data.approver_user_id || null,
                        sla_hours: item.data.sla_hours || null,
                        is_final: item.data.is_final || false,
                        escalation_role_id: item.data.escalation_role_id || null,
                        escalation_user_id: item.data.escalation_user_id || null,
                        escalate_to_next: item.data.escalate_to_next || false,
                    }
                })
            }

            // 2. Create new steps
            if (stepsToCreate.length > 0) {
                await db.workflow_steps.createMany({
                    data: stepsToCreate.map(step => ({
                        workflow_id: workflowId,
                        name: step.name,
                        order: step.order,
                        approver_role_id: step.approver_role_id || null,
                        approver_user_id: step.approver_user_id || null,
                        sla_hours: step.sla_hours || null,
                        is_final: step.is_final || false,
                        escalation_role_id: step.escalation_role_id || null,
                        escalation_user_id: step.escalation_user_id || null,
                        escalate_to_next: step.escalate_to_next || false,
                    }))
                })
            }

            // 3. Delete unmatched steps
            const stepsToDelete = existingSteps.filter(es => !matchedStepIds.has(es.step_id))

            if (stepsToDelete.length > 0) {
                const stepIdsToDelete = stepsToDelete.map(s => s.step_id)

                // Check if any of these deleted steps are referenced
                const referencingRequests = await db.requests.count({
                    where: { current_step_id: { in: stepIdsToDelete } }
                })
                const referencingActions = await db.request_actions.count({
                    where: { step_id: { in: stepIdsToDelete } }
                })

                if (referencingRequests > 0 || referencingActions > 0) {
                    throw new Error("لا يمكن حذف بعض خطوات مسار العمل لأنها تحتوي على طلبات سابقة أو معلقة بانتظارها.")
                }

                await db.workflow_steps.deleteMany({
                    where: { step_id: { in: stepIdsToDelete } }
                })
            }
        }

        if (data.requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: data.requesterId } })
            await logAuditAction(executor?.user_id, 'UPDATE', 'WORKFLOW', currentWorkflow?.name || workflowId.toString(), {
                 updated_fields: Object.keys(updateData),
                 steps_updated: !!data.steps
            })
        }

        // revalidatePath('/admin')
        return { success: true }
    } catch (error: any) {
        console.error("Update Workflow Error:", error)
        return { success: false, error: error.message || "فشل في تحديث مسار العمل" }
    }
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(workflowId: number, requesterId?: string) {
    try {
        // Check if workflow is in use by checking if there are associated active form templates
        const requestTypes = await db.request_types.findMany({
            where: { workflow_id: workflowId },
            include: {
                form_templates: true
            }
        })

        // Filter request types that are actually linked to form templates
        const activeRequestTypes = requestTypes.filter(rt => rt.form_templates !== null)

        if (activeRequestTypes.length > 0) {
            return {
                success: false,
                error: "لا يمكن حذف مسار العمل لأنه مرتبط بأنواع طلبات نشطة"
            }
        }

        // If there are orphaned request types (no form template), delete them
        const orphanedTypeIds = requestTypes
            .filter(rt => rt.form_templates === null)
            .map(rt => rt.type_id)

        if (orphanedTypeIds.length > 0) {
            await db.request_types.deleteMany({
                where: { type_id: { in: orphanedTypeIds } }
            })
        }

        const workflow = await db.workflows.findUnique({ where: { workflow_id: workflowId } })

        // Get all step IDs for this workflow
        const steps = await db.workflow_steps.findMany({
            where: { workflow_id: workflowId }
        })
        const stepIds = steps.map(s => s.step_id)

        // Check if referenced
        const referencingRequests = await db.requests.count({
            where: { current_step_id: { in: stepIds } }
        })
        const referencingActions = await db.request_actions.count({
            where: { step_id: { in: stepIds } }
        })

        if (referencingRequests > 0 || referencingActions > 0) {
            return {
                success: false,
                error: "لا يمكن حذف مسار العمل لأنه يحتوي على خطوات مرتبطة بطلبات سابقة أو معلقة."
            }
        }

        // Delete steps first
        await db.workflow_steps.deleteMany({
            where: { workflow_id: workflowId }
        })

        // Delete workflow
        await db.workflows.delete({
            where: { workflow_id: workflowId }
        })

        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'DELETE', 'WORKFLOW', workflow?.name || workflowId.toString(), null)
        }

        // revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Delete Workflow Error:", error)
        return { success: false, error: "فشل في حذف مسار العمل" }
    }
}

/**
 * Assign workflow to request type (form type)
 */
export async function assignWorkflowToFormType(
    workflowId: number,
    requestTypeId: number
) {
    try {
        await db.request_types.update({
            where: { type_id: requestTypeId },
            data: { workflow_id: workflowId }
        })

        // revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Assign Workflow Error:", error)
        return { success: false, error: "فشل في ربط مسار العمل" }
    }
}

/**
 * Get all request types for workflow assignment
 */
export async function getAllRequestTypes() {
    try {
        const requestTypes = await db.request_types.findMany({
            include: {
                workflows: true,
                form_templates: true
            }
        })

        return {
            success: true,
            data: requestTypes
        }
    } catch (error) {
        console.error("Get Request Types Error:", error)
        return { success: false, error: "فشل في تحميل أنواع الطلبات" }
    }
}

/**
 * Get all roles (from admin.ts, re-exported for convenience)
 */
export async function getAllRoles() {
    try {
        const roles = await db.roles.findMany({
            orderBy: { role_name: 'asc' }
        })

        return {
            success: true,
            data: roles
        }
    } catch (error) {
        console.error("Get Roles Error:", error)
        return { success: false, error: "فشل في تحميل الأدوار" }
    }
}

