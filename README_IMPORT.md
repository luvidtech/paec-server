# Excel Import Feature

This feature allows importing baseline and followup forms from Excel files with validation and override capabilities.

## Features

- **Excel File Upload**: Supports .xlsx and .xls files
- **Baseline & Followup Forms**: Can create both types of forms
- **Flexible Validation**: Only PAEC No is mandatory, all other fields are optional
- **Smart Updates**: Only updates fields that are provided (blank fields skip)
- **Override Existing Data**: Updates existing baseline forms if PAEC No already exists
- **Followup Validation**: Only creates followup forms if baseline exists
- **Comprehensive Template**: Includes all possible fields for complete data entry
- **Detailed Reporting**: Returns comprehensive import results

## API Endpoints

### 1. Download Import Template

```
GET /api/import/template
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response**: Excel file with sample data and headers

### 2. Import Excel File

```
POST /api/import
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

Body:
- excelFile: [Excel file]
```

## Excel Format Requirements

### Required Headers:

- **PAEC No** (Mandatory) - Only this field is required
- All other fields are optional and can be included as needed

### Comprehensive Template Includes:

```
S.NO | PAEC No | PATIENT NAME | UHID | SEX | AGE | DOB | Address | City | State |
Phone no1 | Phone no2 | Phone 3 | Visit Date | Form Type |
FINAL DIAGNOSIS 1 | Diagnosis Type |
Birth Weight | Birth Length | Birth Duration | Delivery Place | Delivery Nature |
Father Age | Father Height | Mother Age | Mother Height | MPH |
Short Stature Noticed At | Thelarche Age | Menarche Age |
Height | Height Age | Height SDS | Weight | Weight Age | Weight SDS | BMI | BMI SDS |
Face | Thyroid | Pubertal Status | Axillary Hair | Pubic Hair | Testicular Volume Right | Testicular Volume Left | Breast | SPL |
MRI Performed | MRI Date | MRI Contrast Used | MRI Place | MRI Films Available | MRI CD Available | MRI Scanned |
Anterior Pituitary Hypoplasia | Pituitary Stalk Interruption | Ectopic Posterior Pituitary | Pituitary Size MM | Other MRI Findings |
HB | ESR | TLC | DLC P | DLC L | DLC E | DLC M | DLC B | PBF Cytic | PBF Chromic |
S Creat | SGOT | SGPT | S Albumin | S Glob | S Ca | S PO4 | SAP | S Na | S K | FBS | EGFR |
Urine Lowest PH | Urine Albumin | Urine Glucose | Urine Microscopy |
STTG Value | STTG Place | Xray Chest | Xray Skull | Bone Age Date | Bone Age Value | GP Scoring |
T4 | Free T4 | TSH | LH | FSH | PRL | ACTH | Cortisol 8AM | IGF1 | Estradiol | Testosterone |
GH Stimulation Type | GH Stimulation Date | GH Stimulation Place | Outside Place | Tests Done | Single Test Type | Peak GH Level | Exact Peak GH | Peak GH Time |
Hypothyroidism Present | Hypothyroidism Diagnosis Date | Hypothyroidism Treatment Start Date | Hypothyroidism Current Dose | Hypothyroidism Dose Changed | Hypothyroidism Last T4 | Hypothyroidism Source |
Hypocortisolism Present | Hypocortisolism Diagnosis Date | ACTH Stim Test | Test Date | Peak Cortisol | Hypocortisolism Treatment Start Date | Steroid Type | Current Dose | Frequency | Daily Dose MG | Hypocortisolism Dose Changed | Hypocortisolism Source |
DI Present | DI Diagnosis Date | Minirin | DI Dose | DI Frequency |
Hypogonadism Present | Hypogonadism Diagnosis Date | Hypogonadism Treatment Start Date | Full Adult Dose Date | Hormone Type | MPA Start Date | Hypogonadism Current Dose | Hypogonadism Dose Changed |
Calcium Supplement | Vitamin D Supplement | Iron Supplement | Antiepileptics | Other Drugs |
Diagnosis Type | Isolated GHD | Hypopituitarism | Affected Axes Thyroid | Affected Axes Cortisol | Affected Axes Gonadal | Affected Axes DI | MRI Abnormality
```

### Sample Data:

```
1 | PAEC001 | John Doe | UHID123456 | Male | 14 | 2010-05-15 | 123 Main St | New Delhi | Delhi | 9876543210 | 9876543211 | 01123456789 | 2024-01-15 | Baseline | Isolated GHD | Congenital | 2.5 | 45 | Full Term | Hospital | Normal | 45 | 170 | 40 | 160 | 165 | 2 years | 12 | 14 | 140 | 12 | -2.5 | 35 | 12 | -1.8 | 17.9 | -1.2 | Normal | Normal | Prepubertal | Absent | I | 2ml | 2ml | I | Normal | Yes | 2024-01-10 | Yes | AIIMS | Yes | No | Yes | Present | Absent | Present | 3.5 | Normal pituitary gland | 12.5 | 15 | 8000 | 60 | 30 | 5 | 3 | 2 | Normo | Normo | 0.8 | 25 | 30 | 4.2 | 3.1 | 9.5 | 4.2 | 200 | 140 | 4.0 | 85 | 90 | 6.5 | Negative | Negative | Normal | Normal | AIIMS | Normal | Normal | 2024-01-10 | 12 years | true | 8.5 | 1.2 | 2.5 | 1.2 | 3.5 | 15 | 25 | 12.5 | 180 | 15 | 0.8 | Clonidine | 2024-01-12 | AIIMS | | 2 | | <10 | 8.5 | 30 min | Yes | 2024-01-01 | 2024-01-02 | 50 mcg | No | 8.5 | Hospital Supply | No | | | | | | | | | | | No | | | | | | No | | | | | | | | | true | true | false | false | | Congenital | Yes | No | Yes | No | No | No | Present
```

## Import Logic

### Baseline Forms:

- **New PAEC No**: Creates new baseline form
- **Existing PAEC No**: Updates existing baseline form with new data
- **Form Type**: Leave empty or set to "Baseline"

### Followup Forms:

- **Baseline Exists**: Creates followup form linked to baseline
- **No Baseline**: Skips and reports error
- **Form Type**: Set to "Followup"

## Response Format

```json
{
  "message": "Import completed",
  "results": {
    "total": 10,
    "baselineCreated": 5,
    "baselineUpdated": 2,
    "followupCreated": 3,
    "followupSkipped": 1,
    "errors": [
      {
        "row": 8,
        "error": "Baseline form not found for PAEC No: PAEC008"
      },
      {
        "row": 12,
        "error": "Missing required fields: PAEC No, Patient Name, or UHID"
      }
    ]
  }
}
```

## Postman Setup

### Download Template:

1. **Method**: `GET`
2. **URL**: `http://localhost:5000/api/import/template`
3. **Headers**: `Authorization: Bearer YOUR_JWT_TOKEN`

### Import File:

1. **Method**: `POST`
2. **URL**: `http://localhost:5000/api/import`
3. **Headers**: `Authorization: Bearer YOUR_JWT_TOKEN`
4. **Body**:
   - Select `form-data`
   - Key: `excelFile`
   - Type: `File`
   - Value: Select your Excel file

## Error Handling

### Common Errors:

- **Missing Headers**: Returns list of missing required headers
- **Invalid File Type**: Only Excel files (.xlsx, .xls) allowed
- **Missing Required Fields**: PAEC No, Patient Name, UHID required
- **Followup Without Baseline**: Followup forms require existing baseline
- **File Processing Errors**: Detailed error messages for each row

### Validation Rules:

- **PAEC No**: Required, unique identifier (only mandatory field)
- **All Other Fields**: Optional - only provided fields will be updated
- **Blank Fields**: Skipped (won't override existing data)
- **Form Type**: "Baseline" or "Followup" (case insensitive)
- **Date Fields**: Should be in YYYY-MM-DD format
- **Number Fields**: Will be converted to numbers automatically

## File Storage

- **Upload Location**: `/uploads/imports/`
- **File Naming**: `{timestamp}-{originalname}`
- **Cleanup**: Files are automatically deleted after processing

## Logging

All imports are logged with:

- User who performed import
- Total records processed
- Number of baselines created/updated
- Number of followups created/skipped
- Number of errors

## Security

- **Authentication Required**: All endpoints require valid JWT token
- **File Type Validation**: Only Excel files accepted
- **File Size Limits**: Configured in multer settings
- **Automatic Cleanup**: Temporary files deleted after processing

## Usage Example

```javascript
// Frontend example
const formData = new FormData()
formData.append("excelFile", fileInput.files[0])

const response = await fetch("/api/import", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
})

const result = await response.json()
console.log("Import Results:", result.results)
```

## Template Structure

The downloadable template includes:

1. **Headers Row**: All required column headers
2. **Sample Data**: Example baseline and followup entries
3. **Formatting**: Proper column widths and data types
4. **Instructions**: Comments explaining each column

This import system provides a robust way to bulk import patient data while maintaining data integrity and providing detailed feedback on the import process.
