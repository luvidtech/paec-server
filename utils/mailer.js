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
        subject: 'Your One-Time Password (OTP) for GHD Forms',
        text: `Your OTP code is ${otp}. This code is valid for 10 minutes. Do not share it with anyone.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8f9fa; color: #333;">
                <h2 style="color: #0056b3;">GHD Forms - OTP Verification</h2>
                <p>Hello,</p>
                <p>Use the following One-Time Password (OTP) to verify your identity. This OTP is valid for <strong>10 minutes</strong>:</p>
                <div style="font-size: 24px; font-weight: bold; margin: 20px 0; background: #e9ecef; padding: 10px; display: inline-block; border-radius: 5px;">
                    ${otp}
                </div>
                <p>Please do not share this OTP with anyone for security reasons.</p>
                <p>If you did not request this, please ignore this email.</p>
                <hr style="margin-top: 30px;" />
                <p style="font-size: 12px; color: #666;">© ${new Date().getFullYear()} GHD Forms. All rights reserved.</p>
            </div>
        `
    }

    try {
        await transporter.sendMail(mailOptions)
        console.log(`OTP email sent to ${to}`)
    } catch (error) {
        console.error('Error sending OTP email:', error)
        throw new Error('Could not send OTP email')
    }
}
