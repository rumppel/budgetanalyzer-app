# S3 Configuration for PDF Reports

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=openbudget-reports
```

## Setup Steps

1. **Create an S3 Bucket:**
   - Go to AWS Console → S3
   - Create a new bucket (e.g., `openbudget-reports`)
   - Choose your preferred region
   - Configure bucket settings (versioning, lifecycle policies, etc.)

2. **Create IAM User:**
   - Go to AWS Console → IAM
   - Create a new user with programmatic access
   - Attach a policy that allows:
     - `s3:PutObject` - to upload PDFs
     - `s3:GetObject` - to download PDFs
     - `s3:DeleteObject` - (optional) to delete PDFs
   - Example policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject"
         ],
         "Resource": "arn:aws:s3:::openbudget-reports/*"
       }
     ]
   }
   ```

3. **Set Environment Variables:**
   - Add the credentials to your `.env` file
   - Restart your backend server

## How It Works

- When a report is generated with a `report_name`, it is automatically uploaded to S3
- The S3 URL is saved in the `user_reports.s3_url` column
- When downloading a report:
  - If the report is public and has an S3 URL → redirects to S3
  - If the report is private and has an S3 URL → generates a presigned URL (1 hour expiry)
  - If no S3 URL → regenerates the PDF from saved parameters

## S3 File Structure

Reports are stored with the following structure:
```
reports/
  {user_id}/
    {YYYY-MM-DD}/
      {report_id}_{report_name}.pdf
```

Example:
```
reports/123/2024-01-15/temp_1705320000000_Budget_Report_2024.pdf
```

## Fallback Behavior

If S3 is not configured (missing environment variables), the system will:
- Still generate PDFs
- Save report metadata to database
- Store `null` in `s3_url` column
- Regenerate PDFs on-demand when downloading

