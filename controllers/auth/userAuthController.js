import User from "../../models/userModel.js"
import { generateToken } from "../../utils/generateToken.js"
import HttpError from "../../utils/httpErrorMiddleware.js"
import asyncHandler from "../../utils/asyncHandler.js"
import { sendOtpEmail } from "../../utils/mailer.js"

export const registerUser = asyncHandler(async (req, res, next) => {
    const { loginId, password, userName } = req.body

    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized to register a user", 403))
    }

    // Validate required fields
    if (!loginId || !password) {
        return next(new HttpError("Please provide email/phone and password", 400))
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)

    // Try to find existing user
    let user = isEmail
        ? await User.findOne({ email: loginId })
        : await User.findOne({ phone: loginId })

    // If user doesn't exist and username is provided, create new user

    if (!user && userName) {
        try {
            user = await User.create({
                userName,
                [isEmail ? 'email' : 'phone']: loginId,
                password,
                role: 'staff',
                isActive: true
            })
        } catch (error) {
            return next(new HttpError("Registration failed: " + error.message, 400))
        }
    } else if (user) {
        return next(new HttpError("User Already exists", 404))
    }

    // Generate token for successful login/registration
    generateToken(res, user._id)

    res.status(200).json({
        _id: user._id,
        name: user.userName,
        email: user.email,
        phone: user.phone,
        role: user.role,
    })
})

export const loginUser = asyncHandler(async (req, res, next) => {
    const { loginId, password } = req.body

    if (!loginId || !password) {
        return next(new HttpError("Please provide email/phone and password", 400))
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)

    const user = isEmail
        ? await User.findOne({ email: loginId })
        : await User.findOne({ phone: loginId })

    if (!user) {
        return next(new HttpError("User not found", 404))
    }

    const isPasswordMatch = await user.matchPassword(password)
    if (!isPasswordMatch) {
        return next(new HttpError("Invalid Username or Password", 401))
    }

    let role

    if (user.role === "admin") {
        generateAndSendOtp(user)

        return res.status(200).json({
            message: `OTP has been sent to your ${isEmail ? "email" : "phone"}.`,
        })
    } else if (user.role === "staff") {
        role = "staff"
    }
    generateToken(res, user._id)

    res.status(200).json({
        _id: user._id,
        name: user.userName,
        email: user.email,
        phone: user.phone,
        role: role,
    })
})

export const generateAndSendOtp = async (user) => {
    // Check if OTP is still valid and was sent within the last 60 seconds (1 minute)
    if (user.otp && user.otp.expiresIn > Date.now()) {
        // Calculate the remaining time in milliseconds
        const timeLeft = user.otp.expiresIn - Date.now()

        // If less than 60 seconds remain
        if (timeLeft < 60000) {
            // Convert remaining time to seconds
            const secondsLeft = Math.ceil(timeLeft / 1000)

            throw new HttpError(
                `OTP already sent. Please wait for ${secondsLeft} seconds before requesting a new one.`,
                403
            )
        }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    user.otp.otpCode = otp
    user.otp.expiresIn = Date.now() + 10 * 60 * 1000
    await user.save()

    try {
        await sendOtpEmail(user.email, otp)
    } catch (error) {
        console.error("Error sending OTP email:", error)
        throw new HttpError("Could not send OTP email", 500)
    }
}

export const logoutUser = asyncHandler(async (req, res) => {
    res.cookie("jwt", "", {
        httpOnly: true,
        expires: new Date(0),
    })

    res.status(200).json({ message: "Logged Out Successfully" })
})

export const verifyOtpUser = asyncHandler(async (req, res, next) => {
    const { loginId, otpCode } = req.body

    if (!loginId || !otpCode) {
        return next(
            new HttpError("Please provide both contact (email/phone) and OTP", 400)
        )
    }

    let user
    if (loginId.includes("@")) {
        user = await User.findOne({ email: loginId })
        console.log(User, "~!")
    } else {
        user = await User.findOne({ phone: loginId })
    }

    if (!user) {
        return next(new HttpError("User not found", 404))
    }

    if (
        !user.otp ||
        user.otp.otpCode !== otpCode ||
        user.otp.expiresIn < Date.now()
    ) {
        return next(new HttpError("Invalid or expired OTP", 400))
    }

    user.otp = { otpCode: null, expired: true, expiresIn: null }
    await user.save()

    generateToken(res, user._id)
    const data = {
        _id: user._id,
        name: user.userName,
        email: user.email,
        phone: user.phone,
        role: "user.role",
    }

    return res.json(data)
})

export const forgotPasswordUser = asyncHandler(async (req, res, next) => {
    const { loginId } = req.body

    if (!loginId) {
        return next(new HttpError("Login ID is required", 400))
    }

    // Check if `loginId` is an email or phone number
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)

    // Find the user based on `loginId`
    let user
    if (isEmail) {
        user = await User.findOne({ email: loginId })
    } else {
        // If the login ID is not an email, we assume it's a phone number and search for the user by phone
        user = await User.findOne({ phone: loginId })
    }

    // If the user is not found, return an error
    if (!user) {
        return next(new HttpError("Invalid credentials or user not found", 404))
    }

    // Send OTP to the user's registered email, regardless of whether the loginId is email or phone
    const recipientEmail = isEmail ? loginId : user.email
    await generateAndSendOtp(user, recipientEmail)

    res.status(200).json({
        message: `OTP has been sent to your ${isEmail ? "email" : "registered email"
            }. Please verify to continue.`,
    })
})