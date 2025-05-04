export const getModifiedFields = (oldData, newData, prefix = '') => {
    let modified = {}

    for (const key in newData) {
        const fullPath = prefix ? `${prefix}.${key}` : key

        const oldValue = oldData?.[key]
        const newValue = newData[key]

        if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
            const nested = getModifiedFields(oldValue || {}, newValue, fullPath)
            modified = { ...modified, ...nested }
        } else {
            const oldValString = oldValue instanceof Date ? oldValue.toISOString() : oldValue
            const newValString = newValue instanceof Date ? newValue.toISOString() : newValue

            if (oldValString !== newValString) {
                modified[fullPath] = {
                    from: oldValString ?? 'N/A',
                    to: newValString
                }
            }
        }
    }

    return modified
}
