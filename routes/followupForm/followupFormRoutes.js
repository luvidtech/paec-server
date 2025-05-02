import express from 'express'
import {
    createFollowupForm,
    getFollowupForm,
    getFollowupFormById,
    updateFollowupForm,
    deleteFollowupForm
} from '../../controllers/followupForm/followupFormController.js'
import { authenticateUser } from '../../utils/authMiddleware.js'

const router = express.Router()

router.post('/',authenticateUser, createFollowupForm)
router.get('/',authenticateUser, getFollowupForm)
router.get('/:id',authenticateUser, getFollowupFormById)
router.patch('/:id',authenticateUser, updateFollowupForm)
router.delete('/:id',authenticateUser, deleteFollowupForm)

export default router