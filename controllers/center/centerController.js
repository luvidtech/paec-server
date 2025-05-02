import Center from '../../models/centreModel.js'
import User from '../../models/userModel.js'
import asyncHandler from '../../utils/asyncHandler.js'
import HttpError from '../../utils/httpErrorMiddleware.js'


// Create Center
export const createCenter = asyncHandler(async (req, res, next) => {
    const { centerName, centerCode } = req.body

    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized to register a user", 403))
    }

    const existing = await Center.findOne({ centerCode, 'isDeleted.status': false })
    if (existing) {
        throw new HttpError('Center code already exists', 400)
    }

    const newCenter = new Center({ centerName, centerCode })
    const saved = await newCenter.save()

    res.status(201).json(saved)
})

export const getCenters = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 10, centerName = '', centerCode = '' } = req.query
    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized to register a user", 403))
    }

    const query = {
        'isDeleted.status': false,
        centerName: { $regex: centerName, $options: 'i' },
        centerCode: { $regex: centerCode, $options: 'i' }
    }

    const total = await Center.countDocuments(query)
    const centers = await Center.find(query)
        .sort({ centerName: 1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))

    res.json({
        data: centers,
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit)
    })
})

export const getCenterById = asyncHandler(async (req, res, next) => {
    const center = await Center.findOne({
        _id: req.params.id,
        'isDeleted.status': false
    })

    if (!center) {
        return res.status(404).json({ message: "Center not found" })
    }

    res.status(200).json(center)
})



// Update Center
export const updateCenter = asyncHandler(async (req, res, next) => {
    const { centerName, centerCode } = req.body
    const center = await Center.findById(req.params.id)
    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized to register a user", 403))
    }

    if (!center || center.isDeleted.status) {
        throw new HttpError('Center not found', 404)
    }

    // Optionally check for duplicate centerCode on update
    if (centerCode && centerCode !== center.centerCode) {
        const exists = await Center.findOne({ centerCode, _id: { $ne: req.params.id }, 'isDeleted.status': false })
        if (exists) {
            throw new HttpError('Another center with this code already exists', 400)
        }
    }

    center.centerName = centerName || center.centerName
    center.centerCode = centerCode || center.centerCode

    const updated = await center.save()
    res.json(updated)
})

// Soft Delete Center
export const deleteCenter = asyncHandler(async (req, res, next) => {
    const center = await Center.findById(req.params.id)
    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized to register a user", 403))
    }

    if (!center || center.isDeleted.status) {
        throw new HttpError('Center not found', 404)
    }

    center.isDeleted = {
        status: true,
        deletedBy: req.user ? req.user._id : null,
        deletedTime: new Date()
    }

    await center.save()
    res.json({ message: 'Center deleted successfully' })
})
