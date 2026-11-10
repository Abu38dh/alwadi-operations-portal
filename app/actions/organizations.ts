"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

import { logAuditAction } from "./audit"
// ... (existing imports)

/**
 * Get all colleges with their deans
 */
export async function getAllColleges() {
    try {
        const collegesRaw = await db.$queryRaw<any[]>`
            SELECT c.college_id, c.name, c.dean_id, c.show_absences, u.full_name AS dean_name
            FROM colleges c
            LEFT JOIN users u ON u.user_id = c.dean_id
            ORDER BY c.name ASC
        `
        const deptsRaw = await db.$queryRaw<any[]>`
            SELECT d.department_id, d.dept_name, d.college_id, d.manager_id, d.is_academic,
                   m.full_name AS manager_name
            FROM departments d
            LEFT JOIN users m ON m.user_id = d.manager_id
            ORDER BY d.dept_name ASC
        `

        const data = collegesRaw.map((c: any) => ({
            college_id: Number(c.college_id),
            name: c.name,
            dean_id: c.dean_id ? Number(c.dean_id) : null,
            show_absences: c.show_absences,
            users: c.dean_id ? { full_name: c.dean_name } : null,
            departments: deptsRaw
                .filter((d: any) => d.college_id && Number(d.college_id) === Number(c.college_id))
                .map((d: any) => ({
                    department_id: Number(d.department_id),
                    dept_name: d.dept_name,
                    college_id: Number(d.college_id),
                    manager_id: d.manager_id ? Number(d.manager_id) : null,
                    is_academic: d.is_academic,
                    users_departments_manager_idTousers: d.manager_id ? { full_name: d.manager_name } : null,
                }))
        }))

        return { success: true, data }
    } catch (error) {
        return { success: false, error: "فشل في تحميل الفروع والإدارات" }
    }
}

/**
 * Get all non-student active users as dean candidates
 */
export async function getDeanCandidates() {
    try {
        const users = await db.$queryRaw<any[]>`
            SELECT u.user_id, u.full_name, u.university_id, r.role_name
            FROM users u
            JOIN roles r ON r.role_id = u.role_id
            WHERE u.is_active = true
              AND r.role_name != 'student'
            ORDER BY u.full_name ASC
        `
        const data = users.map((u: any) => ({
            user_id: Number(u.user_id),
            full_name: u.full_name,
            university_id: u.university_id,
            roles: { role_name: u.role_name }
        }))
        return { success: true, data }
    } catch (error) {
        return { success: false, error: "فشل في تحميل قائمة المرشحين للعمادة" }
    }
}


/**
 * Get organization structure (lightweight for dropdowns)
 * Uses raw SQL to avoid outdated Prisma client issues with the levels table.
 */
export async function getOrganizationStructure() {
    try {
        const collegesRaw = await db.$queryRaw<any[]>`
            SELECT college_id, name, show_absences FROM colleges ORDER BY name ASC
        `
        const deptsRaw = await db.$queryRaw<any[]>`
            SELECT department_id, dept_name, college_id, show_absences FROM departments ORDER BY dept_name ASC
        `
        const levelsRaw = await db.$queryRaw<any[]>`
            SELECT level_id, name, "order", department_id, show_absences FROM levels ORDER BY "order" ASC
        `

        const data = collegesRaw.map((c: any) => ({
            college_id: c.college_id,
            name: c.name,
            show_absences: c.show_absences,
            departments: deptsRaw
                .filter((d: any) => d.college_id === c.college_id)
                .map((d: any) => ({
                    department_id: d.department_id,
                    dept_name: d.dept_name,
                    show_absences: d.show_absences,
                    college_id: d.college_id,
                    levels: levelsRaw
                        .filter((l: any) => l.department_id === d.department_id)
                        .map((l: any) => ({
                            level_id: l.level_id,
                            name: l.name,
                            show_absences: l.show_absences,
                            order: Number(l.order)
                        }))
                }))
        }))

        return { success: true, data }

    } catch (error) {
        console.error("Get Organization Structure Error:", error)
        return { success: false, error: "فشل في تحميل الهيكل التنظيمي" }
    }
}

/**
 * Create new college/branch
 */
export async function createCollege(data: {
    name: string
    dean_id?: number
}, requesterId?: string) {
    try {
        const college = await db.colleges.create({
            data: {
                name: data.name,
                dean_id: data.dean_id || null
            }
        })

        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'CREATE', 'COLLEGE', college.name, { new_id: college.college_id })
        }

        // revalidatePath('/admin')
        return { success: true, data: college }
    } catch (error) {
        console.error("Create College Error:", error)
        return { success: false, error: "فشل في إضافة الفرع / الإدارة" }
    }
}

/**
 * Update college/branch
 */
export async function updateCollege(
    collegeId: number,
    data: {
        name?: string
        dean_id?: number | null
        show_absences?: boolean
    },
    requesterId?: string
) {
    try {
        const updateData: any = {}
        if (data.name !== undefined) updateData.name = data.name
        if (data.dean_id !== undefined) updateData.dean_id = data.dean_id
        if (data.show_absences !== undefined) updateData.show_absences = data.show_absences

        const college = await db.colleges.update({
            where: { college_id: collegeId },
            data: updateData
        })

        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'UPDATE', 'COLLEGE', college.name, { updated_fields: Object.keys(updateData) })
        }

        // revalidatePath('/admin')
        return { success: true, data: college }
    } catch (error) {
        console.error("Update College Error:", error)
        return { success: false, error: "فشل في تحديث الفرع / الإدارة" }
    }
}

/**
 * Delete college/branch
 */
export async function deleteCollege(collegeId: number, requesterId?: string) {
    try {
        // Check if college has departments
        const departments = await db.departments.findMany({
            where: { college_id: collegeId }
        })

        if (departments.length > 0) {
            return {
                success: false,
                error: "لا يمكن حذف الفرع لأنه يحتوي على أقسام مسجلة"
            }
        }

        const college = await db.colleges.findUnique({ where: { college_id: collegeId } })

        await db.colleges.delete({
            where: { college_id: collegeId }
        })

        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'DELETE', 'COLLEGE', college?.name || collegeId.toString(), null)
        }

        // revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Delete College Error:", error)
        return { success: false, error: "فشل في حذف الفرع / الإدارة" }
    }
}

/**
 * Get all departments — uses raw SQL to avoid outdated Prisma client issues
 */
export async function getAllDepartments() {
    try {
        const rows = await db.$queryRaw<any[]>`
            SELECT
                d.department_id,
                d.dept_name,
                d.college_id,
                d.manager_id,
                d.is_academic,
                d.show_absences,
                c.name AS college_name,
                u.full_name AS manager_name
            FROM departments d
            LEFT JOIN colleges c ON c.college_id = d.college_id
            LEFT JOIN users u ON u.user_id = d.manager_id
            ORDER BY d.dept_name ASC
        `

        const data = rows.map((r: any) => ({
            department_id: Number(r.department_id),
            dept_name: r.dept_name,
            college_id: r.college_id ? Number(r.college_id) : null,
            manager_id: r.manager_id ? Number(r.manager_id) : null,
            is_academic: r.is_academic,
            show_absences: r.show_absences,
            colleges: r.college_id ? { college_id: Number(r.college_id), name: r.college_name } : null,
            users_departments_manager_idTousers: r.manager_id ? { full_name: r.manager_name } : null,
        }))

        return { success: true, data }
    } catch (error) {
        console.error("Get All Departments Error:", error)
        return { success: false, error: "فشل في تحميل الأقسام" }
    }
}


/**
 * Create new department
 */
export async function createDepartment(data: {
    dept_name: string
    college_id?: number | null
    manager_id?: number | null
    is_academic?: boolean
}, requesterId?: string) {
    try {
        const department = await db.departments.create({
            data: {
                dept_name: data.dept_name,
                college_id: data.college_id || null,
                manager_id: data.manager_id || null,
                is_academic: data.is_academic !== undefined ? data.is_academic : true
            }
        })

        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'CREATE', 'DEPARTMENT', department.dept_name, { new_id: department.department_id })
        }

        // revalidatePath('/admin')
        return { success: true, data: department }
    } catch (error: any) {
        console.error("Create Department Error:", error)
        return { success: false, error: "فشل في إنشاء القسم: " + (error.message || String(error)) }
    }
}

/**
 * Update department
 */
export async function updateDepartment(
    departmentId: number,
    data: {
        dept_name?: string
        college_id?: number
        manager_id?: number | null
        is_academic?: boolean
    },
    requesterId?: string
) {
    try {
        const updateData: any = {}
        if (data.dept_name !== undefined) updateData.dept_name = data.dept_name
        if (data.college_id !== undefined) updateData.college_id = data.college_id
        if (data.manager_id !== undefined) updateData.manager_id = data.manager_id
        if (data.is_academic !== undefined) updateData.is_academic = data.is_academic

        const department = await db.departments.update({
            where: { department_id: departmentId },
            data: updateData
        })

        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'UPDATE', 'DEPARTMENT', department.dept_name, { updated_fields: Object.keys(updateData) })
        }

        // revalidatePath('/admin')
        return { success: true, data: department }
    } catch (error) {
        console.error("Update Department Error:", error)
        return { success: false, error: "فشل في تحديث القسم" }
    }
}

/**
 * Delete department
 */
export async function deleteDepartment(departmentId: number, requesterId?: string) {
    try {
        // Check if department has users
        const users = await db.users.findMany({
            where: { department_id: departmentId }
        })

        if (users.length > 0) {
            return {
                success: false,
                error: "لا يمكن حذف القسم لأنه يحتوي على مستخدمين"
            }
        }

        // Check if department has levels
        const levels = await db.levels.findMany({
            where: { department_id: departmentId }
        })

        if (levels.length > 0) {
            return {
                success: false,
                error: "لا يمكن حذف القسم لأنه يحتوي على بيانات وسجلات مرتبطة"
            }
        }

        const dept = await db.departments.findUnique({ where: { department_id: departmentId } })

        await db.departments.delete({
            where: { department_id: departmentId }
        })

        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'DELETE', 'DEPARTMENT', dept?.dept_name || departmentId.toString(), null)
        }

        // revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Delete Department Error:", error)
        return { success: false, error: "فشل في حذف القسم" }
    }
}

/**
 * Get eligible users for dean/manager roles
 */
export async function getEligibleManagers() {
    try {
        const users = await db.users.findMany({
            where: {
                is_active: true,
                roles: {
                    role_name: {
                        in: ['employee', 'admin']
                    }
                }
            },
            include: {
                roles: true,
                departments_users_department_idTodepartments: {
                    include: {
                        colleges: true
                    }
                }
            },
            orderBy: { full_name: 'asc' }
        })

        return {
            success: true,
            data: users
        }
    } catch (error) {
        console.error("Get Eligible Managers Error:", error)
        return { success: false, error: "فشل في تحميل المستخدمين المؤهلين" }
    }
}

/**
 * Toggle absence visibility for a college
 */
export async function updateCollegeAbsenceVisibility(collegeId: number, showAbsences: boolean) {
    try {
        await db.$executeRaw`
            UPDATE colleges SET show_absences = ${showAbsences} WHERE college_id = ${collegeId}
        `
        return { success: true }
    } catch (error) {
        console.error("Update College Absence Visibility Error:", error)
        return { success: false, error: "فشل في تحديث إعداد السجلات للفرع" }
    }
}

/**
 * Toggle visibility for a department
 */
export async function updateDepartmentAbsenceVisibility(departmentId: number, showAbsences: boolean) {
    try {
        await db.$executeRaw`
            UPDATE departments SET show_absences = ${showAbsences} WHERE department_id = ${departmentId}
        `
        return { success: true }
    } catch (error) {
        console.error("Update Department Visibility Error:", error)
        return { success: false, error: "فشل في تحديث إعداد السجلات للقسم" }
    }
}

/**
 * Toggle visibility for an organizational level
 */
export async function updateLevelAbsenceVisibility(levelId: number, showAbsences: boolean) {
    try {
        await db.$executeRaw`
            UPDATE levels SET show_absences = ${showAbsences} WHERE level_id = ${levelId}
        `
        return { success: true }
    } catch (error) {
        console.error("Update Level Visibility Error:", error)
        return { success: false, error: "فشل في تحديث إعداد السجلات للمستوى" }
    }
}

