import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter: nodemailer.Transporter | null = null;
let testAccount: any = null;

export async function getMailerTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    console.log('Using custom SMTP configuration:', host);
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: { user, pass },
    });
  } else {
    console.log('No custom SMTP found. Generating Ethereal Test Account...');
    try {
      testAccount = await nodemailer.createTestAccount();
      console.log('Ethereal Account Generated:');
      console.log('User:', testAccount.user);
      console.log('Pass:', testAccount.pass);
      
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (error) {
      console.error('Failed to create Ethereal test account:', error);
      throw error;
    }
  }

  return transporter;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  fromName: string,
  fromEmail: string
): Promise<SendMailResult> {
  const activeTransporter = await getMailerTransporter();

  // Use Ethereal user email or custom SMTP sender
  const senderEmail = testAccount ? testAccount.user : (process.env.SMTP_USER || fromEmail);
  
  const info = await activeTransporter.sendMail({
    from: `"${fromName}" <${senderEmail}>`,
    to,
    subject,
    html: bodyHtml,
    text: bodyHtml.replace(/<[^>]*>/g, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  
  return {
    messageId: info.messageId,
    previewUrl,
  };
}
