"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { notifyRequestStatusChange, notifyApproverNewRequest, notifyUserApproverNewRequest } from "./notifications"
import { markAbsenceExcusedByRequest } from "./absences"
import { Prisma } from "@prisma/client"
import fs from 'fs'
import path from 'path'
import { translateRole } from "@/lib/translations"

export async function getEmployeeInbox(employeeId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: employeeId },
            include: {
                roles: true
            }
        })

        if (!user) throw new Error("Employee not found")

        // 1. Find Active Delegations where this user is the GRANTEE
        // We look for delegations that are active AND within the date range
        const now = new Date()
        const activeDelegations = await db.delegations.findMany({
            where: {
                grantee_user_id: user.user_id,
                is_active: true,
                starts_at: { lte: now },
                ends_at: { gte: now }
            },
            include: {
                users_delegations_grantor_user_idTousers: {
                    include: { roles: true }
                }
            }
        })

        // Build OR conditions for authorization
        const authOrConditions: any[] = []

        // 1. My own permissions
        authOrConditions.push({
            OR: [
                { workflow_steps: { approver_role_id: user.role_id } },
                { workflow_steps: { approver_user_id: user.user_id } }
            ]
        })

        // 2. Delegated permissions
        for (const d of activeDelegations) {
            const types = d.delegated_types as number[] | null
            const dRole = d.users_delegations_grantor_user_idTousers?.role_id
            
            const pOr: any[] = []
            if (d.grantor_user_id) pOr.push({ workflow_steps: { approver_user_id: d.grantor_user_id } })
            if (dRole) pOr.push({ workflow_steps: { approver_role_id: dRole } })

            if (pOr.length > 0) {
                const condition: any = { OR: pOr }
                if (types && types.length > 0) {
                    condition.form_id = { in: types }
                }
                authOrConditions.push(condition)
            }
        }

        console.log(`Inbox for ${user.full_name} (${user.user_id}). Active Delegations: ${activeDelegations.length}`)

        // Find requests where:
        // 1. Status is pending
        // 2. AND (Matches my roles/id OR matches delegated roles/id with specific types)
        const pendingRequests = await db.requests.findMany({
            where: {
                status: "pending",
                OR: authOrConditions
            },
            select: {
                request_id: true,
                status: true,
                submitted_at: true,
                reference_no: true,
                form_id: true,
                submission_data: true, // Needed to check type
                form_templates: {
                    select: { name: true, schema: true }
                },
                users: {
                    select: { 
                        full_name: true,
                        departments_users_department_idTodepartments: {
                            select: {
                                dept_name: true,
                                colleges: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                },
                workflow_steps: {
                    select: { name: true }
                }
            },
            orderBy: { submitted_at: 'asc' },
            take: 50 // Limit to prevent overload
        })

        return {
            success: true,
            requests: pendingRequests.map((r) => {
                // Determine type/title
                let type = r.form_templates?.name || "General"
                const subData = r.submission_data as any
                if (subData?.type === 'SYSTEM_DELEGATION') {
                    type = "طلب تفويض صلاحيات"
                }

                const dept = (r.users as any)?.departments_users_department_idTodepartments
                return {
                    id: r.request_id.toString(),
                    applicant: (r.users as any).full_name,
                    type: type,
                    date: r.submitted_at?.toISOString().split('T')[0] || "",
                    status: "pending",
                    priority: "normal",
                    description: subData?.reason || "", // Show reason for delegations
                    submissionData: subData || {},
                    formSchema: r.form_templates?.schema,
                    reference_no: r.reference_no,
                    college: dept?.colleges?.name || undefined,
                    department: dept?.dept_name || undefined
                }
            })
        }
    } catch (error) {
        console.error("Employee Inbox Error:", error)
        return { success: false, error: "Failed to fetch inbox" }
    }
}

export async function getEmployeeRequests(employeeId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: employeeId },
        })

        if (!user) throw new Error("Employee not found")

        const requests = await db.requests.findMany({
            where: { requester_id: user.user_id },
            include: {
                form_templates: true,
                users: {
                    include: {
                        departments_users_department_idTodepartments: {
                            include: {
                                colleges: true
                            }
                        }
                    }
                },
                workflow_steps: true
            },
            orderBy: { submitted_at: 'desc' },
            take: 50
        })

        return {
            success: true,
            requests: requests.map((r) => {
                let type = r.form_templates?.name || "General"
                const subData = r.submission_data as any
                if (subData?.type === 'SYSTEM_DELEGATION') {
                    type = "طلب تفويض صلاحيات"
                }

                return {
                    id: r.request_id.toString(),
                    title: type,
                    type: type,
                    date: r.submitted_at?.toISOString().split('T')[0] || "",
                    status: r.status || "pending",
                    priority: "normal",
                    description: "",
                    submissionData: subData || {},
                    formSchema: r.form_templates?.schema || undefined,
                    pdfTemplate: r.form_templates?.pdf_template || null,
                    generateDocument: (r.form_templates as any)?.generate_document !== false,
                    reference_no: r.reference_no,
                    formId: r.form_id?.toString() || "",
                    users: r.users, // Include users for request detailing
                    workflow: [
                        {
                            step: 1,
                            department: r.workflow_steps?.name || "Pending Step",
                            role: "Approver",
                            status: r.status === 'pending' ? 'processing' : (r.status || 'pending')
                        }
                    ],
                }
            }),
        }
    } catch (error) {
        console.error("Employee Requests Error:", error)
        return { success: false, error: "Failed to fetch requests" }
    }
}

export async function getEmployeeHistory(employeeId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: employeeId },
        })

        if (!user) throw new Error("Employee not found")

        const actions = await db.request_actions.findMany({
            where: { actor_id: user.user_id },
            include: {
                requests: {
                    include: {
                        users: true,
                        form_templates: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        // Deduplicate requests
        const uniqueHistory = actions.reduce((acc, current) => {
            const x = acc.find(item => item.request_id === current.request_id);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, [] as typeof actions);

        return {
            success: true,
            history: uniqueHistory.map((a: any) => ({
                id: a.action_id.toString(),
                requestId: a.request_id?.toString(),
                requestType: a.requests?.form_templates?.name || "General",
                applicant: a.requests?.users?.full_name,
                applicantId: a.requests?.users?.university_id,
                applicantPhone: a.requests?.users?.phone,
                action: a.action,
                date: a.created_at?.toISOString().split('T')[0],
                timestamp: a.created_at,
                comment: a.comment,
                status: a.requests?.status
            }))
        }
    } catch (error) {
        console.error("Employee History Error:", error)
        return { success: false, error: "Failed to fetch history" }
    }
}

export async function getRequestPreviousSteps(requestId: number) {
    try {
        const request = await db.requests.findUnique({
            where: { request_id: requestId },
            include: {
                users: {
                    select: { 
                        user_id: true, 
                        full_name: true, 
                        university_id: true,
                        department_id: true,
                        roles: { select: { role_name: true } },
                        departments_users_department_idTodepartments: {
                            include: {
                                colleges: {
                                    include: {
                                        users: { select: { user_id: true, full_name: true } }
                                    }
                                },
                                users_departments_manager_idTousers: {
                                    select: { user_id: true, full_name: true }
                                }
                            }
                        }
                    }
                },
                form_templates: {
                    include: {
                        request_types: {
                            include: {
                                workflows: {
                                    include: {
                                        workflow_steps: {
                                            include: {
                                                roles: { select: { role_id: true, role_name: true } },
                                                users: { select: { user_id: true, full_name: true } }
                                            },
                                            orderBy: { order: 'asc' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                workflow_steps: true,
                request_actions: {
                    include: {
                        users: {
                            select: { user_id: true, full_name: true, roles: { select: { role_name: true } } }
                        }
                    },
                    orderBy: { created_at: 'desc' }
                }
            }
        })

        if (!request) return { success: false, error: "الطلب غير موجود" }

        const currentStep = request.workflow_steps
        const allSteps = request.form_templates?.request_types?.workflows?.workflow_steps || []
        
        // Find previous steps before current step's order
        const currentOrder = currentStep ? currentStep.order : (allSteps.length + 1)

        const roleTranslations: Record<string, string> = {
            'student': 'موظف',
            'employee': 'الموارد البشرية / موظف مختص',
            'admin': 'مدير النظام',
            'dean': 'المدير العام',
            'head_of_department': 'مدير القسم / الإدارة',
            'manager': 'مدير الإدارة',
            'vice_dean': 'نائب المدير العام'
        }

        const dept = request.users?.departments_users_department_idTodepartments
        const deanUser = dept?.colleges?.users
        const hodUser = dept?.users_departments_manager_idTousers

        const previousSteps = allSteps.filter(s => s.order < currentOrder).map(s => {
            // Check if there was an action recorded for this step
            const stepAction = request.request_actions?.find(a => a.step_id === s.step_id)
            
            let assignedPersonName: string | null = null
            if (stepAction?.users?.full_name) {
                assignedPersonName = stepAction.users.full_name
            } else if (s.users?.full_name) {
                assignedPersonName = s.users.full_name
            } else if (s.roles?.role_name === 'dean' && deanUser?.full_name) {
                assignedPersonName = deanUser.full_name
            } else if (s.roles?.role_name === 'head_of_department' && hodUser?.full_name) {
                assignedPersonName = hodUser.full_name
            }

            const roleTitle = s.roles?.role_name ? translateRole(s.roles.role_name) : null

            return {
                step_id: s.step_id,
                name: s.name || `الخطوة ${s.order}`,
                order: s.order,
                role_name: s.roles?.role_name,
                role_title: roleTitle,
                employee_name: assignedPersonName,
                last_action: stepAction ? {
                    action: stepAction.action,
                    actor_name: stepAction.users?.full_name,
                    date: stepAction.created_at
                } : null
            }
        })

        const requesterRoleTitle = request.users?.roles?.role_name 
            ? (roleTranslations[request.users.roles.role_name] || request.users.roles.role_name) 
            : 'موظف'

        return {
            success: true,
            requester: {
                name: request.users?.full_name || "مقدم الطلب",
                university_id: request.users?.university_id,
                role_title: requesterRoleTitle,
                is_student: request.users?.roles?.role_name === 'student'
            },
            currentStep: currentStep ? {
                step_id: currentStep.step_id,
                name: currentStep.name,
                order: currentStep.order
            } : null,
            previousSteps
        }
    } catch (error) {
        console.error("Get Request Previous Steps Error:", error)
        return { success: false, error: "فشل تحميل خطوات المسار" }
    }
}

export async function processRequest(
    requestId: string,
    action: 'approve' | 'reject' | 'approve_with_changes' | 'reject_with_changes',
    comment: string,
    actorId: string,
    attachmentData?: string,
    attachmentName?: string,
    targetStepId?: number | null
) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: actorId },
            include: { roles: true }
        })
        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const request = await db.requests.findUnique({
            where: { request_id: parseInt(requestId) },
            include: {
                form_templates: true,
                users: true,
                workflow_steps: {
                    include: {
                        workflows: {
                            include: {
                                workflow_steps: {
                                    orderBy: { order: 'asc' }
                                }
                            }
                        }
                    }
                }
            }
        })
        if (!request) return { success: false, error: "الطلب غير موجود" }

        // Authorization check
        const currentStep = request.workflow_steps
        if (currentStep) {
            const isAuthorized =
                currentStep.approver_role_id === user.role_id ||
                currentStep.approver_user_id === user.user_id

            // Allow if user is authorized directly
            // OR if user is a valid delegatee for the approver
            let isDelegateeAuthorized = false;

            if (!isAuthorized) {
                // Check active delegations
                const now = new Date()

                // Dynamically build conditions for valid delegation check
                const delegationOrConditions: any[] = []
                
                // If this step is assigned to a specific user, check if we are delegated by that user
                if (currentStep.approver_user_id) {
                    delegationOrConditions.push({ grantor_user_id: currentStep.approver_user_id })
                }

                // If this step is assigned to a role, check if we are delegated by someone with that role
                if (currentStep.approver_role_id) {
                    delegationOrConditions.push({
                         users_delegations_grantor_user_idTousers: {
                                role_id: currentStep.approver_role_id
                         }
                    })
                }

                if (delegationOrConditions.length > 0) {
                     const delegations = await db.delegations.findMany({
                        where: {
                            grantee_user_id: user.user_id,
                            is_active: true,
                            starts_at: { lte: now },
                            ends_at: { gte: now },
                            OR: delegationOrConditions
                        }
                    })

                    for (const d of delegations) {
                        const types = d.delegated_types as number[] | null
                        if (!types || types.length === 0 || (request.form_id && types.includes(request.form_id))) {
                            isDelegateeAuthorized = true;
                            break;
                        }
                    }
                }
            }

            if (!isAuthorized && !isDelegateeAuthorized) {
                return { success: false, error: "غير مصرح لك بمعالجة هذا الطلب" }
            }
        }

        // Transaction
        await db.$transaction(async (tx) => {
            let finalComment = comment
            if (attachmentData && attachmentName) {
                try {
                    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true })
                    }
                    const fileName = `req-${request.request_id}-act-${Date.now()}-${attachmentName}`
                    const filePath = path.join(uploadDir, fileName)
                    const base64Data = attachmentData.split(';base64,').pop() || ""
                    fs.writeFileSync(filePath, base64Data, { encoding: 'base64' })
                    await tx.attachments.create({
                        data: {
                            request_id: request.request_id,
                            uploader_id: user.user_id,
                            storage_location: `/uploads/${fileName}`,
                            file_type: attachmentName.split('.').pop() || 'file',
                            uploaded_at: new Date()
                        }
                    })
                    finalComment += `\n\n[تم إرفاق ملف: ${attachmentName}]`
                } catch (err) {
                    console.error("Failed to save attachment:", err)
                    finalComment += `\n\n[فشل رفع الملف: ${attachmentName}]`
                }
            }

            // Record Request Action
            const recordedAction = action === 'reject_with_changes' && targetStepId ? 'return_to_step' : action
            await tx.request_actions.create({
                data: {
                    request_id: request.request_id,
                    actor_id: user.user_id,
                    action: recordedAction,
                    comment: finalComment,
                    step_id: request.current_step_id
                }
            })

            if (action === 'reject') {
                await tx.requests.update({
                    where: { request_id: request.request_id },
                    data: { status: 'rejected' }
                })
            } else if (action === 'reject_with_changes') {
                if (targetStepId) {
                    // Return back to a specific previous step in the workflow
                    await tx.requests.update({
                        where: { request_id: request.request_id },
                        data: {
                            current_step_id: targetStepId,
                            status: 'pending' // Make it available in that approver's inbox
                        }
                    })
                } else {
                    // Return back to the student/requester for editing
                    await tx.requests.update({
                        where: { request_id: request.request_id },
                        data: { status: 'returned' }
                    })
                }
            } else {
                // Determine Next Step
                let nextStep: any = null

                if (currentStep?.workflows) {
                    const allSteps = currentStep.workflows.workflow_steps
                    const currentStepIndex = allSteps.findIndex(s => s.step_id === currentStep.step_id)
                    nextStep = allSteps[currentStepIndex + 1]
                }

                if (action === 'approve_with_changes') {
                    if (nextStep) {
                        await tx.requests.update({
                            where: { request_id: request.request_id },
                            data: {
                                current_step_id: nextStep.step_id,
                                status: 'pending' // Changed to pending so next approver can see it
                            }
                        })
                        // Notify next approver
                        if (nextStep.approver_user_id) {
                            notifyUserApproverNewRequest(nextStep.approver_user_id, request.request_id, request.form_templates?.name || "طلب", user.full_name).catch(console.error)
                        } else if (nextStep.approver_role_id) {
                            notifyApproverNewRequest(nextStep.approver_role_id, request.request_id, request.form_templates?.name || "طلب", user.full_name).catch(console.error)
                        }
                    } else {
                        // Final Approval with changes
                        await tx.requests.update({
                            where: { request_id: request.request_id },
                            data: { 
                                status: 'approved',
                                current_step_id: null 
                            }
                        })
                    }
                } else if (nextStep) {
                    // Standard Approve - Next Step exists
                    await tx.requests.update({
                        where: { request_id: request.request_id },
                        // Use 'pending' for standard flow too, to match getEmployeeInbox check
                        data: {
                            current_step_id: nextStep.step_id,
                            status: 'pending' 
                        }
                    })
                    // Notify next approver logic
                    if (nextStep.approver_user_id) {
                        notifyUserApproverNewRequest(nextStep.approver_user_id, request.request_id, request.form_templates?.name || "طلب", user.full_name).catch(console.error)
                    } else if (nextStep.approver_role_id) {
                        notifyApproverNewRequest(nextStep.approver_role_id, request.request_id, request.form_templates?.name || "طلب", user.full_name).catch(console.error)
                    }
                } else {
                    // Standard Approve - Final Step
                    await tx.requests.update({
                        where: { request_id: request.request_id },
                        data: {
                            status: 'approved',
                            current_step_id: null
                        }
                    })

                    // --- DELEGATION APPROVAL LOGIC ---
                    const subData = request.submission_data as any
                    if (subData?.type === 'SYSTEM_DELEGATION' && action === 'approve') {
                        // Resolve Delegatee User ID
                        const delegatee = await tx.users.findUnique({
                            where: { university_id: subData.delegatee_university_id }
                        })

                        if (delegatee) {
                            await tx.delegations.create({
                                data: {
                                    request_id: request.request_id,
                                    grantor_user_id: request.requester_id,
                                    grantee_user_id: delegatee.user_id,
                                    starts_at: new Date(subData.start_date),
                                    ends_at: new Date(subData.end_date),
                                    is_active: true,
                                    delegated_types: subData.delegated_types || null
                                }
                            })
                            console.log(`Delegation activated: ${request.requester_id} -> ${delegatee.user_id}`)
                        }
                    }
                }
            }
        })

        // Notify requester (outside transaction)
        let notifyStatus = 'processing';
        if (action === 'reject') notifyStatus = 'rejected';
        else if (action === 'reject_with_changes') {
            if (targetStepId) {
                // If returned to a previous step, notify that step's approver
                const targetStep = await db.workflow_steps.findUnique({
                    where: { step_id: targetStepId },
                    include: { roles: true, users: true }
                })
                if (targetStep) {
                    if (targetStep.approver_user_id) {
                        notifyUserApproverNewRequest(targetStep.approver_user_id, request.request_id, `${request.form_templates?.name || "طلب"} (معاد للمراجعة)`, user.full_name).catch(console.error)
                    } else if (targetStep.approver_role_id) {
                        notifyApproverNewRequest(targetStep.approver_role_id, request.request_id, `${request.form_templates?.name || "طلب"} (معاد للمراجعة)`, user.full_name).catch(console.error)
                    }
                }
                notifyStatus = 'in_progress';
            } else {
                notifyStatus = 'returned';
            }
        } else if (action === 'approve_with_changes') {
            notifyStatus = 'returned';
        } else if (action === 'approve') {
            if (!currentStep?.workflows || !currentStep.workflows.workflow_steps[currentStep.workflows.workflow_steps.findIndex(s => s.step_id === currentStep.step_id) + 1]) {
                notifyStatus = 'approved';
            } else {
                notifyStatus = 'in_progress';
            }
        }

        if (notifyStatus === 'approved') {
            // --- AUTOMATED ABSENCE LINKAGE ---
            const schema = request.form_templates?.schema as any[]
            if (schema && Array.isArray(schema)) {
                const absenceField = schema.find(f => f.type === 'absence_picker')
                if (absenceField) {
                    const absenceData = (request.submission_data as any)?.[absenceField.key]
                    if (absenceData) {
                        const studentUser = await db.users.findUnique({ where: { user_id: request.requester_id } })
                        if (studentUser && studentUser.university_id) {
                            if (Array.isArray(absenceData)) {
                                // Group by subjectId to batch markAbsenceExcusedByRequest calls
                                const bySubject: Record<number, string[]> = {}
                                for (const item of absenceData) {
                                    if (item.subjectId && item.date) {
                                        if (!bySubject[item.subjectId]) bySubject[item.subjectId] = []
                                        bySubject[item.subjectId].push(item.date)
                                    }
                                }
                                for (const [subIdStr, dates] of Object.entries(bySubject)) {
                                    const subId = parseInt(subIdStr)
                                    await markAbsenceExcusedByRequest(
                                        studentUser.university_id,
                                        subId,
                                        dates,
                                        request.request_id
                                    ).catch(err => console.error("Auto Absence Linkage Error for subId:", subId, err))
                                }
                            } else if (absenceData.subjectId && absenceData.date) {
                                // Fallback / Backward Compatibility for single absence object
                                await markAbsenceExcusedByRequest(
                                    studentUser.university_id,
                                    absenceData.subjectId,
                                    [absenceData.date],
                                    request.request_id
                                ).catch(err => console.error("Auto Absence Linkage Error:", err))
                            }
                        }
                    }
                }
            }
        }

        console.log(`[ProcessRequest] Calling notifyRequestStatusChange. RequestID: ${request.request_id}, Status: ${notifyStatus}`)
        notifyRequestStatusChange(request.request_id, notifyStatus, user.full_name).catch(err => console.error("Async Notification Error:", err));

        return { success: true }
    } catch (error) {
        console.error("Process Request Error:", error)
        return { success: false, error: "فشل تنفيذ الإجراء" }
    }
}

// NEW: Submit Delegation Request
export async function submitDelegationRequest(requesterId: string, delegateeId: string, startDate: Date, endDate: Date, reason: string, delegatedTypes: number[] | null = null, attachmentData?: string, attachmentName?: string) {
    try {
        const requester = await db.users.findUnique({
            where: { university_id: requesterId },
            include: {
                roles: true,
                departments_users_department_idTodepartments: {
                    include: { colleges: true }
                }
            }
        })
        if (!requester) return { success: false, error: "المستخدم غير موجود" }

        // Find Admin role
        const adminRole = await db.roles.findUnique({
            where: { role_name: 'admin' }
        })
        if (!adminRole) return { success: false, error: "دور مسؤول النظام (admin) غير موجود" }

        // Check if requester is a Dean of any college or has the dean role
        const college = requester.departments_users_department_idTodepartments?.colleges
        let deanId = college?.dean_id

        let isDean = requester.roles?.role_name?.toLowerCase() === 'dean'
        if (!isDean && college) {
            if (college.dean_id === requester.user_id) {
                isDean = true
            }
        }

        // Check if General Manager exists when requester is NOT GM
        if (!isDean && !deanId) {
            return { success: false, error: "لم يتم العثور على المدير العام للموافقة" }
        }

        const delegatee = await db.users.findUnique({
            where: { university_id: delegateeId }
        })
        
        // 2. Create Transaction
        await db.$transaction(async (tx) => {
            // Create Ad-hoc Workflow for this Delegation Request
            const refNo = `DEL-${Date.now()}` // Unique Reference
            const workflow = await tx.workflows.create({
                data: {
                    name: `مسار تفويض - ${refNo}`,
                    is_active: false
                }
            })

            let initialStepId: number

            if (isDean) {
                // If requester is GM: Step 1 (Admin approval, final)
                const step = await tx.workflow_steps.create({
                    data: {
                        workflow_id: workflow.workflow_id,
                        order: 1,
                        name: "اعتماد مسؤول النظام",
                        approver_role_id: adminRole.role_id,
                        is_final: true,
                        sla_hours: 24
                    }
                })
                initialStepId = step.step_id
            } else {
                // If normal employee: Step 1 (GM approval)
                const step1 = await tx.workflow_steps.create({
                    data: {
                        workflow_id: workflow.workflow_id,
                        order: 1,
                        name: "موافقة المدير العام",
                        approver_user_id: deanId,
                        is_final: false,
                        sla_hours: 24
                    }
                })
                // Step 2 (Admin approval, final)
                await tx.workflow_steps.create({
                    data: {
                        workflow_id: workflow.workflow_id,
                        order: 2,
                        name: "اعتماد مسؤول النظام",
                        approver_role_id: adminRole.role_id,
                        is_final: true,
                        sla_hours: 24
                    }
                })
                initialStepId = step1.step_id
            }

            // Create Request
            const request = await tx.requests.create({
                data: {
                    requester_id: requester.user_id,
                    reference_no: refNo,
                    status: 'pending',
                    current_step_id: initialStepId,
                    submission_data: {
                        type: 'SYSTEM_DELEGATION',
                        delegatee_university_id: delegateeId,
                        delegatee_name: delegatee?.full_name || "غير معروف",
                        start_date: startDate,
                        end_date: endDate,
                        reason: reason,
                        delegated_types: delegatedTypes
                    },
                    submitted_at: new Date()
                }
            })

            // Attachment handling
            if (attachmentData && attachmentName) {
                try {
                    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true })
                    }
                    const fileName = `req-${request.request_id}-act-${Date.now()}-${attachmentName}`
                    const filePath = path.join(uploadDir, fileName)
                    const base64Data = attachmentData.split(';base64,').pop() || ""
                    fs.writeFileSync(filePath, base64Data, { encoding: 'base64' })
                    await tx.attachments.create({
                        data: {
                            request_id: request.request_id,
                            uploader_id: requester.user_id,
                            storage_location: `/uploads/${fileName}`,
                            file_type: attachmentName.split('.').pop() || 'file',
                            uploaded_at: new Date()
                        }
                    })
                } catch (err) {
                    console.error("Failed to save attachment:", err)
                }
            }
        })

        return { success: true }
    } catch (error) {
        console.error("Submit Delegation Error:", error)
        return { success: false, error: "فشل في تقديم طلب التفويض" }
    }
}


/**
 * Get employee statistics
 */
export async function getEmployeeStats(userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId },
            include: { roles: true }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        // Count unique requests by this employee based on their CURRENT status
        const returnedCount = await db.requests.count({
            where: {
                status: 'returned',
                request_actions: {
                    some: { actor_id: user.user_id }
                }
            }
        })

        const approvedCount = await db.requests.count({
            where: {
                status: 'approved',
                request_actions: {
                    some: { actor_id: user.user_id }
                }
            }
        })

        const rejectedCount = await db.requests.count({
            where: {
                status: 'rejected',
                request_actions: {
                    some: { actor_id: user.user_id }
                }
            }
        })

        // Pending in inbox (including Delegations)
        const now = new Date()
        const activeDelegations = await db.delegations.findMany({
            where: {
                grantee_user_id: user.user_id,
                is_active: true,
                starts_at: { lte: now },
                ends_at: { gte: now }
            },
            include: {
                users_delegations_grantor_user_idTousers: {
                    select: { role_id: true }
                }
            }
        })

        // Build OR conditions for authorization matching getEmployeeInbox
        const authOrConditions: any[] = []

        // 1. My own permissions
        authOrConditions.push({
            OR: [
                { workflow_steps: { approver_role_id: user.role_id } },
                { workflow_steps: { approver_user_id: user.user_id } }
            ]
        })

        // 2. Delegated permissions
        for (const d of activeDelegations) {
            const types = d.delegated_types as number[] | null
            const dRole = d.users_delegations_grantor_user_idTousers?.role_id
            
            const pOr: any[] = []
            if (d.grantor_user_id) pOr.push({ workflow_steps: { approver_user_id: d.grantor_user_id } })
            if (dRole) pOr.push({ workflow_steps: { approver_role_id: dRole } })

            if (pOr.length > 0) {
                const condition: any = { OR: pOr }
                if (types && types.length > 0) {
                    condition.form_id = { in: types }
                }
                authOrConditions.push(condition)
            }
        }

        const pendingCount = await db.requests.count({
            where: {
                status: "pending",
                OR: authOrConditions
            }
        })

        return {
            success: true,
            data: {
                returned: returnedCount,
                approved: approvedCount,
                rejected: rejectedCount,
                pending: pendingCount
            }
        }
    } catch (error) {
        console.error("Get Employee Stats Error:", error)
        return { success: false, error: "فشل في تحميل الإحصائيات" }
    }
}

/**
 * Get active delegations for a user
 */
export async function getDelegations(userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const delegations = await db.delegations.findMany({
            where: {
                OR: [
                    { grantor_user_id: user.user_id },
                    { grantee_user_id: user.user_id }
                ],
                is_active: true
            },
            include: {
                users_delegations_grantor_user_idTousers: true,
                users_delegations_grantee_user_idTousers: true
            }
        })

        return {
            success: true,
            data: delegations
        }
    } catch (error) {
        console.error("Get Delegations Error:", error)
        return { success: false, error: "فشل في تحميل التفويضات" }
    }
}

/**
 * Create a delegation
 */
export async function createDelegation(data: {
    grantorId: string
    granteeId: string
    startDate: Date
    endDate: Date
}) {
    try {
        const grantor = await db.users.findUnique({
            where: { university_id: data.grantorId }
        })

        const grantee = await db.users.findUnique({
            where: { university_id: data.granteeId }
        })

        if (!grantor || !grantee) {
            return { success: false, error: "المستخدم غير موجود" }
        }

        const delegation = await db.delegations.create({
            data: {
                grantor_user_id: grantor.user_id,
                grantee_user_id: grantee.user_id,
                starts_at: data.startDate,
                ends_at: data.endDate,
                is_active: true
            }
        })

        // revalidatePath('/')
        return { success: true, data: delegation }
    } catch (error) {
        console.error("Create Delegation Error:", error)
        return { success: false, error: "فشل في إنشاء التفويض" }
    }
}

/**
 * Update a delegation
 */
export async function updateDelegation(
    delegationId: number,
    data: {
        startDate?: Date
        endDate?: Date
        isActive?: boolean
    }
) {
    try {
        // Validate dates if provided
        if (data.startDate && data.endDate && data.endDate <= data.startDate) {
            return { success: false, error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" }
        }

        const updateData: any = {}
        if (data.startDate !== undefined) updateData.starts_at = data.startDate
        if (data.endDate !== undefined) updateData.ends_at = data.endDate
        if (data.isActive !== undefined) updateData.is_active = data.isActive

        const delegation = await db.delegations.update({
            where: { delegation_id: delegationId },
            data: updateData
        })

        // revalidatePath('/')
        return { success: true, data: delegation }
    } catch (error) {
        console.error("Update Delegation Error:", error)
        return { success: false, error: "فشل في تحديث التفويض" }
    }
}

/**
 * Delete (deactivate) a delegation
 */
export async function deleteDelegation(delegationId: number) {
    try {
        await db.delegations.update({
            where: { delegation_id: delegationId },
            data: { is_active: false }
        })

        // revalidatePath('/')
        return { success: true }
    } catch (error) {
        console.error("Delete Delegation Error:", error)
        return { success: false, error: "فشل في حذف التفويض" }
    }
}

/**
 * Toggle delegation active status
 */
export async function toggleDelegation(delegationId: number, isActive: boolean) {
    try {
        const delegation = await db.delegations.update({
            where: { delegation_id: delegationId },
            data: { is_active: isActive }
        })

        // revalidatePath('/')
        return { success: true, data: delegation }
    } catch (error) {
        console.error("Toggle Delegation Error:", error)
        return { success: false, error: "فشل في تحديث حالة التفويض" }
    }
}


// Get history of interactions between an employee and a specific requester
export async function getRequesterInteractionHistory(employeeId: string, applicantName: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: employeeId },
        })

        if (!user) throw new Error("Employee not found")

        // Find actions performed by this employee on requests from this specific applicant
        // We filter requests by the applicant's name (since we might not have ID in the frontend list)
        const interactions = await db.request_actions.findMany({
            where: {
                actor_id: user.user_id,
                requests: {
                    users: {
                        full_name: applicantName
                    }
                }
            },
            include: {
                requests: {
                    include: {
                        form_templates: true,
                        users: { // Include user details for bio
                            include: {
                                departments_users_department_idTodepartments: {
                                    include: {
                                        colleges: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        if (interactions.length === 0) {
            // Fallback: try to find the user basic info even if no interactions
            const applicantUser = await db.users.findFirst({
                where: { full_name: applicantName },
                include: {
                    departments_users_department_idTodepartments: {
                        include: { colleges: true }
                    }
                }
            })
            
            let fallbackBio = null;
            if (applicantUser) {
                 fallbackBio = {
                    name: applicantUser.full_name,
                    university_id: applicantUser.university_id,
                    department: applicantUser.departments_users_department_idTodepartments?.dept_name,
                    college: applicantUser.departments_users_department_idTodepartments?.colleges?.name,
                    phone: applicantUser.phone,
                    email: applicantUser.email,
                }
            }
            return { success: true, interactions: [], requesterBio: fallbackBio }
        }

        // Deduplicate requests - keep only the latest action for each request
        const uniqueInteractions = interactions.reduce((acc, current) => {
            const x = acc.find(item => item.request_id === current.request_id);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, [] as typeof interactions);

        // Get requester bio from the first interaction (they are all the same requester)
        const requester = interactions[0]?.requests?.users;
        const departmentInfo = requester?.departments_users_department_idTodepartments;

        const requesterBio = requester ? {
            name: requester.full_name,
            university_id: requester.university_id,
            department: departmentInfo?.dept_name,
            college: departmentInfo?.colleges?.name,
            phone: requester.phone,
            email: requester.email,
        } : null;

        // Fetch term_ids via raw SQL since it's missing from Prisma client
        let termIdMap: Record<number, number | null> = {}
        if (uniqueInteractions.length > 0) {
            const requestIds = uniqueInteractions.map(a => a.request_id).filter(Boolean)
            if (requestIds.length > 0) {
                const termRows = await db.$queryRawUnsafe<{request_id: number, term_id: number | null}[]>(
                    `SELECT request_id, term_id FROM requests WHERE request_id = ANY($1::int[])`,
                    requestIds
                )
                termRows.forEach(row => { termIdMap[row.request_id] = row.term_id } )
            }
        }

        return {
            success: true,
            requesterBio,
            interactions: uniqueInteractions.map((a: any) => ({
                id: a.action_id.toString(),
                requestId: a.request_id?.toString(),
                requestType: a.requests?.form_templates?.name || "General",
                action: a.action,
                date: a.created_at?.toISOString().split('T')[0],
                comment: a.comment,
                originalStatus: a.requests?.status,
                term_id: a.request_id ? (termIdMap[a.request_id] ?? null) : null
            }))
        }
    } catch (error) {
        console.error("Interaction History Error:", error)
        return { success: false, error: "فشل في جلب سجل التعاملات" }
    }
}

// Get colleagues for delegation (Same Department/College)
export async function getDepartmentColleagues(userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId },
            include: {
                roles: true,
                departments_users_department_idTodepartments: {
                    include: { colleges: true }
                },
                colleges: true
            }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        let whereClause: any = {
            user_id: { not: user.user_id },
            is_active: true,
            // Exclude students from colleagues list
            roles: {
                role_name: {
                    notIn: ['student', 'Student']
                }
            }
        }

        let collegeId = user.departments_users_department_idTodepartments?.college_id

        if (user.roles.role_name === 'dean') {
            const deanCollege = await db.colleges.findFirst({ where: { dean_id: user.user_id } })
            if (deanCollege) collegeId = deanCollege.college_id
        }

        if (collegeId) {
            whereClause.departments_users_department_idTodepartments = {
                college_id: collegeId
            }
        } else if (user.department_id) {
            whereClause.department_id = user.department_id
        } else {
            return { success: true, users: [] }
        }

        const colleagues = await db.users.findMany({
            where: whereClause,
            select: {
                university_id: true,
                full_name: true,
                department_id: true,
                roles: { select: { role_name: true } }
            },
            orderBy: { full_name: 'asc' }
        })

        return {
            success: true,
            users: colleagues.map(u => ({
                id: u.university_id,
                name: `${u.full_name} (${translateRole(u.roles.role_name)})`,
                group: (u.department_id && user.department_id && u.department_id === user.department_id) ? 'القسم' : 'الإدارة العامة والفروع'
            }))
        }
    } catch (error) {
        console.error("Get Colleagues Error:", error)
        return { success: false, error: "فشل في تحميل قائمة الزملاء" }
    }
}

