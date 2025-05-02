import mongoose from 'mongoose'

const centerSchema = new mongoose.Schema({
    centerName: {
        type: String,
        required: true,
        trim: true
    },
    centerCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    isDeleted: {
        status: { type: Boolean, default: false },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedTime: { type: Date }
    }
}, { timestamps: true })

const Center = mongoose.model('Center', centerSchema)

export default Center
