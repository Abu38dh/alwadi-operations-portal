"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import * as bcrypt from "bcryptjs"

export async function getAdminStats() {
    const [totalUsers, totalRequests, activeRequests, totalForms, completedRequests] = await Promise.all([
        db.users.count(),
        db.requests.count(),
        db.requests.count({ where: { status: 'pending' } }),
        db.form_templates.count({ where: { is_active: true } }),
        db.requests.count({ where: { status: { in: ['approved', 'rejected'] } } })
    ])

    const completionRate = totalRequests > 0
        ? Math.round((completedRequests / totalRequests) * 100)
        : 0

    return {
        totalUsers,
        totalRequests,
        activeRequests,
        totalForms,
        completionRate
    }
}

export async function getCurrentUserScope(requesterId: string) {
    if (!requesterId) return { success: false, error: "Missing requester ID" }

    const requester = await db.users.findUnique({
        where: { university_id: requesterId },
        include: {
            roles: true,
            departments_users_department_idTodepartments: {
                include: { colleges: true }
            }
        }
    })

    if (!requester) return { success: false, error: "User not found" }

    let roleName = requester.roles.role_name.toLowerCase()
    
    // Treat as admin if they have the 'all' permission
    if (requester.custom_permissions) {
        try {
            const perms = JSON.parse(requester.custom_permissions)
            if (perms.includes('all')) {
                roleName = 'admin'
            }
        } catch (e) {
            console.error("Error parsing permissions", e)
        }
    }

    // Determine College ID
    let collegeId: number | undefined = undefined
    if (requester.departments_users_department_idTodepartments?.colleges?.college_id) {
        collegeId = requester.departments_users_department_idTodepartments.colleges.college_id
    } else {
        // Try finding if they are dean of a college
        const college = await db.colleges.findFirst({
            where: { dean_id: requester.user_id }
        })
        if (college) collegeId = college.college_id
    }

    return {
        success: true,
        data: {
            role: roleName,
            collegeId: collegeId,
            departmentId: requester.department_id
        }
    }
}

export async function getUsers(
    page: number = 1,
    limit: number = 50,
    requesterId?: string,
    search?: string,
    filterCollegeId?: string, // user selected
    filterDeptId?: string    // user selected
) {
    try {
        const skip = (page - 1) * limit

        // Build base where clause based on requester role/scope
        // Default to Fail Closed (Show nothing) if no valid scope found
        let baseWhere: any = { user_id: -1 }

        if (requesterId) {
            console.log("[getUsers] Checking scope for:", requesterId)
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
                let roleName = requester.roles.role_name.toLowerCase()
                
                let hasAdminOrDelegationPerm = false
                if (requester.custom_permissions) {
                    try {
                        const perms = JSON.parse(requester.custom_permissions)
                        if (perms.includes('all')) {
                            roleName = 'admin'
                            hasAdminOrDelegationPerm = true
                        } else if (perms.includes('manage_users') || perms.includes('grant_delegations')) {
                            hasAdminOrDelegationPerm = true
                        }
                    } catch (e) {
                        console.error("Error parsing permissions", e)
                    }
                }

                // In a company, Admin, CEO/General Manager (dean), and users with manage_users or grant_delegations see all company employees
                if (roleName === 'admin' || roleName === 'dean' || hasAdminOrDelegationPerm) {
                    baseWhere = {}
                }
                // Head Scope: Users in their department
                else if (roleName === 'head_of_department' || roleName === 'manager' || roleName === 'head') {
                    const deptId = requester.department_id
                    if (deptId) {
                        baseWhere = {
                            department_id: deptId
                        }
                    } else {
                        baseWhere = {}
                    }
                } else {
                    baseWhere = {}
                }
            }
        }

        // Apply filters on top of base scope
        const whereClause: any = {
            AND: [
                baseWhere,
                search ? {
                    OR: [
                        { full_name: { contains: search } },
                        { university_id: { contains: search } }
                    ]
                } : {},
                filterCollegeId ? {
                    departments_users_department_idTodepartments: {
                        college_id: parseInt(filterCollegeId)
                    }
                } : {},
                filterDeptId ? {
                    department_id: parseInt(filterDeptId)
                } : {}
            ]
        }

        const [users, total] = await Promise.all([
            db.users.findMany({
                where: whereClause,
                include: {
                    roles: true,
                    departments_users_department_idTodepartments: {
                        include: {
                            colleges: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                skip: skip,
                take: limit
            }),
            db.users.count({ where: whereClause })
        ])

        const ALL_ADMIN_PERMS = ['review_requests', 'manage_forms', 'manage_users', 'manage_departments', 'view_reports', 'manage_workflows', 'grant_delegations', 'audit_access', 'can_manage_absences', 'manage_terms', 'manage_levels']

        // Parse custom_permissions JSON for each user
        const usersWithPermissions = users.map((user: any) => {
            const isAdmin = user.roles?.role_name?.toLowerCase() === 'admin'
            const storedPerms: string[] = user.custom_permissions ? JSON.parse(user.custom_permissions) : []
            let permissions: string[]
            if (isAdmin) {
                // If no permissions stored, has 'all', or corrupted (< 5 perms) → default to all
                const isFullAccess = storedPerms.length === 0 || storedPerms.includes('all') || storedPerms.length < 5
                permissions = isFullAccess ? ALL_ADMIN_PERMS : storedPerms
            } else {
                permissions = storedPerms
            }
            return { ...user, permissions }
        })

        return {
            success: true,
            data: usersWithPermissions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        }
    } catch (error) {
        console.error("Get Users Error:", error)
        return { success: false, error: "فشل في تحميل المستخدمين" }
    }
}

import { logAuditAction } from "./audit"

// ... (existing imports)

export async function createUser(data: any, requesterId?: string) {
    try {
        const password = data.password || "123" // Use provided password or default
        const hash = await bcrypt.hash(password, 10)

        // Fetch the role to get its default permissions
        const role = await db.roles.findUnique({
            where: { role_id: parseInt(data.role_id) }
        })

        let customPermissions: string[] | null = null

        if (role) {
            // Start with role's default permissions
            const currentPermissions = (role.permissions as string[]) || []
            const newPermissions = new Set(currentPermissions)

            // Add automatic permissions based on role
            if (role.role_name === 'head_of_department' || role.role_name === 'manager' || role.role_name === 'dean') {
                newPermissions.add('review_requests')
                newPermissions.add('manage_forms')
                // Managers also need to see reports usually
                newPermissions.add('view_reports')
            } else if (role.role_name === 'admin') {
                newPermissions.add('all')
            }

            // Only set custom_permissions if we added something new or if we want to enforce specific permissions
            if (newPermissions.size > 0) {
                customPermissions = Array.from(newPermissions)
            }
        }

        const newUser = await db.users.create({
            data: {
                university_id: data.university_id,
                full_name: data.full_name,
                password_hash: hash,
                phone: data.phone || null,
                email: data.email || null,
                role_id: parseInt(data.role_id),
                department_id: data.department_id ? parseInt(data.department_id) : null,
                level_id: data.level_id ? parseInt(data.level_id) : null,
                custom_permissions: customPermissions ? JSON.stringify(customPermissions) : null
            }
        })

        // Audit Log
        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'CREATE', 'USER', newUser.university_id, {
                new_user_id: newUser.user_id,
                role_id: data.role_id
            })
        }

        revalidatePath('/', 'layout')
        return { success: true }
    } catch (e: any) {
        console.error("Create User Error:", e)
        if (e?.code === 'P2002') {
            return { success: false, error: "الرقم الوظيفي أو اسم المستخدم مستخدم بالفعل في النظام" }
        }
        return { success: false, error: "Failed to create user" }
    }
}

/**
 * Update user
 */
export async function updateUser(userId: number, data: any, requesterId?: string) {
    try {
        const updateData: any = {}
        if (data.full_name) updateData.full_name = data.full_name
        if (data.email !== undefined) updateData.email = data.email
        if (data.phone !== undefined) updateData.phone = data.phone
        if (data.role_id) updateData.role_id = parseInt(data.role_id)
        if (data.department_id !== undefined) {
            updateData.department_id = data.department_id ? parseInt(data.department_id) : null
        }
        if (data.level_id !== undefined) {
            updateData.level_id = data.level_id ? parseInt(data.level_id) : null
        }
        if (data.is_active !== undefined) updateData.is_active = data.is_active
        if (data.permissions !== undefined) {
            console.log("Saving permissions:", data.permissions)
            updateData.custom_permissions = JSON.stringify(data.permissions)
        }
        if (data.password) {
            const hash = await bcrypt.hash(data.password, 10)
            updateData.password_hash = hash
        }

        console.log("Update Data:", updateData)

        // Get old data for audit diff (optional, but good practice)
        // For simplicity, just logging the update action
        
        const result = await db.users.update({
            where: { user_id: userId },
            data: updateData
        })

        console.log("Update Result:", result)

        // Audit Log
        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'UPDATE', 'USER', result.university_id, {
                updated_fields: Object.keys(updateData)
            })
        }

        revalidatePath('/', 'layout')
        return { success: true }
    } catch (e: any) {
        console.error("Update User Error:", e)
        console.error("Error details:", e.message, e.code)
        return { success: false, error: e.message || "فشل في تحديث المستخدم" }
    }
}

/**
 * Deactivate user (soft delete)
 */
export async function deleteUser(userId: number, requesterId?: string) {
    try {
        const targetUser = await db.users.findUnique({ where: { user_id: userId } })
        
        await db.users.update({
            where: { user_id: userId },
            data: { is_active: false }
        })

        // Audit Log
        if (requesterId) {
            const executor = await db.users.findUnique({ where: { university_id: requesterId } })
            await logAuditAction(executor?.user_id, 'DEACTIVATE', 'USER', targetUser?.university_id || userId.toString(), null)
        }

        revalidatePath('/', 'layout')
        return { success: true }
    } catch (e) {
        console.error("Delete User Error:", e)
        return { success: false, error: "فشل في حذف المستخدم" }
    }
}

/**
 * Get all roles
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

/**
 * Get reports data for admin dashboard
 */
export async function getReportsData(startDate?: Date, endDate?: Date, requesterId?: string) {
    try {
        let whereClause: any = {}

        if (startDate || endDate) {
            whereClause.submitted_at = {}
            if (startDate) whereClause.submitted_at.gte = startDate
            if (endDate) whereClause.submitted_at.lte = endDate
        }

        // Apply Scope Restrictions
        if (requesterId) {
            const scope = await getCurrentUserScope(requesterId)
            if (scope.success && scope.data) {
                const { role, collegeId, departmentId } = scope.data

                if (role === 'admin') {
                    // No restrictions
                } else if (role === 'dean' && collegeId) {
                    whereClause.users = {
                        departments_users_department_idTodepartments: {
                            college_id: collegeId
                        }
                    }
                } else if ((role === 'head' || role === 'manager' || role === 'head_of_department') && departmentId) {
                    whereClause.users = {
                        department_id: departmentId
                    }
                } else {
                    // Fail closed for others
                    return { success: true, data: { stats: { total: 0, pending: 0, approved: 0, rejected: 0 }, byStatus: [], byType: [], recentRequests: [] } }
                }
            } else {
                return { success: true, data: { stats: { total: 0, pending: 0, approved: 0, rejected: 0 }, byStatus: [], byType: [], recentRequests: [] } }
            }
        } else {
            // If no requesterId provided, we might fail closed or assume admin? 
            // Ideally fail closed to be safe, but existing calls might break.
            // Given the strict requirement, let's fail closed if not admin context explicitly known or handled.
            // But for now, let's allow it to behave as before if param missing (or maybe fail closed is safer).
            // Let's decided to fail closed to be secure.
            console.warn("getReportsData called without requesterId - returning empty")
            return { success: true, data: { stats: { total: 0, pending: 0, approved: 0, rejected: 0 }, byStatus: [], byType: [], recentRequests: [] } }
        }

        // 1. Calculate Stats (Total, Pending, Approved, Rejected)
        const total = await db.requests.count({ where: whereClause })
        const pending = await db.requests.count({
            where: { ...whereClause, status: 'pending' }
        })
        const approved = await db.requests.count({
            where: { ...whereClause, status: 'approved' }
        })
        const rejected = await db.requests.count({
            where: { ...whereClause, status: 'rejected' }
        })

        // 2. Requests by Status (for Chart)
        const requestsByStatus = await db.requests.groupBy({
            by: ['status'],
            where: whereClause,
            _count: true
        })

        // Format for frontend: [{ status: 'pending', count: 10 }, ...]
        const byStatus = requestsByStatus.map((item: any) => ({
            status: item.status,
            count: item._count
        }))


        // 3. Requests by Form Type (for Chart)
        const requestsByType = await db.requests.groupBy({
            by: ['form_id'],
            where: whereClause,
            _count: true
        })

        // Get form names
        const formIds = requestsByType.map((r: any) => r.form_id).filter(Boolean) as number[]
        const forms = await db.form_templates.findMany({
            where: { form_id: { in: formIds } },
            select: { form_id: true, name: true }
        })

        // Format for frontend: [{ type_name: 'Form A', count: 5 }, ...]
        const byType = requestsByType.map((r: any) => ({
            type_name: forms.find((f: any) => f.form_id === r.form_id)?.name || "غير محدد",
            count: r._count
        }))

        // 4. Recent Requests
        const recentRequests = await db.requests.findMany({
            where: whereClause,
            take: 100,
            orderBy: { submitted_at: 'desc' },
            include: {
                users: {
                    select: { full_name: true }
                },
                form_templates: {
                    select: { name: true }
                }
            }
        })

        // Format recent requests to match frontend expectation
        const formattedRecent = recentRequests.map((req: any) => ({
            request_id: req.request_id,
            status: req.status,
            submitted_at: req.submitted_at,
            requester: {
                full_name: req.users?.full_name
            },
            form_templates: {
                name: req.form_templates?.name
            }
        }))

        return {
            success: true,
            data: {
                stats: {
                    total,
                    pending,
                    approved,
                    rejected
                },
                byStatus,
                byType,
                recentRequests: formattedRecent
            }
        }
    } catch (error) {
        console.error("Get Reports Data Error:", error)
        return { success: false, error: "فشل في تحميل بيانات التقارير" }
    }
}

/**
 * Get audit log (request actions)
 */
/**
 * Get audit log (request actions)
 */
export async function getAuditLog(filters?: {
    userId?: number
    requestId?: number
    startDate?: Date
    endDate?: Date
    limit?: number
    requesterId?: string
}) {
    try {
        let whereClause: any = {}

        if (filters?.userId) whereClause.actor_id = filters.userId
        if (filters?.requestId) whereClause.request_id = filters.requestId
        if (filters?.startDate || filters?.endDate) {
            whereClause.created_at = {}
            if (filters.startDate) whereClause.created_at.gte = filters.startDate
            if (filters.endDate) whereClause.created_at.lte = filters.endDate
        }

        // Apply Scope Restrictions
        if (filters?.requesterId) {
            const scope = await getCurrentUserScope(filters.requesterId)
            if (scope.success && scope.data) {
                const { role, collegeId, departmentId } = scope.data

                if (role === 'admin') {
                    // No restrictions
                } else if (role === 'dean' && collegeId) {
                    // Show actions where the actor (user) is in the college
                    whereClause.users = {
                        departments_users_department_idTodepartments: {
                            college_id: collegeId
                        }
                    }
                } else if ((role === 'head' || role === 'manager' || role === 'head_of_department') && departmentId) {
                    // Show actions where the actor is in the department
                    whereClause.users = {
                        department_id: departmentId
                    }
                } else {
                    return { success: true, data: [] }
                }
            } else {
                return { success: true, data: [] }
            }
        } else {
            console.warn("getAuditLog called without requesterId - returning empty")
            return { success: true, data: [] }
        }

        const actions = await db.request_actions.findMany({
            where: whereClause,
            include: {
                users: true,
                requests: {
                    include: {
                        form_templates: true
                    }
                },
                workflow_steps: true
            },
            orderBy: { created_at: 'desc' },
            take: filters?.limit || 100
        })

        return {
            success: true,
            data: actions
        }
    } catch (error) {
        console.error("Get Audit Log Error:", error)
        return { success: false, error: "فشل في تحميل سجل التدقيق" }
    }
}

/**
 * Get all possible approvers (Roles + Users)
 */
export async function getApproversList(requesterId?: string) {
    try {
        let userWhereClause: any = { 
            is_active: true,
            roles: { role_name: { not: 'student' } }
        }

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

                let hasAdminOrDelegationPerm = false
                if (requester.custom_permissions) {
                    try {
                        const perms = JSON.parse(requester.custom_permissions)
                        if (perms.includes('all')) {
                            hasAdminOrDelegationPerm = true
                        } else if (perms.includes('manage_users') || perms.includes('grant_delegations')) {
                            hasAdminOrDelegationPerm = true
                        }
                    } catch (e) {
                        console.error("Error parsing permissions", e)
                    }
                }

                if (roleName === 'admin' || roleName === 'dean' || hasAdminOrDelegationPerm) {
                    userWhereClause = {
                        is_active: true,
                        roles: { role_name: { not: 'student' } }
                    }
                } else if (roleName === 'head_of_department' || roleName === 'manager' || roleName === 'head') {
                    const deptId = requester.department_id
                    if (deptId) {
                        userWhereClause = {
                            is_active: true,
                            roles: { role_name: { not: 'student' } },
                            department_id: deptId
                        }
                    } else {
                        userWhereClause = {
                            is_active: true,
                            roles: { role_name: { not: 'student' } }
                        }
                    }
                } else {
                    userWhereClause = {
                        is_active: true,
                        roles: { role_name: { not: 'student' } }
                    }
                }
            }
        }

        const roles = await db.roles.findMany({
            orderBy: { role_name: 'asc' }
        })

        const users = await db.users.findMany({
            where: userWhereClause,
            select: {
                user_id: true,
                full_name: true,
                university_id: true,
                roles: {
                    select: { role_name: true }
                }
            },
            orderBy: { full_name: 'asc' }
        })

        return {
            success: true,
            data: {
                roles,
                users
            }
        }
    } catch (error) {
        console.error("Get Approvers Error:", error)
        return { success: false, error: "فشل في تحميل قائمة الموافقين" }
    }
}

/**
 * Get all active delegations across the company
 */
export async function getAllActiveDelegations() {
    try {
        const now = new Date()
        const delegations = await db.delegations.findMany({
            where: {
                is_active: true,
                ends_at: { gte: now }
            },
            include: {
                users_delegations_grantor_user_idTousers: { select: { user_id: true, full_name: true, university_id: true } },
                users_delegations_grantee_user_idTousers: { select: { user_id: true, full_name: true, university_id: true } }
            },
            orderBy: { delegation_id: 'desc' }
        });

        return { success: true, data: delegations };
    } catch (error) {
        console.error("Get All Active Delegations Error:", error);
        return { success: false, error: "فشل في تحميل التفويضات النشطة" };
    }
}

/**
 * Get delegations for a specific user (Grantor or Grantee)
 */
export async function getAdminDelegations(userId: number) {
    try {
        const delegations = await db.delegations.findMany({
            where: {
                OR: [
                    { grantor_user_id: userId },
                    { grantee_user_id: userId }
                ]
            },
            include: {
                users_delegations_grantor_user_idTousers: { select: { full_name: true, university_id: true } },
                users_delegations_grantee_user_idTousers: { select: { full_name: true, university_id: true } }
            },
            orderBy: { delegation_id: 'desc' }
        });

        return { success: true, data: delegations };
    } catch (error) {
        console.error("Get Admin Delegations Error:", error);
        return { success: false, error: "فشل في تحميل تفويضات المستخدم" };
    }
}

/**
 * Create a delegation on behalf of a user (Admin Override)
 */
export async function adminCreateDelegation(grantorId: number, granteeId: number, startsAt: Date, endsAt: Date, reason: string, delegatedTypes: number[] | null, adminUserId: string) {
    try {
        // Validate admin
        const admin = await db.users.findUnique({
            where: { university_id: adminUserId },
            include: { roles: true }
        });
        
        let isAuthorized = ['admin', 'dean', 'head'].includes(admin?.roles?.role_name || '')
        if (!isAuthorized && admin?.custom_permissions) {
            try {
                const perms = JSON.parse(admin.custom_permissions)
                if (perms.includes('all') || perms.includes('grant_delegations') || perms.includes('manage_users')) {
                    isAuthorized = true
                }
            } catch (e) {}
        }

        if (!admin || !isAuthorized) {
             return { success: false, error: "غير مصرح بإنشاء تفويض" };
        }

        const newDelegation = await db.delegations.create({
            data: {
                grantor_user_id: grantorId,
                grantee_user_id: granteeId,
                starts_at: startsAt,
                ends_at: endsAt,
                is_active: true,
                delegated_types: delegatedTypes || undefined
            }
        });

        return { success: true, data: newDelegation };
    } catch (error) {
        console.error("Admin Create Delegation Error:", error);
        return { success: false, error: "فشل إنشاء التفويض" };
    }
}

/**
 * Revoke a delegation (Admin Override)
 */
export async function adminRevokeDelegation(delegationId: number, adminUserId: string) {
    try {
        // Validate admin
        const admin = await db.users.findUnique({
            where: { university_id: adminUserId },
            include: { roles: true }
        });
        
        let isAuthorized = ['admin', 'dean', 'head'].includes(admin?.roles?.role_name || '')
        if (!isAuthorized && admin?.custom_permissions) {
            try {
                const perms = JSON.parse(admin.custom_permissions)
                if (perms.includes('all') || perms.includes('grant_delegations') || perms.includes('manage_users')) {
                    isAuthorized = true
                }
            } catch (e) {}
        }

        if (!admin || !isAuthorized) {
             return { success: false, error: "غير مصرح بإلغاء التفويض" };
        }

        const updated = await db.delegations.update({
            where: { delegation_id: delegationId },
            data: { is_active: false }
        });

        return { success: true, data: updated };
    } catch (error) {
        console.error("Admin Revoke Delegation Error:", error);
        return { success: false, error: "فشل إلغاء التفويض" };
    }
}

/**
 * Get all requests for a specific user (Admin view)
 * Returns data in the same format as getRequesterInteractionHistory
 */
export async function adminGetUserRequests(adminUserId: string, targetUserId: number) {
    try {
        // Validate admin
        const admin = await db.users.findUnique({
            where: { university_id: adminUserId },
            include: { roles: true }
        });
        
        if (!admin || !['admin', 'dean', 'head'].includes(admin.roles?.role_name || '')) {
             return { success: false, error: "غير مصرح لك بعرض الطلبات" };
        }

        // Get target user bio
        const targetUser = await db.users.findUnique({
            where: { user_id: targetUserId },
            include: {
                departments_users_department_idTodepartments: {
                    include: { colleges: true }
                }
            }
        });

        if (!targetUser) return { success: false, error: "المستخدم غير موجود" };

        const requesterBio = {
            name: targetUser.full_name,
            university_id: targetUser.university_id,
            department: targetUser.departments_users_department_idTodepartments?.dept_name,
            college: targetUser.departments_users_department_idTodepartments?.colleges?.name,
            phone: targetUser.phone,
            email: targetUser.email,
        };

        // Get ALL requests for the user (not just those the admin acted on)
        const requests = await db.requests.findMany({
            where: { requester_id: targetUserId },
            include: {
                form_templates: true,
                request_actions: {
                    include: { users: true },
                    orderBy: { created_at: 'desc' }
                }
            },
            orderBy: { submitted_at: 'desc' }
        });

        // Map to same format as employee's interaction history
        const interactions = requests.map((r: any) => {
            const latestAction = r.request_actions[0];
            return {
                id: r.request_id.toString(),
                requestId: r.request_id.toString(),
                requestType: r.form_templates?.name || "General",
                action: latestAction?.action || r.status,
                date: (r.submitted_at || r.created_at)?.toISOString().split('T')[0],
                comment: latestAction?.comment || null,
                originalStatus: r.status,
                latestActor: latestAction?.users?.full_name || null,
            };
        });

        return {
            success: true,
            requesterBio,
            interactions,
        };
    } catch (error) {
        console.error("Admin Get User Requests Error:", error);
        return { success: false, error: "فشل جلب طلبات المستخدم" };
    }
}
