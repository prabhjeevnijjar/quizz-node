const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendOtpEmail(toEmail, otp) {
  const msg = {
    to: toEmail,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: "Your OTP Code",
    text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
    html: `<strong>Your OTP code is ${otp}</strong><br><br>This code will expire in 5 minutes.`,
  };

  try {
    await sgMail.send(msg);
    console.log(`OTP email sent to ${toEmail}`);
  } catch (error) {
    console.error(
      "Error sending email:",
      error.response?.body || error.message
    );
    throw new Error("Failed to send OTP email");
  }
}

module.exports = { sendOtpEmail };
