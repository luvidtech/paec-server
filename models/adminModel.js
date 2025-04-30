import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const adminSchema = new mongoose.Schema(
    {
        adminName: {
            type: String,
            required: true,
        },
        userName: {
            type: String,
            required: true,
        },
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company"
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

        isOwner: {
            type: Boolean,
            required: true,
            default: true,
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
        isDisabled: {
            type: Boolean,
            required: true,
            default: false,
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
                ref: 'Owner'
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

adminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password)
}

//Password Hashing
adminSchema.pre('save', async function (next) {
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

const Admin = mongoose.model('Admin', adminSchema)

export default Admin
