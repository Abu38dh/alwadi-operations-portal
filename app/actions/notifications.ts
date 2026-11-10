"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { queueWhatsAppMessage } from "@/lib/whatsapp-queue"
import { sendEmail } from "@/lib/email-service"
import fs from 'fs'
import path from 'path'
import { firestore } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

/**
 * Get user notifications
 */
export async function getUserNotifications(userId: string, limit: number = 20) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: userId }
        })

        if (!user) {
            return { success: false, error: "المستخدم غير موجود" }
        }

        const notifications = await db.notifications.findMany({
            where: { user_id: user.user_id },
            orderBy: { created_at: 'desc' },
            take: limit
        })

        return {
            success: true,
            data: notifications
        }
    } catch (error) {
        console.error("Get Notifications Error:", error)
        return { success: false, error: "فشل في تحميل الإشعارات" }
    }
}

/**
 * Trigger a real-time sync signal in Firestore
 */
async function triggerSync(type: 'user' | 'role', id: string | number) {
    try {
        const docId = `${type}_${id}`
        // Fire-and-forget: Do not await Firestore write to avoid blocking server action response
        firestore.collection('signals').doc(docId).set({
            last_update: FieldValue.serverTimestamp()
        }, { merge: true }).catch((error: any) => {
            console.error(`[Realtime] Failed to trigger sync for ${type}_${id}:`, error)
        })
    } catch (error) {
        console.error(`[Realtime] Failed to trigger sync for ${type}_${id}:`, error)
    }
}

/**
 * Trigger sync for all users in a specific role
 */
async function triggerRoleSync(roleId: number) {
    try {
        const role = await db.roles.findUnique({ where: { role_id: roleId } })
        if (role) {
            await triggerSync('role', role.role_name)
        }
    } catch (error) {
        console.error(`[Realtime] Failed to trigger role sync for ${roleId}:`, error)
    }
}

/**
 * Create notification for a user
 */
export async function createNotification(data: {
    userId: string
    title: string
    message: string
    link?: string
}) {
    try {
        const user = await db.users.findUnique({
            where: { university_id: data.userId }
        })

        if (!user) {
            return { success: false, error: "المستخدم غير موجود" }
        }

        const notification = await db.notifications.create({
            data: {
                user_id: user.user_id,
                title: data.title,
                message: data.message,
                link: data.link || null
            }
        })

        // Trigger Real-time Sync
        await triggerSync('user', user.university_id)

        // revalidatePath('/')
        return { success: true, data: notification }
    } catch (error) {
        console.error("Create Notification Error:", error)
        return { success: false, error: "فشل في إنشاء الإشعار" }
    }
}

/**
 * Create notification for multiple users
 */
export async function createBulkNotifications(data: {
    userIds: string[]
    title: string
    message: string
    link?: string
}) {
    try {
        const users = await db.users.findMany({
            where: {
                university_id: { in: data.userIds }
            }
        })

        if (users.length === 0) {
            return { success: false, error: "لم يتم العثور على مستخدمين" }
        }

        await db.notifications.createMany({
            data: users.map(user => ({
                user_id: user.user_id,
                title: data.title,
                message: data.message,
                link: data.link || null
            }))
        })

        // Trigger Real-time Sync for each user
        await Promise.all(users.map(u => triggerSync('user', u.university_id)))

        // revalidatePath('/')
        return { success: true }
    } catch (error) {
        console.error("Create Bulk Notifications Error:", error)
        return { success: false, error: "فشل في إنشاء الإشعارات" }
    }
}

/**
 * Helper: Notify request submitter about status change
 */
export async function notifyRequestStatusChange(
    requestId: number,
    newStatus: string,
    actorName: string
) {
    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        const request = await db.requests.findUnique({
            where: { request_id: requestId },
            include: {
                users: {
                    include: {
                        departments_users_department_idTodepartments: {
                            include: { colleges: true }
                        }
                    }
                },
                form_templates: true
            }
        })

        if (!request) return { success: false }

        const statusMessages: Record<string, string> = {
            approved: `تمت الموافقة على طلبك رقم ${request.reference_no} بواسطة ${actorName}`,
            rejected: `تم رفض طلبك رقم ${request.reference_no} بواسطة ${actorName}`,
            pending: `طلبك رقم ${request.reference_no} قيد المراجعة`,
            in_progress: `طلبك رقم ${request.reference_no} قيد التنفيذ`,
            returned: `تم إعادة طلبك رقم ${request.reference_no} للتعديل بواسطة ${actorName}`
        }



        await createNotification({
            userId: request.users.university_id,
            title: "تحديث حالة الطلب",
            message: statusMessages[newStatus] || `تم تحديث طلبك رقم ${request.reference_no}`,
            link: `/requests/${request.request_id}`
        })

        // Trigger Real-time Sync for requester
        await triggerSync('user', request.users.university_id);

        // Run slow third-party integrations (WhatsApp, SMTP Email, PDF compilation) in the background
        // so that the server action can finish and return a response immediately.
        (async () => {
            try {
                // WhatsApp Integration (Queue) - Approved
                if (newStatus === 'approved' && request.users.phone) {
                     let pdfPath = null;
                     const generateDoc = request.form_templates?.generate_document !== false;
                     
                     // Generate PDF if template exists and generation is enabled
                     if (generateDoc && request.form_templates?.pdf_template) {
                        try {
                            const template = request.form_templates.pdf_template;
                            // Replace variables
                            const data = {
                                StudentName: request.users.full_name,
                                UniversityID: request.users.university_id,
                                RequestID: request.reference_no,
                                RequestDate: new Date(request.submitted_at || new Date()).toLocaleDateString('ar-SA'),
                                RequestType: request.form_templates.name,
                                College: request.users.departments_users_department_idTodepartments?.colleges?.name || "---",
                                Department: request.users.departments_users_department_idTodepartments?.dept_name || "---"
                            };

                            let content = template;
                            Object.keys(data).forEach(key => {
                                const regex = new RegExp(`{${key}}`, 'gi');
                                // @ts-ignore
                                content = content.replace(regex, data[key]);
                            });

                            // Helper to get Base64 Logo
                            let logoSrc = "";
                            try {
                                const logoPath = path.join(process.cwd(), 'public', 'Layer-11.png');
                                if (fs.existsSync(logoPath)) {
                                    const logoBase64 = fs.readFileSync(logoPath).toString('base64');
                                    logoSrc = `data:image/png;base64,${logoBase64}`;
                                }
                            } catch (e) { console.error("Logo load failed", e); }

                            // Improved Header with Table (Better for PDF)
                            const headerHtml = `
                                <table style="width: 100%; border-bottom: 4px solid #C69214; padding-bottom: 10px; margin-bottom: 30px; font-family: 'Cairo', sans-serif;">
                                    <tr>
                                        <td style="text-align: right; width: 35%; vertical-align: top;">
                                            <div style="font-weight: bold; font-size: 15pt; color: #0B2545; margin-bottom: 4px;">شركة الوادي لقطع غيار السيارات</div>
                                            <div style="font-size: 11pt; color: #334155; line-height: 1.4;">إدارة العمليات والموارد البشرية</div>
                                            <div style="font-size: 11pt; color: #64748b; line-height: 1.4;">نظام إدارة المعاملات الموحد</div>
                                        </td>
                                        <td style="text-align: center; width: 30%; vertical-align: middle;">
                                            ${logoSrc ? `<img src="${logoSrc}" style="width: 120px; height: auto;" />` : ''}
                                        </td>
                                        <td style="text-align: left; width: 35%; vertical-align: top; direction: ltr;">
                                            <div style="font-weight: bold; font-size: 14pt; color: #0B2545; margin-bottom: 4px;">AL WADI AUTO SPARE PARTS CO.</div>
                                            <div style="font-size: 11pt; color: #334155; line-height: 1.4;">Operations & HR Department</div>
                                            <div style="font-size: 11pt; color: #64748b; line-height: 1.4;">Process Management System</div>
                                        </td>
                                    </tr>
                                </table>
                            `;

                            // Footer with Signature placeholders
                            const footerHtml = `
                                <div style="margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid;">
                                    <div style="text-align: center; width: 40%;">
                                        <div style="font-weight: bold; margin-bottom: 60px;">المسؤول المختص</div>
                                          <div>...........................</div>
                                    </div>
                                    <div style="text-align: center; width: 40%;">
                                        <div style="font-weight: bold; margin-bottom: 60px;">المدير العام / الاعتماد</div>
                                        <div>...........................</div>
                                    </div>
                                </div>
                                <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 10pt; color: #64748b;">
                                    وثيقة رسمية صادرة من نظام المعاملات - شركة الوادي لقطع غيار السيارات
                                    <br/>
                                    الرقم المرجعي: ${request.reference_no} | التاريخ: ${new Date().toLocaleDateString('ar-SA')}
                                </div>
                            `;

                            // Combined HTML with Container
                            const html = `
                                <div style="width: 100%; max-width: 210mm; margin: 0 auto; padding: 40px; box-sizing: border-box;">
                                    ${headerHtml}
                                    
                                    <div style="text-align: center; margin-bottom: 30px;">
                                        <h1 style="font-size: 24pt; font-weight: bold; text-decoration: underline; text-underline-offset: 8px;">قرار إداري / إفادة</h1>
                                    </div>

                                    <div style="font-size: 14pt; line-height: 2; text-align: justify; min-height: 200px;">
                                        ${content}
                                    </div>

                                    ${footerHtml}
                                </div>
                            `;

                            // Generate
                            const { generatePdfServer } = await import('@/lib/server-pdf-generator');
                            const pdfBuffer = await generatePdfServer({ htmlContent: html });

                            // Save to public/uploads/generated-pdfs
                            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'generated-pdfs');
                            if (!fs.existsSync(uploadDir)) {
                                fs.mkdirSync(uploadDir, { recursive: true });
                            }
                            const fileName = `Decision-${request.reference_no}.pdf`;
                            const filePath = path.join(uploadDir, fileName);
                            fs.writeFileSync(filePath, pdfBuffer);

                            pdfPath = filePath;

                        } catch (err) {
                            console.error("Failed to generate PDF for WhatsApp:", err);
                        }
                     }

                     const requestLink = `${appUrl}/requests/${request.request_id}`;
                     const wapMessage = generateDoc
                         ? `*شركة الوادي - نظام المعاملات*\n\nعزيزي الزميل/ة ${request.users.full_name}،\n\nتمت *الموافقة* على طلبك رقم *${request.reference_no}* (${request.form_templates?.name}).\n\nتجدون مرفقاً نسخة من القرار والاعتماد الرسمي.\n\nرابط الطلب: ${requestLink}`
                         : `*شركة الوادي - نظام المعاملات*\n\nعزيزي الزميل/ة ${request.users.full_name}،\n\nتمت *الموافقة* على طلبك رقم *${request.reference_no}* (${request.form_templates?.name}).\n\nرابط الطلب: ${requestLink}`;
                     
                     // Pass pdfPath to queue (can be null if generateDoc is false)
                     await queueWhatsAppMessage(request.users.phone, wapMessage, pdfPath)
                }
                
                // Email Notification - Approved
                if (newStatus === 'approved') {
                     const userEmail = (request.users as any).email;
                     if (userEmail) {
                        const generateDoc = request.form_templates?.generate_document !== false;
                        const requestLink = `${appUrl}/requests/${request.request_id}`;
                        const emailSubject = `تمت الموافقة على طلبك رقم ${request.reference_no}`;
                        const emailText = generateDoc
                            ? `عزيزي الزميل/ة ${request.users.full_name}،\n\nنود إبلاغك بأنه تمت الموافقة على طلبك رقم ${request.reference_no} (${request.form_templates?.name}).\n\nيمكنك متابعة وتنزيل وثيقة القرار الرسمي وتفاصيل الطلب من خلال الرابط التالي:\n${requestLink}\n\nمع تحيات،\nشركة الوادي لقطع غيار السيارات`
                            : `عزيزي الزميل/ة ${request.users.full_name}،\n\nنود إبلاغك بأنه تمت الموافقة على طلبك رقم ${request.reference_no} (${request.form_templates?.name}).\n\nيمكنك متابعة تفاصيل الطلب من خلال الرابط التالي:\n${requestLink}\n\nمع تحيات،\nشركة الوادي لقطع غيار السيارات`;
                        const emailHtml = `
                        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; text-align: right; margin: 20px;">
                            <p>عزيزي الزميل/ة <strong>${request.users.full_name}</strong>،</p>
                            <p>نود إبلاغك بأنه تمت <strong>الموافقة</strong> على طلبك رقم <strong>${request.reference_no}</strong> (${request.form_templates?.name}).</p>
                            ${generateDoc
                                ? `<p>يمكنك الدخول للنظام لمتابعة وتنزيل وثيقة الاعتماد وتفاصيل الطلب:</p>`
                                : `<p>يمكنك الدخول للنظام لمتابعة تفاصيل الطلب:</p>`}
                            <p style="margin: 20px 0;"><a href="${requestLink}" style="display: inline-block; padding: 10px 20px; background-color: #0B2545; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">${generateDoc ? 'عرض الاعتماد وتفاصيل الطلب' : 'عرض تفاصيل الطلب'}</a></p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                            <p style="color: #666; font-size: 14px;">مع تحيات،<br/><strong>شركة الوادي لقطع غيار السيارات</strong></p>
                        </div>
                        `;
                        await sendEmail(userEmail, emailSubject, emailText, emailHtml);
                     }
                }

                // WhatsApp Integration (Queue) - Returned for Modification
                if (newStatus === 'returned' && request.users.phone) {
                    // Fetch the last action to get the comment
                    const lastAction = await db.request_actions.findFirst({
                        where: { request_id: requestId },
                        orderBy: { created_at: 'desc' }
                    });
                    const comment = lastAction?.comment || "لا توجد ملاحظات إضافية";

                    const wapMessage = `*شركة الوادي - نظام المعاملات*\n\nعزيزي الزميل/ة ${request.users.full_name}،\n\nتم *إعادة* طلبك رقم *${request.reference_no}* للتعديل.\n\n📝 *الملاحظات:*\n${comment}\n\nيرجى الدخول للموقع لتعديل الطلب وإعادة إرساله.\n\nرابط الموقع: ${appUrl}`

                    await queueWhatsAppMessage(request.users.phone, wapMessage)
                }
                
                // Email Notification - Returned for Modification
                if (newStatus === 'returned') {
                    const userEmail = (request.users as any).email;
                    if (userEmail) {
                        // Fetch the last action to get the comment
                        const lastAction = await db.request_actions.findFirst({
                            where: { request_id: requestId },
                            orderBy: { created_at: 'desc' }
                        });
                        const comment = lastAction?.comment || "لا توجد ملاحظات إضافية";
                        const emailSubject = `إعادة طلبك رقم ${request.reference_no} للتعديل`;
                        const emailText = `عزيزي الزميل/ة ${request.users.full_name}،\n\nتبين لنا أن طلبك رقم ${request.reference_no} (${request.form_templates?.name}) بحاجة لبعض التعديلات قبل اعتماده.\n\nالملاحظات من الإدارة / المسؤول المختص:\n${comment}\n\nيرجى الدخول للنظام وإجراء التعديلات المطلوبة لإعادة التقديم.\nرابط الموقع: ${appUrl}\n\nمع تحيات،\nشركة الوادي لقطع غيار السيارات`;
                        const emailHtml = `
                        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; text-align: right; margin: 20px;">
                            <p>عزيزي الزميل/ة <strong>${request.users.full_name}</strong>،</p>
                            <p>تبين لنا أن طلبك رقم <strong>${request.reference_no}</strong> (${request.form_templates?.name}) بحاجة لبعض التعديلات قبل اعتماده.</p>
                            <div style="background-color: #fff7ed; border-right: 4px solid #C69214; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin-top: 0; font-weight: bold; color: #9A7B1C;">الملاحظات من الإدارة / المسؤول المختص:</p>
                                <p style="margin-bottom: 0; white-space: pre-wrap;">${comment}</p>
                            </div>
                            <p>يرجى الدخول للنظام وإجراء التعديلات المطلوبة لإعادة التقديم:</p>
                            <p style="margin: 20px 0;"><a href="${appUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0B2545; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">تعديل الطلب</a></p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                            <p style="color: #666; font-size: 14px;">مع تحيات،<br/><strong>شركة الوادي لقطع غيار السيارات</strong></p>
                        </div>
                        `;
                        await sendEmail(userEmail, emailSubject, emailText, emailHtml);
                    }
                }

                // WhatsApp Integration (Queue) - Rejected
                if (newStatus === 'rejected' && request.users.phone) {
                    // Fetch the last action to get the rejection reason
                    const lastAction = await db.request_actions.findFirst({
                        where: { request_id: requestId },
                        orderBy: { created_at: 'desc' }
                    });
                    const reason = lastAction?.comment || "لا يوجد سبب محدد";

                    const wapMessage = `*شركة الوادي - نظام المعاملات*\n\nعزيزي الزميل/ة ${request.users.full_name}،\n\nنأسف لإبلاغك بأنه تعذر اعتماد طلبك رقم *${request.reference_no}* (${request.form_templates?.name}).\n\n*السبب:*\n${reason}\n\nيمكنك التواصل مع الإدارة المختصة للاستفسار.\n\nرابط الموقع: ${appUrl}`

                    await queueWhatsAppMessage(request.users.phone, wapMessage)
                }
                
                // Email Notification - Rejected
                if (newStatus === 'rejected') {
                    const userEmail = (request.users as any).email;
                    if (userEmail) {
                        // Fetch the last action to get the rejection reason
                        const lastAction = await db.request_actions.findFirst({
                            where: { request_id: requestId },
                            orderBy: { created_at: 'desc' }
                        });
                        const reason = lastAction?.comment || "لا يوجد سبب محدد";
                        const emailSubject = `إشعار بخصوص طلبك رقم ${request.reference_no}`;
                        const emailText = `عزيزي الزميل/ة ${request.users.full_name}،\n\nنود إبلاغك بأنه تعذر اعتماد طلبك رقم ${request.reference_no} (${request.form_templates?.name}).\n\nالسبب الموضح من الإدارة المختصة:\n${reason}\n\nللتفاصيل، يمكنك التواصل مع إدارة الموارد البشرية أو زيارة الرابط أدناه:\n${appUrl}\n\nمع تحيات،\nشركة الوادي لقطع غيار السيارات`;
                        const emailHtml = `
                        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; text-align: right; margin: 20px;">
                            <p>عزيزي الزميل/ة <strong>${request.users.full_name}</strong>،</p>
                            <p>نود إبلاغك بأنه تعذر اعتماد طلبك رقم <strong>${request.reference_no}</strong> (${request.form_templates?.name}).</p>
                            <div style="background-color: #fef2f2; border-right: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin-top: 0; font-weight: bold; color: #b91c1c;">السبب الموضح من الإدارة المختصة:</p>
                                <p style="margin-bottom: 0; white-space: pre-wrap;">${reason}</p>
                            </div>
                            <p>للتفاصيل، يمكنك التواصل مع إدارة الموارد البشرية أو الدخول للنظام:</p>
                            <p style="margin: 20px 0;"><a href="${appUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0B2545; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">الدخول للنظام</a></p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                            <p style="color: #666; font-size: 14px;">مع تحيات،<br/><strong>شركة الوادي لقطع غيار السيارات</strong></p>
                        </div>
                        `;
                        await sendEmail(userEmail, emailSubject, emailText, emailHtml);
                    }
                }
            } catch (bgErr) {
                console.error("Background notifications processing failed:", bgErr);
            }
        })();

        return { success: true }
    } catch (error) {
        console.error("Notify Request Status Error:", error)
        return { success: false }
    }
}

/**
 * Helper: Notify approver about new request
 */
export async function notifyApproverNewRequest(
    approverRoleId: number,
    requestId: number,
    requestType: string,
    requesterName: string
) {
    try {
        // Get all users with this role
        const approvers = await db.users.findMany({
            where: {
                role_id: approverRoleId,
                is_active: true
            }
        })

        if (approvers.length === 0) return { success: false }

        // Trigger Real-time Sync for the entire role
        await triggerRoleSync(approverRoleId)

        const request = await db.requests.findUnique({
            where: { request_id: requestId },
            select: { reference_no: true }
        })

        if (!request) return { success: false }

        await createBulkNotifications({
            userIds: approvers.map(a => a.university_id),
            title: "طلب جديد للمراجعة",
            message: `طلب ${requestType} جديد من ${requesterName} - رقم المرجع: ${request.reference_no}`,
            link: `/requests/${requestId}`
        })

        return { success: true }
    } catch (error) {
        console.error("Notify Approver Error:", error)
        return { success: false }
    }
}

/**
 * Helper: Notify specific user approver about new request
 */
export async function notifyUserApproverNewRequest(
    approverUserId: number,
    requestId: number,
    requestType: string,
    requesterName: string
) {
    try {
        const approver = await db.users.findUnique({
            where: { user_id: approverUserId }
        })

        if (!approver) return { success: false }

        const request = await db.requests.findUnique({
            where: { request_id: requestId },
            select: { reference_no: true }
        })

        if (!request) return { success: false }

        await createNotification({
            userId: approver.university_id,
            title: "طلب جديد للمراجعة",
            message: `طلب ${requestType} جديد من ${requesterName} - رقم المرجع: ${request.reference_no}`,
            link: `/requests/${requestId}`
        })

        return { success: true }
    } catch (error) {
        console.error("Notify User Approver Error:", error)
        return { success: false }
    }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number) {
    try {
        await db.notifications.update({
            where: { notification_id: notificationId },
            data: { is_read: true }
        })
        return { success: true }
    } catch (error) {
        console.error("Mark Notification Read Error:", error)
        return { success: false }
    }
}


