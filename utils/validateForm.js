export const validateForm = (req, res, next) => {
    const { patientDetails } = req.body

    if (!patientDetails || !patientDetails.name || !patientDetails.uhid) {
        return res.status(400).json({
            message: 'Patient name and UHID are required'
        })
    }

    next()
}