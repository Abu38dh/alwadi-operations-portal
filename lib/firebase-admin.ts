import "server-only"
import admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        // 1. Try environment variable (Vercel/Cloud)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            })
        } 
        // 2. Try local file (Development)
        else {
            const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json')
            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                })
                console.log(`[Firebase Admin] Initialized with LOCAL FILE. Project ID: ${serviceAccount.project_id}`)
            } else {
                // 3. Fallback to default
                admin.initializeApp({
                    credential: admin.credential.applicationDefault()
                })
                console.log('[Firebase Admin] Initialized with DEFAULT CREDENTIALS')
            }
        }
    } catch (error) {
        console.error("Firebase Admin Init Error:", error)
    }
}

// Export firestore, but handle case where init failed to avoid hard crash on module load
export const firestore = admin.apps.length ? admin.firestore() : {
    collection: () => ({
        add: async () => { throw new Error("Firebase Admin not initialized") }
    })
} as any

