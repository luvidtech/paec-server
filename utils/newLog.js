import Log from '../models/logModel.js'
import asyncHandler from './asyncHandler.js'

const newLog = asyncHandler(async ({ user, action, module, modifiedData }) => {
    try {
        const logEntry = new Log({
            action,
            user,
            module,
            modifiedData,
        })

        await logEntry.save()
    } catch (error) {
        console.error('Error adding log:', error)
    }
})

export default newLog
