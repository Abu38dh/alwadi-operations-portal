import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { firestore } from "@/lib/firebase-admin"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    const session = await auth()
    
    if (!session || !session.user) {
        return new Response("Unauthorized", { status: 401 })
    }

    const universityId = (session.user as any).university_id
    const roleName = (session.user as any).role

    if (!universityId) {
        return new Response("Missing University ID", { status: 400 })
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                const message = `data: ${JSON.stringify(data)}\n\n`
                controller.enqueue(encoder.encode(message))
            }

            // Initial connection message
            controller.enqueue(encoder.encode("retry: 1000\n\n"))
            sendEvent({ type: 'connected', universityId })

            console.log(`[SSE] 🚀 Connection Established: ${universityId} (${roleName})`)

            // Heartbeat interval (more frequent in dev)
            const keepAlive = setInterval(async () => {
                controller.enqueue(encoder.encode(": keep-alive\n\n"))
                
                // In development, run the escalation check automatically in the background
                if (process.env.NODE_ENV === 'development') {
                    try {
                        const { performEscalationCheck } = await import("../cron/escalate/route")
                        await performEscalationCheck()
                    } catch (e) {
                        console.error("[SSE Dev Auto-Escalation Check] Failed:", e)
                    }
                }
            }, 10000)

            const unsubscribes: (() => void)[] = []

            try {
                console.log(`[SSE] 🔍 Monitoring Firestore for user_${universityId} and role_${roleName}`)
                
                // 1. Listen to user-specific signals
                const userUnsub = firestore.collection('signals').doc(`user_${universityId}`).onSnapshot((doc: any) => {
                    const data = doc.data()
                    if (doc.exists && data) {
                        console.log(`[SSE] 🔔 Signal for user_${universityId} triggered at ${new Date().toLocaleTimeString()}`)
                        sendEvent({ type: 'refresh', target: 'user', timestamp: data.last_update })
                    }
                })
                unsubscribes.push(userUnsub)

                // 2. Listen to role-specific signals
                if (roleName) {
                    const roleUnsub = firestore.collection('signals').doc(`role_${roleName}`).onSnapshot((doc: any) => {
                        const data = doc.data()
                        if (doc.exists && data) {
                            console.log(`[SSE] 🔔 Signal for role_${roleName} triggered at ${new Date().toLocaleTimeString()}`)
                            sendEvent({ type: 'refresh', target: 'role', timestamp: data.last_update })
                        }
                    })
                    unsubscribes.push(roleUnsub)
                }

                // Handle connection close
                req.signal.addEventListener("abort", () => {
                    clearInterval(keepAlive)
                    unsubscribes.forEach(unsub => unsub())
                    console.log(`[SSE] Client disconnected: ${universityId}`)
                    controller.close()
                })

            } catch (error) {
                console.error("[SSE] Error seting up listeners:", error)
                clearInterval(keepAlive)
                unsubscribes.forEach(unsub => unsub())
                controller.error(error)
            }
        }
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    })
}

