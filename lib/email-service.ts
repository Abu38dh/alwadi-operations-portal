import nodemailer from 'nodemailer';

// Create a reusable transporter object using SMTP transport
// We configure this using environment variables.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports. usually false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends an email using the configured SMTP server.
 * 
 * @param to recipient email address
 * @param subject Email subject
 * @param text Plain text content of the email
 * @returns boolean indicating success or failure
 */
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  // If SMTP is not configured or recipient email is missing, we fail gracefully
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(" SMTP credentials are not configured in environment variables. Email will not be sent.");
    return false;
  }

  if (!to) {
     console.warn(" Attempted to send an email but recipient address is missing.");
     return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'شركة الوادي لقطع غيار السيارات'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text, // plain text body
      html: html || text, // Send HTML if provided, otherwise fallback to text
    });

    console.log(` Email sent successfully to ${to}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(` Failed to send email to ${to}:`, error);
    return false;
  }
}

