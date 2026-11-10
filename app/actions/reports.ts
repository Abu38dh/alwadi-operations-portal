"use server"

import { db } from "@/lib/db"
import { translateRole } from "@/lib/translations"

/**
 * Get SLA compliance report
 */
export async function getSLAComplianceReport(startDate?: Date, endDate?: Date) {
    try {
        const whereClause: any = {}

        if (startDate || endDate) {
            whereClause.submitted_at = {}
            if (startDate) whereClause.submitted_at.gte = startDate
            if (endDate) whereClause.submitted_at.lte = endDate
        }

        const requests = await db.requests.findMany({
            where: whereClause,
            include: {
                workflow_steps: true,
                request_actions: {
                    orderBy: { created_at: 'asc' }
                },
                form_templates: true
            }
        })

        // Calculate SLA compliance for each request
        const slaData = requests.map(request => {
            const actions = request.request_actions
            if (actions.length === 0 || !request.workflow_steps?.sla_hours) {
                return null
            }

            const submittedAt = request.submitted_at
            const firstAction = actions[0]?.created_at

            if (!submittedAt || !firstAction) return null

            const timeDiff = firstAction.getTime() - submittedAt.getTime()
            const hoursElapsed = timeDiff / (1000 * 60 * 60)
            const slaHours = request.workflow_steps?.sla_hours || 0

            return {
                requestId: request.request_id,
                referenceNo: request.reference_no,
                formName: request.form_templates?.name || "غير محدد",
                slaHours: slaHours,
                hoursElapsed: Math.round(hoursElapsed * 100) / 100,
                compliant: hoursElapsed <= slaHours,
                status: request.status
            }
        }).filter(Boolean)

        const totalWithSLA = slaData.length
        const compliant = slaData.filter(r => r?.compliant).length
        const nonCompliant = totalWithSLA - compliant
        const complianceRate = totalWithSLA > 0 ? Math.round((compliant / totalWithSLA) * 100) : 0

        return {
            success: true,
            data: {
                summary: {
                    totalWithSLA,
                    compliant,
                    nonCompliant,
                    complianceRate
                },
                requests: slaData
            }
        }
    } catch (error) {
        console.error("SLA Compliance Report Error:", error)
        return { success: false, error: "فشل في إنشاء تقرير الامتثال" }
    }
}

/**
 * Get employee performance report
 */
export async function getEmployeePerformanceReport(
    employeeId: string,
    startDate?: Date,
    endDate?: Date
) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: employeeId }
        })

        if (!user) return { success: false, error: "الموظف غير موجود" }

        const whereClause: any = {
            actor_id: user.user_id
        }

        if (startDate || endDate) {
            whereClause.created_at = {}
            if (startDate) whereClause.created_at.gte = startDate
            if (endDate) whereClause.created_at.lte = endDate
        }

        const actions = await db.request_actions.findMany({
            where: whereClause,
            include: {
                requests: {
                    include: {
                        form_templates: true
                    }
                }
            }
        })

        const totalActions = actions.length
        const approvals = actions.filter(a => a.action === 'approve').length
        const rejections = actions.filter(a => a.action === 'reject').length

        // Calculate average response time
        const responseTimes = actions.map(action => {
            const request = action.requests
            if (!request?.submitted_at || !action.created_at) return null

            const timeDiff = action.created_at.getTime() - request.submitted_at.getTime()
            return timeDiff / (1000 * 60 * 60) // hours
        }).filter(Boolean) as number[]

        const averageResponseTime = responseTimes.length > 0
            ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100) / 100
            : 0

        // Group by form type
        const byFormType: Record<string, number> = {}
        actions.forEach(action => {
            const formName = action.requests?.form_templates?.name || "غير محدد"
            byFormType[formName] = (byFormType[formName] || 0) + 1
        })

        return {
            success: true,
            data: {
                employee: {
                    id: user.university_id,
                    name: user.full_name
                },
                summary: {
                    totalActions,
                    approvals,
                    rejections,
                    approvalRate: totalActions > 0 ? Math.round((approvals / totalActions) * 100) : 0,
                    averageResponseTime
                },
                byFormType
            }
        }
    } catch (error) {
        console.error("Employee Performance Report Error:", error)
        return { success: false, error: "فشل في إنشاء تقرير الأداء" }
    }
}

/**
 * Get average processing time for a form
 */
export async function getAverageProcessingTime(formId: number) {
    try {
        const requests = await db.requests.findMany({
            where: {
                form_id: formId,
                status: { in: ['approved', 'rejected'] }
            },
            include: {
                request_actions: {
                    orderBy: { created_at: 'desc' },
                    take: 1
                }
            }
        })

        const processingTimes = requests.map(request => {
            const lastAction = request.request_actions[0]
            if (!request.submitted_at || !lastAction?.created_at) return null

            const timeDiff = lastAction.created_at.getTime() - request.submitted_at.getTime()
            return timeDiff / (1000 * 60 * 60) // hours
        }).filter(Boolean) as number[]

        const averageTime = processingTimes.length > 0
            ? Math.round((processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length) * 100) / 100
            : 0

        return {
            success: true,
            data: {
                formId,
                totalCompleted: requests.length,
                averageProcessingTimeHours: averageTime,
                averageProcessingTimeDays: Math.round((averageTime / 24) * 100) / 100
            }
        }
    } catch (error) {
        console.error("Average Processing Time Error:", error)
        return { success: false, error: "فشل في حساب متوسط وقت المعالجة" }
    }
}

/**
 * Get department statistics
 */
export async function getDepartmentStatistics(departmentId: number) {
    try {
        const department = await db.departments.findUnique({
            where: { department_id: departmentId },
            include: {
                colleges: true,
                users_users_department_idTodepartments: true
            }
        })

        if (!department) return { success: false, error: "القسم غير موجود" }

        // Get all users in this department
        const userIds = department.users_users_department_idTodepartments.map(u => u.user_id)

        // Get requests from department users
        const requests = await db.requests.findMany({
            where: {
                requester_id: { in: userIds }
            },
            include: {
                form_templates: true
            }
        })

        // Statistics
        const total = requests.length
        const byStatus = await db.requests.groupBy({
            by: ['status'],
            where: { requester_id: { in: userIds } },
            _count: true
        })

        const byForm = await db.requests.groupBy({
            by: ['form_id'],
            where: { requester_id: { in: userIds } },
            _count: true
        })

        return {
            success: true,
            data: {
                department: {
                    id: department.department_id,
                    name: department.dept_name,
                    college: department.colleges?.name || "غير محدد",
                    totalUsers: userIds.length
                },
                requests: {
                    total,
                    byStatus,
                    byForm
                }
            }
        }
    } catch (error) {
        console.error("Department Statistics Error:", error)
        return { success: false, error: "فشل في تحميل إحصائيات القسم" }
    }
}

/**
 * Get all employees performance KPIs for the admin.
 * Returns one row per employee with their action stats.
 */
export async function getAllEmployeesKPIs(termId?: number) {
    try {
        const employees = await db.users.findMany({
            where: {
                is_active: true,
                roles: { role_name: { not: "student" } }
            },
            include: { roles: true }
        })

        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const kpis = await Promise.all(employees.map(async (emp) => {
            // Build SQL to get all actions by this employee, optionally filtered by term
            let actionsQuery: string
            let actionsParams: any[]

            if (termId) {
                actionsQuery = `
                    SELECT ra.action_id, ra.request_id, ra.action, ra.created_at,
                           r.submitted_at
                    FROM request_actions ra
                    LEFT JOIN requests r ON ra.request_id = r.request_id
                    WHERE ra.actor_id = $1 AND r.term_id = $2
                    ORDER BY ra.created_at ASC
                `
                actionsParams = [emp.user_id, termId]
            } else {
                actionsQuery = `
                    SELECT ra.action_id, ra.request_id, ra.action, ra.created_at,
                           r.submitted_at
                    FROM request_actions ra
                    LEFT JOIN requests r ON ra.request_id = r.request_id
                    WHERE ra.actor_id = $1
                    ORDER BY ra.created_at ASC
                `
                actionsParams = [emp.user_id]
            }

            const allActions = await db.$queryRawUnsafe<{
                action_id: number
                request_id: number | null
                action: string | null
                created_at: Date | null
                submitted_at: Date | null
            }[]>(actionsQuery, ...actionsParams)

            const approved = allActions.filter(a => a.action === "approve").length
            const rejected = allActions.filter(a => a.action === "reject").length
            const returned = allActions.filter(a =>
                a.action === "returned" || a.action === "return" ||
                a.action === "reject_with_changes" || a.action === "returned_for_edit"
            ).length
            const totalProcessed = approved + rejected + returned

            const distinctRequestIds = new Set(allActions.map(a => a.request_id).filter(Boolean))
            const totalReceived = distinctRequestIds.size

            const recentActions = allActions.filter(a =>
                a.created_at && new Date(a.created_at) >= thirtyDaysAgo
            )
            const dailyInRate = parseFloat((totalReceived / 30).toFixed(2))
            const dailyProcessed = parseFloat((recentActions.length / 30).toFixed(2))

            const resolutionTimes: number[] = []
            allActions.forEach(action => {
                if (
                    (action.action === "approve" || action.action === "reject" || (action.action && action.action.includes("return"))) &&
                    action.created_at && action.submitted_at
                ) {
                    const diff = new Date(action.created_at).getTime() - new Date(action.submitted_at).getTime()
                    if (diff > 0) resolutionTimes.push(diff / (1000 * 60 * 60))
                }
            })
            const avgResolutionHours = resolutionTimes.length > 0
                ? parseFloat((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(2))
                : null

            return {
                id: emp.user_id,
                universityId: emp.university_id,
                name: emp.full_name,
                role: translateRole(emp.roles.role_name),
                totalReceived,
                approved,
                rejected,
                returned,
                totalProcessed,
                dailyInRate,
                dailyProcessed,
                avgResolutionHours
            }
        }))

        const activeKpis = kpis.filter(k => k.totalReceived > 0 || k.totalProcessed > 0)

        return { success: true, data: activeKpis }
    } catch (error) {
        console.error("getAllEmployeesKPIs Error:", error)
        return { success: false, error: "فشل في تحميل إحصائيات الموظفين" }
    }
}


export async function getAbsencesReportData() {
  try {
    const students = await db.users.findMany({
      where: {
        roles: {
          role_name: 'student'
        }
      },
      include: {
        departments_users_department_idTodepartments: {
          select: { dept_name: true }
        },
        levels: {
          select: { name: true }
        },
        current_term: {
          include: {
            subjects: true
          }
        },
        absences: {
          select: {
            subject_id: true,
            total_absences: true,
            excused_count: true
          }
        }
      }
    });

    const formattedData: any[] = [];

    students.forEach(student => {
      const baseInfo = {
        university_id: student.university_id || 'غير متوفر',
        full_name: student.full_name || 'غير متوفر',
        department: student.departments_users_department_idTodepartments?.dept_name || 'غير متوفر',
        level: student.levels?.name || 'غير متوفر',
        term: student.current_term?.name || 'غير متوفر',
      };

      if (!student.current_term || !student.current_term.subjects || student.current_term.subjects.length === 0) {
        // No subjects
        formattedData.push({
          ...baseInfo,
          subject: 'لا توجد مواد مسجلة',
          total_absences: 0,
          excused_count: 0,
          unexcused_count: 0
        });
      } else {
        // One row per subject
        student.current_term.subjects.forEach(sub => {
          const absenceRecord = student.absences.find(a => a.subject_id === sub.subject_id);
          const totalAbsences = absenceRecord?.total_absences || 0;
          const excusedCount = absenceRecord?.excused_count || 0;
          const unexcusedCount = Math.max(0, totalAbsences - excusedCount);

          formattedData.push({
            ...baseInfo,
            subject: sub.name,
            total_absences: totalAbsences,
            excused_count: excusedCount,
            unexcused_count: unexcusedCount
          });
        });
      }
    });

    return { success: true, data: formattedData };
  } catch (error) {
    console.error("Failed to get absences report", error);
    return { success: false, error: "فشل في جلب تقرير الإجازات والانصراف" };
  }
}
