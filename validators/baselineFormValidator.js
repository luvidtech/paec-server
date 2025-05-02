import { body } from 'express-validator'

export const validateBaselineForm = [
    body('patientDetails.paecNo').notEmpty().withMessage('paecNo is required'),
    body('patientDetails.uhid').notEmpty().withMessage('uhid is required'),
    body('patientDetails.name').notEmpty().withMessage('name is required'),
    body('patientDetails.dob').notEmpty().withMessage('dob is required').isISO8601().withMessage('dob must be a valid date'),
    body('patientDetails.age').notEmpty().withMessage('age is required').isInt({ min: 0 }).withMessage('age must be a number'),
    body('patientDetails.sex').notEmpty().withMessage('sex is required').isIn(['Male', 'Female']).withMessage('sex must be Male or Female'),

    body('patientDetails.address.street').notEmpty().withMessage('street is required'),
    body('patientDetails.address.city').notEmpty().withMessage('city is required'),
    body('patientDetails.address.state').notEmpty().withMessage('state is required'),

    body('patientDetails.contact.cell1').notEmpty().withMessage('Primary cell number (cell1) is required'),
    body('patientDetails.contact.landline').optional().isString(),
    body('patientDetails.contact.cell2').optional().isString(),

    body('history.shortStatureNoticedAt').notEmpty().withMessage('Short stature noticed age is required'),
    body('history.birthHistory.duration').notEmpty().withMessage('Birth duration is required'),
    body('history.birthHistory.deliveryPlace').notEmpty().withMessage('Delivery place is required'),
    body('history.birthHistory.deliveryNature').notEmpty().withMessage('Delivery nature is required'),
    body('history.birthHistory.birthWeight').isNumeric().withMessage('Birth weight must be a number'),
    body('history.birthHistory.birthLength').isNumeric().withMessage('Birth length must be a number'),
    body('history.birthHistory.birthHypoxia').isBoolean().withMessage('Birth hypoxia must be true or false'),

    // Optional: You can keep adding validations for deeper levels (like pubertyHistory, familyHistory, etc.)
]
