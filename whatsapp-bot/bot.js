const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// ─── Config ──────────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [
    1  * 60 * 1000,   // 1st retry  → after 1 min
    5  * 60 * 1000,   // 2nd retry  → after 5 min
    15 * 60 * 1000,   // 3rd retry  → after 15 min
];
const RETRY_POLL_INTERVAL_MS = 2 * 60 * 1000; // Check failed messages every 2 min
// ─────────────────────────────────────────────────────────────────────────────

let isClientReady = false; // Track if WhatsApp client is ready

// Initialize WhatsApp Client
console.log('🚀 Starting WhatsApp Bot...');
const client = new Client({
    authStrategy: new LocalAuth(),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
        strict: false
    },
    puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--disable-extensions',
            '--disable-background-networking',
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 QR Code received – scan with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(' WhatsApp Client is ready!');
    isClientReady = true;
    testConnection();
});

client.on('authenticated', () => {
    console.log('🔐 AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error(' AUTHENTICATION FAILURE', msg);
    isClientReady = false;
});

client.on('disconnected', (reason) => {
    console.warn(' WhatsApp disconnected:', reason);
    isClientReady = false;
    console.log('🔄 Attempting to reinitialize...');
    setTimeout(() => {
        client.initialize();
    }, 5000);
});

client.initialize();

// ─── Firestore Connection Test ────────────────────────────────────────────────
async function testConnection() {
    try {
        console.log(`Testing Firestore connection for Project: ${serviceAccount.project_id}...`);
        const collections = await db.listCollections();
        console.log(' Connected to Firestore! Collections:', collections.map(c => c.id).join(', ') || '(Empty)');
        startListening();
        startRetryLoop();
    } catch (error) {
        console.error(' FATAL: Could not connect to Firestore.');
        console.error('Error details:', error.message);
    }
}

// ─── Core: Send a WhatsApp message ───────────────────────────────────────────
async function sendWhatsAppMessage(phone, message, mediaPath) {
    if (!isClientReady) {
        throw new Error('WhatsApp client is not ready');
    }

    // Normalize phone number: remove +, spaces, and leading zeros
    let formattedPhone = phone.toString().trim();
    formattedPhone = formattedPhone.replace(/^\+/, '');  // Remove leading +
    formattedPhone = formattedPhone.replace(/\s+/g, ''); // Remove spaces
    // Handle 00966... format → 966...
    if (formattedPhone.startsWith('00')) {
        formattedPhone = formattedPhone.substring(2);
    }

    const chatId = `${formattedPhone}@c.us`;
    console.log(`📱 Sending to chatId: ${chatId}`);

    if (mediaPath) {
        const fs = require('fs');
        if (fs.existsSync(mediaPath)) {
            try {
                const { MessageMedia } = require('whatsapp-web.js');
                const media = MessageMedia.fromFilePath(mediaPath);
                await client.sendMessage(chatId, media, { caption: message });
                return;
            } catch (mediaError) {
                console.error(` Media send failed for ${mediaPath}, falling back to text.`, mediaError.message);
                await client.sendMessage(chatId, message + "\n\n(عذراً، فشل إرسال الملف المرفق)");
                return;
            }
        } else {
            console.warn(` PDF file not found at path: ${mediaPath} – sending text only`);
        }
    }

    await client.sendMessage(chatId, message);
}

// ─── Process a single queue document ─────────────────────────────────────────
async function processQueueDoc(doc) {
    const data = doc.data();
    const retries = data.retries || 0;

    // Skip if already being processed or not pending
    if (data.status !== 'pending') {
        console.log(` Skipping doc ${doc.id} – status is '${data.status}'`);
        return;
    }

    console.log(`📤 Processing msg for ${data.phoneNumber} | Attempt ${retries + 1}/${MAX_RETRIES + 1}`);

    // Mark as 'processing' immediately to prevent duplicate processing (race condition fix)
    try {
        await doc.ref.update({ status: 'processing' });
    } catch (updateErr) {
        console.error(` Could not mark doc ${doc.id} as processing:`, updateErr.message);
        return; // Skip if we can't lock it
    }

    try {
        await sendWhatsAppMessage(data.phoneNumber, data.message, data.mediaPath);

        await doc.ref.update({
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            retries: retries
        });

        console.log(` Message sent to ${data.phoneNumber} | Retries used: ${retries}`);

    } catch (error) {
        console.error(` Failed to send to ${data.phoneNumber}:`, error.message);

        const newRetries = retries + 1;

        if (newRetries >= MAX_RETRIES) {
            // Permanently failed
            await doc.ref.update({
                status: 'permanently_failed',
                error: error.message,
                retries: newRetries,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.error(`🚫 Permanently failed for ${data.phoneNumber} after ${newRetries} retries.`);
        } else {
            // Schedule retry
            const delayMs = RETRY_DELAYS_MS[retries] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
            const retryAfter = new Date(Date.now() + delayMs);

            await doc.ref.update({
                status: 'failed',
                error: error.message,
                retries: newRetries,
                retryAfter: admin.firestore.Timestamp.fromDate(retryAfter),
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.warn(`⏳ Will retry msg for ${data.phoneNumber} at ${retryAfter.toLocaleTimeString()} (attempt ${newRetries}/${MAX_RETRIES})`);
        }
    }
}

// ─── Listener: New pending messages (real-time) ───────────────────────────────
function startListening() {
    console.log('👂 Listening for new pending messages...');

    db.collection('whatsapp_queue')
        .where('status', '==', 'pending')
        .onSnapshot(async snapshot => {
            try {
                const addedDocs = snapshot.docChanges()
                    .filter(change => change.type === 'added')
                    .map(change => change.doc);

                if (addedDocs.length === 0) return;

                console.log(`📬 ${addedDocs.length} new pending message(s) detected`);

                //  Process sequentially with for...of (correctly awaits each)
                for (const doc of addedDocs) {
                    await processQueueDoc(doc);
                }
            } catch (error) {
                console.error(' Firestore listener error during processing:', error);
            }
        }, error => {
            console.error(' Firestore listener error:', error);
        });
}

// ─── Retry Loop: Pick up failed messages whose retryAfter time has passed ────
function startRetryLoop() {
    console.log(`🔄 Retry loop started (checks every ${RETRY_POLL_INTERVAL_MS / 60000} min)`);

    setInterval(async () => {
        try {
            const now = admin.firestore.Timestamp.now();

            const snapshot = await db.collection('whatsapp_queue')
                .where('status', '==', 'failed')
                .where('retryAfter', '<=', now)
                .get();

            if (snapshot.empty) {
                console.log('🔄 Retry check: No failed messages ready to retry.');
                return;
            }

            console.log(`🔄 Found ${snapshot.size} message(s) ready for retry.`);

            //  Process sequentially, mark pending first to let the listener pick up
            for (const doc of snapshot.docs) {
                // Re-fetch to ensure status hasn't changed
                const freshDoc = await doc.ref.get();
                if (freshDoc.data().status !== 'failed') continue;

                // Set back to pending so the onSnapshot listener handles it
                await doc.ref.update({
                    status: 'pending',
                    retryAfter: admin.firestore.FieldValue.delete()
                });
                console.log(`🔄 Reset doc ${doc.id} to pending for retry`);
            }

        } catch (err) {
            console.error(' Retry loop error:', err.message);
        }
    }, RETRY_POLL_INTERVAL_MS);
}

