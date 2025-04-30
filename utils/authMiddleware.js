import jwt from 'jsonwebtoken'
import Owner from '../models/adminModel.js'
import asyncHandler from './asyncHandler.js'
import dotenv from 'dotenv'
dotenv.config()


export const authenticateOwner = asyncHandler(async (req, res, next) => {
    let token
    token = req.cookies.jwt

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET)
            req.owner = await Owner.findById(decoded.userId).select('-password')
            next()
        } catch (err) {
            console.error(err)
            res.status(401)
            throw new Error('Not authorized, token failed')
        }
    } else {
        res.status(401)
        throw new Error('Not authorized, no token')
    }
})
