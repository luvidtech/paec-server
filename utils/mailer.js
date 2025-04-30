import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: "basiljijiwork@gmail.com",
        pass: 'gczxfwtspdywcztg'
    },
    debug: true,
    logger: true
})

export const sendOtpEmail = async (to, otp) => {
    const mailOptions = {
        from: process.env.SMTP_GMAIL_USER,
        to,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It will expire in 10 minutes.`,
        html: `<p>Your OTP code is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`
    }

    try {
        await transporter.sendMail(mailOptions)
        console.log(`OTP email sent to ${to}`)
    } catch (error) {
        console.error('Error sending OTP email:', error)
        throw new Error('Could not send OTP email')
    }
}
