"use server"

import { db } from "@/lib/db"
import { headers } from 'next/headers'

export async function logAuditAction(
    userId: number | undefined | null,
    action: string,
    entityType: string,
    entityId: string | null | undefined,
    details: any = null
) {
    try {
        const headersList = await headers()
        const ip = headersList.get('x-forwarded-for') || 'unknown'

        // Check if audit_logs table exists roughly by trying to insert
        // If the table doesn't exist yet (migration pending), this might fail
        // But we want to be safe not to crash the app
        await db.audit_logs.create({
            data: {
                user_id: userId || null,
                action: action,
                entity_type: entityType,
                entity_id: entityId,
                details: details ? JSON.parse(JSON.stringify(details)) : null,
                ip_address: ip
            }
        })
    } catch (error) {
        // Silently fail for audit logs to not block main actions
        console.error("Audit Log Error (Non-blocking):", error)
    }
}

