const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendOtpEmail(toEmail, otp) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
    html: `<strong>Your OTP code is ${otp}</strong><br><br>This code will expire in 5 minutes.`,
  };

  try {
    await sgMail.send(msg);
    console.log(`OTP email sent to ${toEmail}`);
  } catch (error) {
    console.error('Error sending email:', error.response?.body || error.message);
    throw new Error('Failed to send OTP email');
  }
}

async function sendAgreementEmail(toEmail, data) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `You're invited to sign "${data.agreementName}"`,
    html: `
    <p>Hi ${data.name},</p>
    <p>You have been invited to sign an agreement titled <strong>${data.agreementName}</strong>.</p>
    <p><a href="${data.signUrl}">Click here to review and sign the agreement</a>.</p>
    <p>If the above link doesn't work, copy and paste this into your browser: <br/> ${data.signUrl}</p>
    ${data.fileUrl ? `<p>Preview the document: <a href="${data.fileUrl}">${data.fileUrl}</a></p>` : ""}
    <p>Best regards,<br/>The SignIt Team</p>
  `  };

  try {
    await sgMail.send(msg);
    console.log(`OTP email sent to ${toEmail}`);
  } catch (error) {
    console.error('Error sending email:', error.response?.body || error.message);
    throw new Error('Failed to send OTP email');
  }
}

module.exports = { sendOtpEmail, sendAgreementEmail };
