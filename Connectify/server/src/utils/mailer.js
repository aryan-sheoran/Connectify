// utils/mailer.js
// Nodemailer transport for sending OTP verification emails.
// Configure SMTP credentials in your .env file:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM

const nodemailer = require('nodemailer');

// Create a reusable transporter using environment variables
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for port 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a 6-digit OTP verification email to the user.
 *
 * @param {string} to      - Recipient email address
 * @param {string} otp     - 6-digit OTP code
 * @param {string} name    - User's display name (from Google profile)
 */
const sendOtpEmail = async (to, otp, name = 'there') => {
  const mailOptions = {
    from:    process.env.EMAIL_FROM || `"Connectify" <${process.env.SMTP_USER}>`,
    to,
    subject: `${otp} is your Connectify verification code`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Connectify OTP</title>
      </head>
      <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0"
                     style="background:linear-gradient(135deg,#1a1a1a 0%,#0f0f0f 100%);
                            border-radius:12px;overflow:hidden;
                            box-shadow:0 10px 40px rgba(0,0,0,0.5);">

                <!-- Header -->
                <tr>
                  <td align="center"
                      style="padding:36px 40px 24px;
                             background:linear-gradient(135deg,#2a2a2a 0%,#1a1a1a 100%);
                             border-bottom:1px solid #333;">
                    <h1 style="margin:0;font-size:28px;color:#e0e0e0;letter-spacing:1px;">
                      Connectify
                    </h1>
                    <p style="margin:8px 0 0;color:#888;font-size:14px;">
                      Email Verification
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <p style="color:#b0b0b0;font-size:16px;margin:0 0 24px;">
                      Hi ${name},
                    </p>
                    <p style="color:#b0b0b0;font-size:15px;margin:0 0 32px;line-height:1.6;">
                      Use the verification code below to complete your sign-in. 
                      This code expires in <strong style="color:#e0e0e0;">10 minutes</strong>.
                    </p>

                    <!-- OTP Box -->
                    <div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;
                                padding:24px;text-align:center;margin-bottom:32px;">
                      <span style="font-size:48px;font-weight:700;letter-spacing:12px;
                                   color:#e0e0e0;font-family:monospace;">
                        ${otp}
                      </span>
                    </div>

                    <p style="color:#666;font-size:13px;margin:0;line-height:1.6;">
                      If you didn't request this code, you can safely ignore this email.
                      Someone may have typed your email address by mistake.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:24px 40px;border-top:1px solid #222;text-align:center;">
                    <p style="color:#555;font-size:12px;margin:0;">
                      © ${new Date().getFullYear()} Connectify. This is an automated email, please do not reply.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };
