"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

/**
 * Upload attachment to a request
 */
export async function uploadAttachment(data: {
    requestId: number
    file: {
        name: string
        type: string
        size: number
        url: string
    }
    uploaderId: string
}) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: data.uploaderId }
        })

        if (!user) {
            return { success: false, error: "المستخدم غير موجود" }
        }

        // Validate file size (max 10MB)
        const maxSizeBytes = 10 * 1024 * 1024
        if (data.file.size > maxSizeBytes) {
            return { success: false, error: "حجم الملف يجب أن يكون أقل من 10 ميجابايت" }
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]

        if (!allowedTypes.includes(data.file.type)) {
            return { success: false, error: "نوع الملف غير مسموح به. الأنواع المسموحة: PDF, JPG, PNG, DOC, DOCX" }
        }

        // Check if request exists and user has access
        const request = await db.requests.findUnique({
            where: { request_id: data.requestId }
        })

        if (!request) {
            return { success: false, error: "الطلب غير موجود" }
        }

        // Create attachment record
        const attachment = await db.attachments.create({
            data: {
                request_id: data.requestId,
                uploader_id: user.user_id,
                storage_location: data.file.url,
                file_type: data.file.type
            }
        })

        // revalidatePath('/')
        return { success: true, data: attachment }
    } catch (error) {
        console.error("Upload Attachment Error:", error)
        return { success: false, error: "فشل في رفع المرفق" }
    }
}

/**
 * Delete attachment
 */
export async function deleteAttachment(attachmentId: number, userId: string) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId },
            include: { roles: true }
        })

        if (!user) {
            return { success: false, error: "المستخدم غير موجود" }
        }

        const attachment = await db.attachments.findUnique({
            where: { file_id: attachmentId },
            include: {
                requests: true
            }
        })

        if (!attachment) {
            return { success: false, error: "المرفق غير موجود" }
        }

        // Authorization: Only uploader, request owner, or admin can delete
        const isAdmin = user.roles.role_name === 'admin'
        const isUploader = attachment.uploader_id === user.user_id
        const isRequestOwner = attachment.requests?.requester_id === user.user_id

        if (!isAdmin && !isUploader && !isRequestOwner) {
            return { success: false, error: "غير مصرح لك بحذف هذا المرفق" }
        }

        await db.attachments.delete({
            where: { file_id: attachmentId }
        })

        // revalidatePath('/')
        return { success: true }
    } catch (error) {
        console.error("Delete Attachment Error:", error)
        return { success: false, error: "فشل في حذف المرفق" }
    }
}

/**
 * Get all attachments for a request
 */
export async function getRequestAttachments(requestId: number) {
    try {
        const attachments = await db.attachments.findMany({
            where: { request_id: requestId },
            include: {
                users: {
                    select: {
                        full_name: true,
                        university_id: true
                    }
                }
            },
            orderBy: { uploaded_at: 'desc' }
        })

        return {
            success: true,
            data: attachments
        }
    } catch (error) {
        console.error("Get Request Attachments Error:", error)
        return { success: false, error: "فشل في تحميل المرفقات" }
    }
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, maxSizeMB: number = 10): { success: boolean; error?: string } {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
        return { success: false, error: `حجم الملف يجب أن يكون أقل من ${maxSizeMB} ميجابايت` }
    }

    // Check file type
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (!allowedTypes.includes(file.type)) {
        return { success: false, error: "نوع الملف غير مسموح به" }
    }

    return { success: true }
}

