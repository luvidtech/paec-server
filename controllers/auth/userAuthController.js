import User from "../../models/userModel.js"
import { generateToken } from "../../utils/generateToken.js"
import HttpError from "../../utils/httpErrorMiddleware.js"
import asyncHandler from "../../utils/asyncHandler.js"
import { sendOtpEmail } from "../../utils/mailer.js"
import newLog from "../../utils/newlog.js"
import Center from "../../models/centreModel.js"

export const registerUser = asyncHandler(async (req, res, next) => {
    const { loginId, password, userName, accessTo, center } = req.body

    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin && !req.user._id) {
        return next(new HttpError("You are not authorized", 403))
    }

    if (!loginId || !password) {
        return next(new HttpError("Please provide email/phone and password", 400))
    }

    if (center) {
        const centerExists = await Center.findOne({ _id: center, 'isDeleted.status': false })
        if (!centerExists) {
            return next(new HttpError("Provided center does not exist", 404))
        }
    }

    if (Array.isArray(accessTo) && accessTo.length > 0) {
        const centers = await Center.find({ _id: { $in: accessTo }, 'isDeleted.status': false })

        if (centers.length !== accessTo.length) {
            return next(new HttpError("One or more centers in accessTo do not exist", 404))
        }
    }


    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)

    let user = isEmail
        ? await User.findOne({ email: loginId, 'isDeleted.status': false })
        : await User.findOne({ phone: loginId, 'isDeleted.status': false })


    if (!user && userName) {
        try {
            user = await User.create({
                userName,
                [isEmail ? 'email' : 'phone']: loginId,
                password,
                role: 'staff',
                isActive: true,
                accessTo,
                center
            })

            const populatedUser = await user.populate('center', 'centerName')

            await newLog({
                user: user._id,
                action: 'created',
                module: 'user',
                modifiedData: {
                    user: user.userName,
                    center: populatedUser.center?.centerName,
                }
            })

            res.status(200).json({
                _id: user._id,
                name: user.userName,
                email: user.email,
                phone: user.phone,
                role: user.role,
            })

        } catch (error) {
            return next(new HttpError("Registration failed: " + error.message, 400))
        }
    } else if (user) {
        return next(new HttpError("User Already exists", 404))
    }


})

export const getUsersByCenter = asyncHandler(async (req, res, next) => {

    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized to register a user", 403))
    }

    const users = await User.find({
        center: req.params.id,
        role: 'staff',
        'isDeleted.status': false
    }).select('userName email phone').populate('center', 'centerName centerCode')

    if (!users || users.length === 0) {
        return res.status(404).json({ message: "No users found for this center" })
    }

    res.status(200).json(users)
})


export const loginUser = asyncHandler(async (req, res, next) => {
    const { loginId, password } = req.body

    if (!loginId || !password) {
        return next(new HttpError("Please provide email/phone and password", 400))
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)

    const user = isEmail
        ? await User.findOne({ email: loginId, 'isDeleted.status': false })
        : await User.findOne({ phone: loginId, 'isDeleted.status': false })

    if (!user) {
        return next(new HttpError("User not found", 404))
    }

    const isPasswordMatch = await user.matchPassword(password)
    if (!isPasswordMatch) {
        return next(new HttpError("Invalid Username or Password", 401))
    }

    if (user.role === "admin") {
        generateAndSendOtp(user)

        return res.status(200).json({
            message: `OTP has been sent to ${isEmail ? "email" : "phone"}.`,
        })
    } else if (user.role === "staff") {
        const role = "staff"
    }

    generateToken(res, user._id)

    const populatedUser = await user.populate('center', 'centerName')

    await newLog({
        user: user._id,
        action: 'created',
        module: 'user',
        modifiedData: {
            user: user.userName,
            center: populatedUser.center?.centerName,
        }
    })

    res.status(200).json({
        _id: user._id,
        name: user.userName,
        email: user.email,
        phone: user.phone,
        role: user.role,
    })
})

export const generateAndSendOtp = async (user) => {
    if (user.otp && user.otp.expiresIn > Date.now()) {
        const timeLeft = user.otp.expiresIn - Date.now()

        if (timeLeft < 60000) {
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
        user = await User.findOne({ email: loginId, 'isDeleted.status': false })
    } else {
        user = await User.findOne({ phone: loginId, 'isDeleted.status': false })
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
        role: user.role,
    }

    const populatedUser = await user.populate('center', 'centerName')

    await newLog({
        user: user._id,
        action: 'created',
        module: 'user',
        modifiedData: {
            user: user.userName,
            center: populatedUser.center?.centerName,
        }
    })

    return res.json(data)
})

export const updateUserDetails = asyncHandler(async (req, res, next) => {
    const { newPassword, email, phone, center, username } = req.body

    const isAdmin = await User.findOne({ _id: req.user.id, role: "admin", 'isDeleted.status': false })
    if (!isAdmin) {
        return next(new HttpError("You are not authorized to update user details", 403))
    }

    const user = await User.findOne({ _id: req.params.id, 'isDeleted.status': false, role: 'staff' }).populate('center')
    if (!user) {
        return next(new HttpError("User not found", 404))
    }

    const oldUser = { ...user.toObject() }

    if (newPassword) {
        user.password = newPassword
    }

    if (email) {
        const emailExists = await User.findOne({ email, 'isDeleted.status': false, _id: { $ne: user._id } })
        if (emailExists) {
            return next(new HttpError("Email already in use", 400))
        }
        user.email = email
    }

    if (phone) {
        const phoneExists = await User.findOne({ phone, 'isDeleted.status': false, _id: { $ne: user._id } })
        if (phoneExists) {
            return next(new HttpError("Phone number already in use", 400))
        }
        user.phone = phone
    }

    if (center) {
        user.center = center
    }

    if (username && username !== user.userName) {
        user.userName = username
    }

    await user.save()

    const modifiedData = {}
    if (email && oldUser.email !== email) modifiedData.email = { from: oldUser.email, to: email }
    if (phone && oldUser.phone !== phone) modifiedData.phone = { from: oldUser.phone, to: phone }
    if (newPassword) modifiedData.password = { from: '***', to: '***' }
    if (username && oldUser.userName !== username) modifiedData.userName = { from: oldUser.userName, to: username }
    if (center && oldUser.center?.toString() !== center.toString()) {
        const newCenter = await Center.findById(center)
        modifiedData.center = {
            from: oldUser.center?.centerName || oldUser.center,
            to: newCenter?.centerName || center
        }
    }

    if (Object.keys(modifiedData).length > 0) {
        await newLog({
            user: req.user._id,
            action: 'updated',
            module: 'user',
            modifiedData
        })
    }

    res.status(200).json({
        success: true,
        message: "User details updated successfully",
        user: {
            _id: user._id,
            email: user.email,
            phone: user.phone,
            center: user.center,
            username: user.userName
        }
    })
})


export const deleteUser = asyncHandler(async (req, res, next) => {
    const userId = req.params.id

    // Only admin can delete
    const isAdmin = await User.findOne({
        _id: req.user._id,
        role: 'admin',
        'isDeleted.status': false
    })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized", 403))
    }

    const user = await User.findOne({ _id: userId, 'isDeleted.status': false, role: 'staff' })

    if (!user) {
        return next(new HttpError("User not found", 404))
    }

    // Soft delete
    user.isDeleted = {
        status: true,
        deletedAt: new Date(),
        deletedBy: req.user._id
    }

    await user.save()

    // Log deletion
    await newLog({
        user: req.user._id,
        action: 'deleted',
        module: 'user',
        modifiedData: {
            deletedUserName: user.userName,
            deletedUserId: user._id,
            center: user.center
        }
    })

    res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    })
})