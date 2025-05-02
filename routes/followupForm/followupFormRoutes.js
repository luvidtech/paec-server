import express from 'express'
import {
    createFollowupForm,
    getFollowupForm,
    getFollowupFormById,
    updateFollowupForm,
    deleteFollowupForm
} from '../../controllers/followupForm/followupFormController.js'

const router = express.Router()

router.post('/', createFollowupForm)
router.get('/', getFollowupForm)
router.get('/:id', getFollowupFormById)
router.patch('/:id', updateFollowupForm)
router.delete('/:id', deleteFollowupForm)

export default router