import mongoose from 'mongoose'

const logSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ['created', 'updated', 'deleted', 'login', 'import', 'export'],
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    module: {
        type: String,
        required: true,
        enum: ['user', 'baselineform', 'followupform', 'center', 'user'],
        trim: true
    },
    modifiedData: {
        type: Object,
        required: true
    },

}, {
    timestamps: true
})


const Log = mongoose.model('Log', logSchema)

export default Log
