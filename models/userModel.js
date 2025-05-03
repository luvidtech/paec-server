import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: true,
        },
        center: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Center"
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        profilePhoto: {
            type: String,
            default: "/defaults/noprofile.png"
        },
        phone: {
            type: String,
        },
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['admin', 'staff'],
        },
        isEmailVerified: {
            type: Boolean,
            default: true,
        },
        isPhoneVerified: {
            type: Boolean,
            default: true,
        },
        isActive: {
            type: Boolean,
            required: true,
            default: true,
        },
        accessTo: {
            type: String,
            enum: ['all', 'own', 'center'],
            default: 'center'
        },
        otp: {
            otpCode: {
                type: String,
            },
            expired: {
                type: Boolean,
                default: false
            },
            expiresIn: {
                type: Date
            }
        },
        isDeleted: {
            status: {
                type: Boolean,
                default: false
            },
            deletedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            deletedTime: {
                type: Date,
                default: Date.now
            }
        },
    },

    {
        timestamps: true,
    }
)

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
}

//Password Hashing
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next()
    }
    try {
        const salt = await bcrypt.genSalt(10)
        this.password = await bcrypt.hash(this.password, salt)
        next()
    } catch (err) {
        next(err)
    }
})

const User = mongoose.model('User', userSchema)

export default User
