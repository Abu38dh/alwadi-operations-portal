"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { notifyApproverNewRequest, notifyUserApproverNewRequest } from "./notifications"

export async function getStudentDashboardData(studentId: string, page: number = 1, limit: number = 20) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: studentId },
        })

        if (!user) throw new Error("Student not found")

        const skip = (page - 1) * limit

        const [requests, totalRequests, pendingRequests, completedRequests] = await Promise.all([
            db.requests.findMany({
                where: { requester_id: user.user_id },
                select: {
                    request_id: true,
                    reference_no: true,
                    status: true,
                    submitted_at: true,
                    current_step_id: true,
                    form_id: true,
                    submission_data: true,
                    form_templates: {
                        select: {
                            name: true,
                            form_id: true,
                            // @ts-ignore
                            pdf_template: true,
                            // @ts-ignore
                            schema: true,
                            // @ts-ignore
                            generate_document: true,
                            request_types: {
                                select: {
                                    workflows: {
                                        select: {
                                            workflow_steps: {
                                                select: { 
                                                    step_id: true, 
                                                    name: true, 
                                                    order: true,
                                                    roles: { select: { role_name: true } },
                                                    users: { select: { full_name: true } }
                                                },
                                                orderBy: { order: 'asc' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    workflow_steps: {
                        select: {
                            step_id: true,
                            name: true,
                            order: true,
                            approver_role_id: true,
                            approver_user_id: true,
                            roles: { select: { role_name: true } },
                            users: { select: { full_name: true } }
                        }
                    },
                    attachments: {
                        select: {
                            file_id: true,
                            storage_location: true,
                            file_type: true,
                            uploaded_at: true,
                            uploader_id: true,
                            users: {
                                select: {
                                    full_name: true,
                                    university_id: true,
                                    roles: { select: { role_name: true } }
                                }
                            }
                        },
                        orderBy: { uploaded_at: 'desc' }
                    },
                    users: {
                        select: {
                            full_name: true,
                            university_id: true,
                            departments_users_department_idTodepartments: {
                                select: {
                                    dept_name: true,
                                    colleges: {
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { submitted_at: 'desc' },
                skip: skip,
                take: limit
            }),
            db.requests.count({ where: { requester_id: user.user_id } }),
            db.requests.count({
                where: {
                    requester_id: user.user_id,
                    status: { notIn: ['approved', 'rejected'] }
                }
            }),
            db.requests.count({
                where: {
                    requester_id: user.user_id,
                    status: { in: ['approved', 'rejected'] }
                }
            })
        ])

        // Fetch term_ids for these requests via raw SQL (since term_id not in Prisma typed model)
        let termIdMap: Record<number, number | null> = {}
        if (requests.length > 0) {
            const requestIds = requests.map((r: any) => r.request_id)
            const termRows = await db.$queryRawUnsafe<{request_id: number, term_id: number | null}[]>(
                `SELECT request_id, term_id FROM requests WHERE request_id = ANY($1::int[])`,
                requestIds
            )
            termRows.forEach(row => { termIdMap[row.request_id] = row.term_id } )
        }

        return {
            success: true,
            data: {
                requests: requests.map((r: any) => ({ ...r, term_id: termIdMap[r.request_id] ?? null, attachments: r.attachments || [] })),
                stats: {
                    total: totalRequests,
                    pending: pendingRequests,
                    completed: completedRequests
                },
                pagination: {
                    page,
                    limit,
                    total: totalRequests,
                    totalPages: Math.ceil(totalRequests / limit)
                }
            }
        }
    } catch (error) {
        console.error("Student Dashboard Data Error:", error)
        return { success: false, error: "Failed to fetch dashboard data" }
    }
}

export async function submitRequest(data: any) {
    try {
        // Get user ID from the data parameter (passed from form)
        // Get user ID from the data parameter (passed from form)
        const { userId } = data
        if (!userId) throw new Error("User ID is required")

        const user = await db.users.findUnique({ where: { university_id: userId } })
        if (!user) throw new Error("User not found")

        // Find template by ID
        const formId = parseInt(data.formId)
        if (isNaN(formId)) throw new Error("Invalid Form ID")

        const template = await db.form_templates.findUnique({ where: { form_id: formId } })

        if (!template) throw new Error("Form template not found")

        // Find first workflow step
        // Assuming template relates to request_type, which relates to workflow
        let firstStepId = null;
        let approverRoleId = null;
        if (template.request_type_id) {
            const requestType = await db.request_types.findUnique({
                where: { type_id: template.request_type_id },
                include: { workflows: { include: { workflow_steps: { orderBy: { order: 'asc' }, take: 1 } } } }
            })
            if (requestType?.workflows?.workflow_steps?.[0]) {
                firstStepId = requestType.workflows.workflow_steps[0].step_id
                approverRoleId = requestType.workflows.workflow_steps[0].approver_role_id
            }
        }

        const newRequest = await db.requests.create({
            data: {
                reference_no: `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                requester_id: user.user_id,
                form_id: template.form_id,
                status: "pending",
                current_step_id: firstStepId,
                submission_data: (() => {
                    const { userId, formId, ...rest } = data
                    return rest
                })()
            }
        })

        // Auto-link to current active term via raw SQL
        try {
            const now = new Date().toISOString()
            const termRows = await db.$queryRawUnsafe<{term_id: number}[]>(
                `SELECT term_id FROM terms WHERE start_date <= $1::timestamp AND end_date >= $1::timestamp ORDER BY start_date DESC LIMIT 1`,
                now
            )
            if (termRows[0]?.term_id) {
                await db.$executeRawUnsafe(
                    `UPDATE requests SET term_id = $1 WHERE request_id = $2`,
                    termRows[0].term_id,
                    newRequest.request_id
                )
            }
        } catch (termErr) {
            console.warn("Could not link request to term:", termErr)
        }

        // Notify approver if workflow exists
        if (approverRoleId) {
            await notifyApproverNewRequest(
                approverRoleId,
                newRequest.request_id,
                template.name,
                user.full_name
            )
        }

        // revalidatePath('/')
        return { success: true, data: newRequest }
    } catch (error) {
        console.error("Submit Request Error:", error)
        return { success: false, error: "فشل تقديم الطلب" }
    }
}

/**
 * Get full request details with workflow history
 */
export async function getRequestDetail(requestId: number, userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const request = await db.requests.findUnique({
            where: { request_id: requestId },
            include: {
                users: {
                    include: {
                        departments_users_department_idTodepartments: {
                            include: {
                                colleges: true
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
                                            include: { roles: true },
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
                        users: true,
                        workflow_steps: true
                    },
                    orderBy: { created_at: 'desc' }
                },
                attachments: true
            }
        })

        if (!request) {
            return { success: false, error: "الطلب غير موجود" }
        }

        // Check authorization - user must be requester or have appropriate role
        // Check authorization - user must be requester, have acted on it, or have appropriate role
        if (request.requester_id !== user.user_id) {
            // Check if user has acted on this request (is in history)
            const hasActed = request.request_actions.some(action => action.actor_id === user.user_id)

            if (!hasActed) {
                // Check if user is admin or employee who can view this (fallback)
                const userRole = await db.users.findUnique({
                    where: { user_id: user.user_id },
                    include: { roles: true }
                })

                const allowedRoles = ['admin', 'employee', 'manager', 'head_of_department'] // Expanded roles just in case
                if (!userRole || !allowedRoles.includes(userRole.roles.role_name)) {
                    // One last check: is the user a current approver?
                    const currentStep = request.workflow_steps
                    const isCurrentApprover = currentStep && (
                        currentStep.approver_user_id === user.user_id ||
                        (currentStep.approver_role_id && userRole?.role_id === currentStep.approver_role_id)
                    )

                    if (!isCurrentApprover) {
                        return { success: false, error: "غير مصرح لك بعرض هذا الطلب" }
                    }
                }
            }
        }

        return {
            success: true,
            data: request
        }
    } catch (error) {
        console.error("Get Request Detail Error:", error)
        return { success: false, error: "فشل في تحميل تفاصيل الطلب" }
    }
}

/**
 * Search user's requests
 */
export async function searchRequests(userId: string, query: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const requests = await db.requests.findMany({
            where: {
                requester_id: user.user_id,
                OR: [
                    { reference_no: { contains: query, mode: 'insensitive' } },
                    { form_templates: { name: { contains: query, mode: 'insensitive' } } }
                ]
            },
            include: {
                form_templates: true,
                workflow_steps: true
            },
            orderBy: { submitted_at: 'desc' },
            take: 50
        })

        return {
            success: true,
            data: requests
        }
    } catch (error) {
        console.error("Search Requests Error:", error)
        return { success: false, error: "فشل في البحث" }
    }
}

export async function getRequestActions(requestId: string) {
    try {
        const id = parseInt(requestId)
        if (isNaN(id)) return []

        const actions = await db.request_actions.findMany({
            where: { request_id: id },
            include: {
                users: {
                    include: { roles: true }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        return actions.map(action => ({
            id: action.action_id.toString(),
            action: action.action || "",
            timestamp: action.created_at?.toISOString() || new Date().toISOString(),
            actorName: action.users?.full_name || "Unknown",
            actorRole: action.users?.roles?.role_name || "Unknown",
            comment: action.comment || undefined
        }))
    } catch (error) {
        console.error("Get Request Actions Error:", error)
        return []
    }
}
/**
 * Update and resubmit a returned request
 */
export async function updateRequest(requestId: number, data: any, userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const request = await db.requests.findUnique({
            where: { request_id: requestId },
            include: {
                workflow_steps: true
            }
        })

        if (!request) return { success: false, error: "الطلب غير موجود" }

        if (request.requester_id !== user.user_id) {
            return { success: false, error: "غير مصرح لك بتعديل هذا الطلب" }
        }

        if (request.status !== 'returned' && request.status !== 'rejected_with_changes') {
            return { success: false, error: "يمكن تعديل الطلبات المعادة فقط" }
        }

        // Update request
        await db.requests.update({
            where: { request_id: requestId },
            data: {
                submission_data: data, // Replace submission data
                status: 'pending', // Reset status to pending so it appears in inbox
                // We do NOT change current_step_id, so it goes back to the correct approver (who returned it or the next one if it was moved)
            }
        })

        // Notify the approver who needs to review it again
        // We need to find who is responsible for current_step_id
        if (request.current_step_id) {
            const step = await db.workflow_steps.findUnique({
                where: { step_id: request.current_step_id }
            })

            if (step) {
                if (step.approver_user_id) {
                    await notifyUserApproverNewRequest(
                        step.approver_user_id,
                        request.request_id,
                        "تعديل على طلب",
                        user.full_name
                    )
                } else if (step.approver_role_id) {
                    await notifyApproverNewRequest(
                        step.approver_role_id,
                        request.request_id,
                        "تعديل على طلب",
                        user.full_name
                    )
                }
            }
        }

        // revalidatePath('/')
        return { success: true }
    } catch (error) {
        console.error("Update Request Error:", error)
        return { success: false, error: "فشل تحديث الطلب" }
    }
}

