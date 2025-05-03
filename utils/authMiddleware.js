import jwt from 'jsonwebtoken'
import asyncHandler from './asyncHandler.js'
import dotenv from 'dotenv'
import User from '../models/userModel.js'
dotenv.config()


export const authenticateUser = asyncHandler(async (req, res, next) => {
    let token
    token = req.cookies.jwt

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET)
            req.user = await User.findById(decoded.userId).select('_id center role userName email accessTo')
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
