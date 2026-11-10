import { z } from "zod"

/**
 * Validation schemas for backend operations
 */

// User schemas
export const createUserSchema = z.object({
    university_id: z.string()
        .min(1, "الرقم الوظيفي مطلوب")
        .regex(/^[A-Za-z0-9]+$/, "الرقم الوظيفي يجب أن يحتوي على أحرف وأرقام فقط"),
    full_name: z.string()
        .min(2, "الاسم يجب أن يكون حرفين على الأقل")
        .max(100, "الاسم طويل جداً"),
    password: z.string()
        .min(3, "كلمة المرور يجب أن تكون 3 أحرف على الأقل")
        .optional(),
    phone: z.string()
        .regex(/^[0-9+\-\s()]*$/, "رقم الهاتف غير صحيح")
        .optional()
        .nullable(),
    role_id: z.number().int().positive("معرف الدور غير صحيح"),
    department_id: z.number().int().positive().optional().nullable(),
})

export const updateUserSchema = z.object({
    full_name: z.string()
        .min(2, "الاسم يجب أن يكون حرفين على الأقل")
        .max(100, "الاسم طويل جداً")
        .optional(),
    password: z.string()
        .min(3, "كلمة المرور يجب أن تكون 3 أحرف على الأقل")
        .optional(),
    phone: z.string()
        .regex(/^[0-9+\-\s()]*$/, "رقم الهاتف غير صحيح")
        .optional()
        .nullable(),
    role_id: z.number().int().positive("معرف الدور غير صحيح").optional(),
    department_id: z.number().int().positive().optional().nullable(),
    is_active: z.boolean().optional(),
    permissions: z.array(z.string()).optional(),
})

// Form template schemas
export const saveFormTemplateSchema = z.object({
    form_id: z.number().int().positive().optional(),
    name: z.string()
        .min(3, "اسم النموذج يجب أن يكون 3 أحرف على الأقل")
        .max(200, "اسم النموذج طويل جداً"),
    schema: z.any(), // JSON schema validation
    request_type_id: z.number().int().positive().optional().nullable(),
    audience_config: z.any().optional(), // JSON validation
})

export const publishFormTemplateSchema = z.object({
    formId: z.number().int().positive("معرف النموذج غير صحيح"),
    audienceConfig: z.object({
        student: z.boolean().optional(),
        employee: z.boolean().optional(),
        colleges: z.array(z.number().int().positive()).optional(),
        departments: z.array(z.number().int().positive()).optional(),
    }),
})

// Workflow schemas
export const createWorkflowSchema = z.object({
    name: z.string()
        .min(3, "اسم مسار العمل يجب أن يكون 3 أحرف على الأقل")
        .max(200, "اسم مسار العمل طويل جداً"),
    steps: z.array(z.object({
        name: z.string().min(1, "اسم الخطوة مطلوب"),
        order: z.number().int().min(1, "ترتيب الخطوة يجب أن يكون 1 أو أكثر"),
        approver_role_id: z.number().int().positive().optional(),
        approver_user_id: z.number().int().positive().optional().nullable(),
        sla_hours: z.number().int().positive().optional(),
        is_final: z.boolean().optional(),
        escalation_role_id: z.number().int().positive().optional().nullable(),
    })).min(1, "يجب إضافة خطوة واحدة على الأقل"),
})

export const createDelegationSchema = z.object({
    grantorId: z.string().min(1, "معرف المانح مطلوب"),
    granteeId: z.string().min(1, "معرف المستلم مطلوب"),
    startDate: z.date(),
    endDate: z.date(),
    delegatedTypes: z.array(z.number().int().positive()).optional().nullable(),
}).refine((data) => data.endDate > data.startDate, {
    message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
    path: ["endDate"],
})

// Request schemas
export const submitRequestSchema = z.object({
    userId: z.string().min(1, "معرف المستخدم مطلوب"),
    formId: z.string().min(1, "معرف النموذج مطلوب"),
    reason: z.string().optional(),
    date: z.string().optional(),
    notes: z.string().optional(),
    delegateTo: z.string().optional(),
    endDate: z.string().optional(),
})

// Organization schemas
export const createCollegeSchema = z.object({
    name: z.string()
        .min(2, "اسم الفرع يجب أن يكون حرفين على الأقل")
        .max(200, "اسم الفرع طويل جداً"),
    dean_id: z.number().int().positive().optional(),
})

export const createDepartmentSchema = z.object({
    dept_name: z.string()
        .min(2, "اسم القسم يجب أن يكون حرفين على الأقل")
        .max(200, "اسم القسم طويل جداً"),
    college_id: z.number().int().positive("معرف الفرع غير صحيح"),
    manager_id: z.number().int().positive().optional(),
})

// Attachment schemas
export const uploadAttachmentSchema = z.object({
    requestId: z.number().int().positive("معرف الطلب غير صحيح"),
    file: z.any(), // File validation will be done separately
    uploaderId: z.string().min(1, "معرف الرافع مطلوب"),
})

// Helper functions
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
    try {
        const validated = schema.parse(data)
        return { success: true, data: validated }
    } catch (error) {
        if (error instanceof z.ZodError) {
            const firstError = error.errors[0]
            return { success: false, error: firstError.message }
        }
        return { success: false, error: "بيانات غير صحيحة" }
    }
}

export function validateFile(file: File, maxSizeMB: number = 10, allowedTypes: string[] = []): { success: boolean; error?: string } {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
        return { success: false, error: `حجم الملف يجب أن يكون أقل من ${maxSizeMB} ميجابايت` }
    }

    // Check file type if specified
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        return { success: false, error: "نوع الملف غير مسموح به" }
    }

    return { success: true }
}

