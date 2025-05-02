import express from 'express'
import {
    createCenter,
    getCenters,
    updateCenter,
    deleteCenter,
    getCenterById
} from '../../controllers/center/centerController.js'
import { authenticateUser } from '../../utils/authMiddleware.js'

const router = express.Router()

router.post('/', authenticateUser, createCenter)
router.get('/', authenticateUser, getCenters)
router.get('/:id', authenticateUser, getCenterById)
router.patch('/:id', authenticateUser, updateCenter)
router.delete('/:id', authenticateUser, deleteCenter)

export default router
