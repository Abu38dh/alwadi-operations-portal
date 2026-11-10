import { firestore } from "./firebase-admin"

export async function queueWhatsAppMessage(phoneNumber: string, message: string, mediaPath?: string | null) {
    try {
        if (!phoneNumber) {
            console.warn("queueWhatsAppMessage: Missing phone number")
            return { success: false, error: "Missing phone number" }
        }

        // Add to Firestore collection
        const docRef = await firestore.collection('whatsapp_queue').add({
            phoneNumber,
            message,
            mediaPath: mediaPath || null,
            status: 'pending',
            createdAt: new Date(),
            retries: 0
        })

        console.log(`[Queue]  Successfully queued message ID: ${docRef.id} for ${phoneNumber}`)
        return { success: true, id: docRef.id }
    } catch (error) {
        console.error("Queue WhatsApp Error:", error)
        // Don't throw, just return fail so we don't break the main flow
        return { success: false, error: "Failed to queue message" }
    }
}

