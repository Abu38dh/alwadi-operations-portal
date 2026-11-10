import { NextResponse } from 'next/server'
import { db } from "@/lib/db"
import { firestore } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export const dynamic = 'force-dynamic'

async function triggerSync(type: 'user' | 'role', id: string | number) {
    try {
        const docId = `${type}_${id}`
        await firestore.collection('signals').doc(docId).set({
            last_update: FieldValue.serverTimestamp()
        }, { merge: true })
        console.log(`[Realtime Sync] Triggered sync for ${docId}`)
    } catch (error) {
        console.error(`[Realtime Sync] Failed to trigger sync for ${type}_${id}:`, error)
    }
}

export async function performEscalationCheck() {
    console.log("Starting Auto-Escalation Check...")
    let escalatedCount = 0

    // 1. Fetch all pending/in_progress requests
    const activeRequests = await db.requests.findMany({
        where: {
            status: { in: ['pending', 'in_progress'] },
            current_step_id: { not: null },
            workflow_steps: process.env.NODE_ENV === 'development' ? {} : {
                sla_hours: { gt: 0 }
            }
        },
        include: {
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
            },
            request_actions: {
                orderBy: { created_at: 'desc' },
                take: 1
            },
            users: true,
            form_templates: true
        }
    })

    const now = new Date()

    for (const req of activeRequests) {
        const currentStep = req.workflow_steps
        if (!currentStep) continue
        if (process.env.NODE_ENV !== 'development' && !currentStep.sla_hours) continue

        // 2. Calculate elapsed time
        let startTime = req.submitted_at || now
        if (req.request_actions && req.request_actions.length > 0) {
            startTime = req.request_actions[0].created_at || startTime
        }

        const elapsedMs = now.getTime() - startTime.getTime()
        const elapsedHours = elapsedMs / (1000 * 60 * 60)

        // 3. Check SLA breach
        const isBreached = elapsedHours >= (currentStep.sla_hours || 0)

        if (isBreached) {
            let nextStepId: number | null = null
            let escalationType = ""
            
            const shouldEscalateToNext = currentStep.escalate_to_next || (process.env.NODE_ENV === 'development' && !currentStep.escalation_user_id && !currentStep.escalation_role_id)

            if (shouldEscalateToNext && currentStep.workflows) {
                const allSteps = currentStep.workflows.workflow_steps
                const currentIndex = allSteps.findIndex(s => s.step_id === currentStep.step_id)
                
                if (currentIndex !== -1 && currentIndex + 1 < allSteps.length) {
                    nextStepId = allSteps[currentIndex + 1].step_id
                    escalationType = "next_step"
                } else {
                    continue
                }
            } else if (currentStep.escalation_user_id || currentStep.escalation_role_id) {
                const newStep = await db.workflow_steps.create({
                    data: {
                        workflow_id: null,
                        name: (currentStep.name || "الخطوة") + " (تصعيد)",
                        order: currentStep.order,
                        approver_role_id: currentStep.escalation_role_id,
                        approver_user_id: currentStep.escalation_user_id,
                        sla_hours: null,
                        is_final: currentStep.is_final,
                        escalate_to_next: false
                    }
                })
                nextStepId = newStep.step_id
                escalationType = currentStep.escalation_user_id ? "user" : "role"
            }

            if (nextStepId) {
                // Perform the escalation
                await db.$transaction(async (tx) => {
                    await tx.requests.update({
                        where: { request_id: req.request_id },
                        data: {
                            current_step_id: nextStepId,
                            status: 'pending'
                        }
                    })

                    await tx.request_actions.create({
                        data: {
                            request_id: req.request_id,
                            actor_id: req.requester_id,
                            action: 'escalate',
                            comment: "تم التصعيد الآلي بسبب تأخر الرد وتجاوز الوقت المحدد.",
                            step_id: currentStep.step_id
                        }
                    })
                })
                
                escalatedCount++
                
                // Realtime Sync Triggers
                try {
                    // 1. Notify Requester (student)
                    if (req.users?.university_id) {
                        await triggerSync('user', req.users.university_id)
                    }

                    // 2. Notify Old Approver
                    if (currentStep.approver_role_id) {
                        const role = await db.roles.findUnique({ where: { role_id: currentStep.approver_role_id } })
                        if (role) await triggerSync('role', role.role_name)
                    } else if (currentStep.approver_user_id) {
                        const user = await db.users.findUnique({ where: { user_id: currentStep.approver_user_id } })
                        if (user) await triggerSync('user', user.university_id)
                    }

                    // 3. Notify New Approver
                    const nextStepObj = await db.workflow_steps.findUnique({ where: { step_id: nextStepId } })
                    if (nextStepObj) {
                        if (nextStepObj.approver_role_id) {
                            const role = await db.roles.findUnique({ where: { role_id: nextStepObj.approver_role_id } })
                            if (role) await triggerSync('role', role.role_name)
                        } else if (nextStepObj.approver_user_id) {
                            const user = await db.users.findUnique({ where: { user_id: nextStepObj.approver_user_id } })
                            if (user) await triggerSync('user', user.university_id)
                        }
                    }
                } catch (e) {
                    console.error("Realtime sync during escalation failed:", e)
                }
            }
        }
    }

    // 4. Auto-reject returned requests older than 30 days
    let rejectedCount = 0
    const returnedRequests = await db.requests.findMany({
        where: { status: 'returned' },
        include: {
            request_actions: {
                orderBy: { created_at: 'desc' },
                take: 1
            }
        }
    })

    for (const req of returnedRequests) {
        let lastActionTime = req.submitted_at || now
        if (req.request_actions && req.request_actions.length > 0) {
            lastActionTime = req.request_actions[0].created_at || lastActionTime
        }

        const elapsedMs = now.getTime() - lastActionTime.getTime()
        const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24)

        if (elapsedDays >= 30) {
            await db.$transaction(async (tx) => {
                await tx.requests.update({
                    where: { request_id: req.request_id },
                    data: { status: 'rejected' }
                })

                await tx.request_actions.create({
                    data: {
                        request_id: req.request_id,
                        actor_id: req.requester_id,
                        action: 'reject',
                        comment: "تم رفض الطلب آلياً بسبب إعادته للتعديل وعدم التجاوب بتعديله خلال مدة تجاوزت 30 يوماً.",
                        step_id: req.current_step_id
                    }
                })
            })
            rejectedCount++
        }
    }

    return { escalated: escalatedCount, rejected: rejectedCount }
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const key = url.searchParams.get("key") || request.headers.get("Authorization")?.replace("Bearer ", "")

        // Verify Secret Key (Allow bypass in development)
        const isDev = process.env.NODE_ENV === 'development'
        if (!isDev && key !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const result = await performEscalationCheck()
        
        return NextResponse.json({ 
            success: true, 
            message: `Escalation check complete. Escalated ${result.escalated} requests. Auto-Rejected ${result.rejected} returned requests.`,
            escalated: result.escalated,
            rejected: result.rejected
        })

    } catch (error: any) {
        console.error("Auto-Escalation Error:", error)
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
    }
}
