"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

/**
 * Advanced search for requests with multiple filters
 */
export async function advancedSearchRequests(filters: {
    userId: string
    query?: string
    status?: string[]
    formId?: number
    startDate?: Date
    endDate?: Date
    limit?: number
}) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: filters.userId }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const whereClause: any = {
            requester_id: user.user_id
        }

        // Add search query filter
        if (filters.query) {
            whereClause.OR = [
                { reference_no: { contains: filters.query, mode: 'insensitive' } },
                { form_templates: { name: { contains: filters.query, mode: 'insensitive' } } }
            ]
        }

        // Add status filter
        if (filters.status && filters.status.length > 0) {
            whereClause.status = { in: filters.status }
        }

        // Add form filter
        if (filters.formId) {
            whereClause.form_id = filters.formId
        }

        // Add date range filter
        if (filters.startDate || filters.endDate) {
            whereClause.submitted_at = {}
            if (filters.startDate) whereClause.submitted_at.gte = filters.startDate
            if (filters.endDate) whereClause.submitted_at.lte = filters.endDate
        }

        const requests = await db.requests.findMany({
            where: whereClause,
            include: {
                form_templates: true,
                workflow_steps: true,
                request_actions: {
                    include: {
                        users: true
                    },
                    orderBy: { created_at: 'desc' },
                    take: 1 // Last action only
                }
            },
            orderBy: { submitted_at: 'desc' },
            take: filters.limit || 50
        })

        return {
            success: true,
            data: requests
        }
    } catch (error) {
        console.error("Advanced Search Error:", error)
        return { success: false, error: "فشل في البحث" }
    }
}

/**
 * Filter requests by date range
 */
export async function filterRequestsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const requests = await db.requests.findMany({
            where: {
                requester_id: user.user_id,
                submitted_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                form_templates: true,
                workflow_steps: true
            },
            orderBy: { submitted_at: 'desc' }
        })

        return {
            success: true,
            data: requests
        }
    } catch (error) {
        console.error("Filter By Date Range Error:", error)
        return { success: false, error: "فشل في التصفية" }
    }
}

/**
 * Filter requests by status
 */
export async function filterRequestsByStatus(
    userId: string,
    statuses: string[]
) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const requests = await db.requests.findMany({
            where: {
                requester_id: user.user_id,
                status: { in: statuses }
            },
            include: {
                form_templates: true,
                workflow_steps: true
            },
            orderBy: { submitted_at: 'desc' }
        })

        return {
            success: true,
            data: requests
        }
    } catch (error) {
        console.error("Filter By Status Error:", error)
        return { success: false, error: "فشل في التصفية" }
    }
}

/**
 * Get request statistics for a user
 */
export async function getRequestStatistics(userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId }
        })

        if (!user) return { success: false, error: "المستخدم غير موجود" }

        const total = await db.requests.count({
            where: { requester_id: user.user_id }
        })

        const byStatus = await db.requests.groupBy({
            by: ['status'],
            where: { requester_id: user.user_id },
            _count: true
        })

        const byForm = await db.requests.groupBy({
            by: ['form_id'],
            where: { requester_id: user.user_id },
            _count: true
        })

        // Get form names
        const formIds = byForm.map(f => f.form_id).filter(Boolean) as number[]
        const forms = await db.form_templates.findMany({
            where: { form_id: { in: formIds } },
            select: { form_id: true, name: true }
        })

        const byFormWithNames = byForm.map(f => ({
            formId: f.form_id,
            formName: forms.find(form => form.form_id === f.form_id)?.name || "غير محدد",
            count: f._count
        }))

        return {
            success: true,
            data: {
                total,
                byStatus,
                byForm: byFormWithNames
            }
        }
    } catch (error) {
        console.error("Get Statistics Error:", error)
        return { success: false, error: "فشل في تحميل الإحصائيات" }
    }
}

