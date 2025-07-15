# Excel Export Feature

This feature allows exporting baseline and followup forms to Excel files with comprehensive filtering and field exclusion options.

## Features

- **Multiple Form Types**: Export baseline, followup, or both forms
- **Advanced Filtering**: Filter by PAEC No, patient name, UHID, date range
- **Field Exclusion**: Exclude specific fields from the export
- **Polished Excel**: Professional formatting with proper headers
- **Access Control**: Respects user permissions and center access
- **Detailed Logging**: Tracks all export activities

## API Endpoint

```
POST /api/export
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

Body:
{
    "formType": "baseline" | "followup" | "both",
    "paecNo": "PAEC001",
    "patientName": "John Doe",
    "uhid": "UHID123456",
    "fromDate": "2024-01-01",
    "toDate": "2024-12-31",
    "excludeFields": ["Created By", "Created Date", "Center"]
}
```

## Request Parameters

### Required:

- **formType**: `"baseline"`, `"followup"`, or `"both"`

### Optional Filters:

- **paecNo**: Filter by PAEC number (partial match)
- **patientName**: Filter by patient name (partial match)
- **uhid**: Filter by UHID (partial match)
- **fromDate**: Start date (YYYY-MM-DD format)
- **toDate**: End date (YYYY-MM-DD format)

### Optional:

- **excludeFields**: Array of field names to exclude from export

## Response

Returns an Excel file (.xlsx) with the following structure:

### Baseline Forms Sheet:

- All patient details
- Complete medical history
- Examination findings
- Investigation results
- MRI details
- Endocrine workup
- Treatment information
- Diagnosis data

### Followup Forms Sheet:

- All baseline fields plus:
- Baseline PAEC No reference
- Followup-specific data

## Available Fields for Exclusion

### Patient Details:

```
"PAEC No", "Patient Name", "UHID", "Sex", "Age", "DOB",
"Address", "City", "State", "Phone 1", "Phone 2", "Landline"
```

### System Fields:

```
"Created By", "Created Date", "Center", "Visit Date", "Form Type"
```

### Diagnosis:

```
"Diagnosis Type", "Isolated GHD", "Hypopituitarism",
"Affected Axes Thyroid", "Affected Axes Cortisol",
"Affected Axes Gonadal", "Affected Axes DI", "MRI Abnormality"
```

### History:

```
"Short Stature Noticed At", "Birth Weight", "Birth Length",
"Birth Duration", "Delivery Place", "Delivery Nature",
"Father Age", "Father Height", "Mother Age", "Mother Height", "MPH",
"Thelarche Age", "Menarche Age"
```

### Examination:

```
"Height", "Height Age", "Height SDS", "Weight", "Weight Age",
"Weight SDS", "BMI", "BMI SDS", "Face", "Thyroid",
"Pubertal Status", "Axillary Hair", "Pubic Hair",
"Testicular Volume Right", "Testicular Volume Left", "Breast", "SPL"
```

### MRI:

```
"MRI Performed", "MRI Date", "MRI Contrast Used", "MRI Place",
"MRI Films Available", "MRI CD Available", "MRI Scanned",
"Anterior Pituitary Hypoplasia", "Pituitary Stalk Interruption",
"Ectopic Posterior Pituitary", "Pituitary Size MM", "Other MRI Findings"
```

### Investigations:

```
"HB", "ESR", "TLC", "DLC P", "DLC L", "DLC E", "DLC M", "DLC B",
"PBF Cytic", "PBF Chromic", "S Creat", "SGOT", "SGPT", "S Albumin",
"S Glob", "S Ca", "S PO4", "SAP", "S Na", "S K", "FBS", "EGFR",
"Urine Lowest PH", "Urine Albumin", "Urine Glucose", "Urine Microscopy",
"STTG Value", "STTG Place", "Xray Chest", "Xray Skull",
"Bone Age Date", "Bone Age Value", "GP Scoring"
```

### Endocrine Workup:

```
"T4", "Free T4", "TSH", "LH", "FSH", "PRL", "ACTH", "Cortisol 8AM",
"IGF1", "Estradiol", "Testosterone", "GH Stimulation Type",
"GH Stimulation Date", "GH Stimulation Place", "Outside Place",
"Tests Done", "Single Test Type", "Peak GH Level", "Exact Peak GH", "Peak GH Time"
```

### Treatment:

```
"Hypothyroidism Present", "Hypothyroidism Diagnosis Date",
"Hypothyroidism Treatment Start Date", "Hypothyroidism Current Dose",
"Hypothyroidism Dose Changed", "Hypothyroidism Last T4", "Hypothyroidism Source",
"Hypocortisolism Present", "Hypocortisolism Diagnosis Date", "ACTH Stim Test",
"Test Date", "Peak Cortisol", "Hypocortisolism Treatment Start Date",
"Steroid Type", "Current Dose", "Frequency", "Daily Dose MG",
"Hypocortisolism Dose Changed", "Hypocortisolism Source",
"DI Present", "DI Diagnosis Date", "Minirin", "DI Dose", "DI Frequency",
"Hypogonadism Present", "Hypogonadism Diagnosis Date",
"Hypogonadism Treatment Start Date", "Full Adult Dose Date", "Hormone Type",
"MPA Start Date", "Hypogonadism Current Dose", "Hypogonadism Dose Changed",
"Calcium Supplement", "Vitamin D Supplement", "Iron Supplement",
"Antiepileptics", "Other Drugs"
```

## Postman Example

```json
{
  "formType": "both",
  "paecNo": "PAEC",
  "fromDate": "2024-01-01",
  "toDate": "2024-12-31",
  "excludeFields": ["Created By", "Created Date", "Center", "S.NO"]
}
```

## Frontend Example

```javascript
const exportData = {
  formType: "baseline",
  paecNo: "PAEC001",
  excludeFields: ["Created By", "Created Date"],
}

const response = await fetch("/api/export", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(exportData),
})

// Handle file download
const blob = await response.blob()
const url = window.URL.createObjectURL(blob)
const a = document.createElement("a")
a.href = url
a.download = "paec_export_baseline_2024-01-15.xlsx"
a.click()
window.URL.revokeObjectURL(url)
```

## Access Control

- **Own Access**: Only exports forms created by the user
- **Center Access**: Exports forms from the user's center
- **All Access**: Exports all forms (admin only)

## File Naming

Generated files follow the pattern:

```
paec_export_{formType}_{timestamp}.xlsx
```

Example: `paec_export_baseline_2024-01-15T10-30-00.xlsx`

## Logging

All exports are logged with:

- User who performed export
- Form type exported
- Number of records exported
- Applied filters
- Excluded fields

## Error Handling

- **Invalid Form Type**: Returns 400 error
- **No Data Found**: Returns empty Excel file
- **Access Denied**: Returns 403 error
- **Server Error**: Returns 500 error with details

## Performance

- **Large Datasets**: Handles thousands of records efficiently
- **Memory Optimization**: Streams data processing
- **Timeout Protection**: Prevents long-running exports

This export system provides a powerful and flexible way to extract patient data while maintaining security and performance.
