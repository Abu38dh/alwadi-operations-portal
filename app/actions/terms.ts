"use server"

import { db } from "@/lib/db"

export interface Term {
    term_id: number
    name: string
    start_date: string
    end_date: string
    created_at?: string
}

/**
 * Get the currently active academic term (based on today's date).
 */
export async function getCurrentTerm(): Promise<{ success: boolean; data?: Term | null; error?: string }> {
    try {
        const now = new Date()
        const rows = await db.$queryRawUnsafe<Term[]>(
            `SELECT term_id, name, start_date, end_date, created_at 
             FROM terms 
             WHERE start_date <= $1 AND end_date >= $1 
             ORDER BY start_date DESC 
             LIMIT 1`,
            now
        )
        return { success: true, data: rows[0] ?? null }
    } catch (error) {
        console.error("getCurrentTerm Error:", error)
        return { success: false, error: "فشل في تحديد الترم الحالي" }
    }
}

/**
 * Get all academic terms ordered by start date descending.
 */
export async function getAllTerms(): Promise<{ success: boolean; data?: Term[]; error?: string }> {
    try {
        const rows = await db.$queryRawUnsafe<Term[]>(
            `SELECT term_id, name, start_date, end_date, created_at 
             FROM terms 
             ORDER BY start_date DESC`
        )
        return { success: true, data: rows }
    } catch (error) {
        console.error("getAllTerms Error:", error)
        return { success: false, error: "فشل في تحميل الأترام" }
    }
}

/**
 * Create a new academic term.
 */
export async function createTerm(data: {
    name: string
    start_date: string
    end_date: string
}): Promise<{ success: boolean; data?: Term; error?: string }> {
    try {
        const rows = await db.$queryRawUnsafe<Term[]>(
            `INSERT INTO terms (name, start_date, end_date, created_at) 
             VALUES ($1, CAST($2 AS TIMESTAMP), CAST($3 AS TIMESTAMP), NOW()) 
             RETURNING term_id, name, start_date, end_date, created_at`,
            data.name,
            new Date(data.start_date),
            new Date(data.end_date)
        )
        return { success: true, data: rows[0] }
    } catch (error) {
        console.error("createTerm Error:", error)
        return { success: false, error: "فشل في إنشاء الترم" }
    }
}

/**
 * Update an existing academic term.
 */
export async function updateTerm(termId: number, data: {
    name?: string
    start_date?: string
    end_date?: string
}): Promise<{ success: boolean; data?: Term; error?: string }> {
    try {
        const setClauses: string[] = []
        const params: any[] = []
        let idx = 1

        if (data.name) { setClauses.push(`name = $${idx++}`); params.push(data.name) }
        if (data.start_date) { setClauses.push(`start_date = CAST($${idx++} AS TIMESTAMP)`); params.push(new Date(data.start_date)) }
        if (data.end_date) { setClauses.push(`end_date = CAST($${idx++} AS TIMESTAMP)`); params.push(new Date(data.end_date)) }

        if (setClauses.length === 0) return { success: false, error: "لا توجد بيانات للتحديث" }

        params.push(termId)
        const rows = await db.$queryRawUnsafe<Term[]>(
            `UPDATE terms SET ${setClauses.join(", ")} WHERE term_id = $${idx} RETURNING term_id, name, start_date, end_date, created_at`,
            ...params
        )
        return { success: true, data: rows[0] }
    } catch (error) {
        console.error("updateTerm Error:", error)
        return { success: false, error: "فشل في تحديث الترم" }
    }
}

/**
 * Delete an academic term (only if no requests are linked to it).
 */
export async function deleteTerm(termId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const rows = await db.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*) as count FROM requests WHERE term_id = $1`,
            termId
        )
        const count = parseInt(rows[0]?.count ?? "0")
        if (count > 0) {
            return { success: false, error: `لا يمكن حذف الترم لأنه مرتبط بـ ${count} طلب` }
        }
        await db.$executeRawUnsafe(`DELETE FROM terms WHERE term_id = $1`, termId)
        return { success: true }
    } catch (error) {
        console.error("deleteTerm Error:", error)
        return { success: false, error: "فشل في حذف الترم" }
    }
}

