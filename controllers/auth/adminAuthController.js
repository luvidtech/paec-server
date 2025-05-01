import Admin from "../../models/adminModel.js"
import Owner from "../../models/adminModel.js"
import asyncHandler from "../../utils/asyncHandler.js"
import { generateToken } from "../../utils/generateToken.js"
import HttpError from "../../utils/httpErrorMiddleware.js"
import { sendOtpEmail } from "../../utils/mailer.js"

// @desc   Auth admin & get token
// @route  POST /api/admin/login
// @access Public
export const loginAdmin = asyncHandler(async (req, res, next) => {
    const { loginId, password } = req.body

    const isEmail = loginId.includes('@')
    const admin = isEmail
        ? await Admin.findOne({ email: loginId })
        : await Admin.findOne({ phone: loginId })

    if (admin && (await admin.matchPassword(password))) {
        await generateAndSendOtp(admin)

        return res.status(200).json({
            message: `OTP has been sent to your ${isEmail ? "email" : "phone"}. Please verify to continue.`,
        })
    } else {
        return next(new HttpError("Invalid credentials or owner not found", 404))
    }
})



export const generateAndSendOtp = async (admin) => {
    // Check if OTP is still valid and was sent within the last 60 seconds (1 minute)
    if (admin.otp && admin.otp.expiresIn > Date.now()) {
        // Calculate the remaining time in milliseconds
        const timeLeft = admin.otp.expiresIn - Date.now()

        // If less than 60 seconds remain
        if (timeLeft < 60000) {
            // Convert remaining time to seconds
            const secondsLeft = Math.ceil(timeLeft / 1000)

            throw new HttpError(`OTP already sent. Please wait for ${secondsLeft} seconds before requesting a new one.`, 403)
        }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    admin.otp.otpCode = otp
    admin.otp.expiresIn = Date.now() + 10 * 60 * 1000
    await admin.save()

    try {
        await sendOtpEmail(admin.email, otp)
    } catch (error) {
        throw new HttpError("Could not send OTP email", 500)
    }
}




export const verifyOtpAdmin = asyncHandler(async (req, res, next) => {
    const { loginId, otpCode } = req.body

    if (!loginId || !otpCode) {
        return next(new HttpError("Please provide both loginId (email/phone) and OTP", 400))
    }

    let admin
    if (loginId.includes('@')) {
        admin = await Admin.findOne({ email: loginId })
    } else {
        admin = await Admin.findOne({ phone: loginId })
    }

    if (!admin) {
        return next(new HttpError("User not found", 404))
    }

    // Validate OTP
    if (!admin.otp || admin.otp.otpCode !== otpCode || admin.otp.expiresIn < Date.now()) {
        return next(new HttpError("Invalid or expired OTP", 400))
    }

    // Clear OTP and mark as expired
    admin.otp = { otpCode: null, expired: true, expiresIn: null }
    await admin.save()

    generateToken(res, admin._id)

    return res.status(201).json({
        username: admin.userName,
        avatar: admin.profilePhoto,
        role: "admin"
    })
})



export const logoutAdmin = asyncHandler(async (req, res) => {
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0),
    })

    res.status(200).json({ message: 'Logged Out Successfully' })
})
