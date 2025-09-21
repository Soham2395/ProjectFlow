import nodemailer from 'nodemailer';

export type SendOtpParams = {
  to: string;
  code: string;
  expiresInMinutes?: number;
};

const otpHtml = (code: string, expiresInMinutes: number) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2>ProjectFlow Password Reset</h2>
    <p>Your one-time password (OTP) is:</p>
    <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; padding: 15px; background-color: #f5f5f5; text-align: center; border-radius: 4px;">
      ${code}
    </div>
    <p>This code will expire in ${expiresInMinutes} minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="font-size: 12px; color: #666;">This is an automated message, please do not reply.</p>
  </div>
`;

const otpText = (code: string, expiresInMinutes: number) => `
  ProjectFlow Password Reset
  ------------------------
  
  Your one-time password (OTP) is:
  
  ${code}
  
  This code will expire in ${expiresInMinutes} minutes.
  
  If you didn't request this, please ignore this email.
  
  ------------------------
  This is an automated message, please do not reply.
`;

// Create a transporter object for Gmail
const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be set in environment variables');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Only disable TLS certificate validation in development
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    // Debug mode in development
    debug: process.env.NODE_ENV !== 'production',
    // Connection timeout (in ms)
    connectionTimeout: 10000,
    // Greeting timeout (in ms)
    greetingTimeout: 5000
  });

  // Verify connection configuration
  transporter.verify((error) => {
    if (error) {
      console.error('SMTP Connection Error:', error);
    } else {
      console.log('SMTP Server is ready to take our messages');
    }
  });

  return transporter;
};

export async function sendOtpEmail({ to, code, expiresInMinutes = 10 }: SendOtpParams) {
  const from = process.env.EMAIL_FROM || 'ProjectFlow <no-reply@example.com>';
  
  // Log the environment and config
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Email From:', from);
  console.log('SMTP Host:', process.env.SMTP_HOST);
  
  // In development, log the OTP to console but still try to send the email
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EMAIL DEBUG] OTP for ${to}: ${code} (expires in ${expiresInMinutes}m)`);
    console.log('Attempting to send real email in development mode...');
  }

  // In production, send the actual email
  try {
    console.log('Creating transporter...');
    const transporter = createTransporter();
    const subject = 'ProjectFlow password reset code';
    const html = otpHtml(code, expiresInMinutes);
    const text = otpText(code, expiresInMinutes);

    console.log('Sending email...');
    console.log('From:', from);
    console.log('To:', to);
    
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    console.log('Email sent successfully:', info.messageId);
    return { 
      ok: true, 
      provider: 'smtp', 
      messageId: info.messageId 
    } as const;
    
  } catch (error: unknown) {
    console.error('Failed to send email with Nodemailer:');
    
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error occurred:', error);
    }
    
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('SMTP Response:', (error as any).response);
    }
    
    throw new Error('Failed to send email. Please try again later.');
  }
}
