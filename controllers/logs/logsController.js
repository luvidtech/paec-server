import Log from "../../models/logModel.js"
import asyncHandler from "../../utils/asyncHandler.js"

export const getLogs = asyncHandler(async (req, res) => {
    const { module, action, user, from, to, page = 1, limit = 10 } = req.query

    const filter = {}

    if (module) filter.module = module
    if (action) filter.action = action
    if (user) filter.user = user

    if (from || to) {
        filter.createdAt = {}
        if (from) filter.createdAt.$gte = new Date(from)
        if (to) filter.createdAt.$lte = new Date(to)
    }

    const skip = (Number(page) - 1) * Number(limit)
    const total = await Log.countDocuments(filter)

    const logs = await Log.find(filter)
        .populate('user', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))

    res.json({
        success: true,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        logs
    })
})
