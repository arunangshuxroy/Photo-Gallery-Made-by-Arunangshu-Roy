# Photo Gallery — AWS S3 Cloud Storage

**Arunangshu Roy** · 23BCS11789  
**Mayank Singhal** · 23BCS13014

A minimal, production-quality photo gallery web app built with Flask and AWS S3.

---

## Tech Stack

| Layer    | Technology          |
|----------|---------------------|
| Frontend | HTML, CSS, Vanilla JS |
| Backend  | Python 3, Flask     |
| Cloud    | AWS S3              |
| SDK      | boto3               |

---

## Project Structure

```
Cloud Computing Project/
├── app.py
├── requirements.txt
├── .env.sample
├── services/
│   ├── __init__.py
│   └── s3.py
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

---

## AWS Setup

### 1. Create an S3 Bucket

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click **Create bucket**
3. Choose a unique name (e.g., `photo-gallery-yourname`)
4. Select your preferred region (e.g., `ap-south-1`)
5. Uncheck **Block all public access** (since we use presigned URLs, you can keep it blocked)
6. Click **Create bucket**

### 2. Configure IAM Credentials

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new user (e.g., `photo-gallery-user`)
3. Attach the policy **AmazonS3FullAccess** (or a scoped custom policy)
4. Under **Security credentials**, create an **Access Key**
5. Save the `Access Key ID` and `Secret Access Key`

#### Minimal IAM Policy (recommended over full access)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

### 3. CORS Configuration (required for browser access)

In your S3 bucket → **Permissions** → **CORS**, paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:5000"],
    "ExposeHeaders": []
  }
]
```

---

## Local Setup

### 1. Clone / navigate to the project

```bash
cd "Cloud Computing Project"
```

### 2. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate      # macOS/Linux
venv\Scripts\activate         # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.sample .env
```

Edit `.env` with your actual credentials:

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret...
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your-bucket-name
```

### 5. Run the app

```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000)

---

## API Routes

| Method   | Route                  | Description          |
|----------|------------------------|----------------------|
| `GET`    | `/`                    | Serve the frontend   |
| `POST`   | `/upload`              | Upload an image      |
| `GET`    | `/images`              | List all images      |
| `DELETE` | `/delete/<filename>`   | Delete an image      |

---

## Features

- Upload JPEG/PNG images (max 10 MB)
- Drag-and-drop or click-to-select
- Image preview before upload
- Presigned URL-based secure image delivery
- Responsive CSS Grid gallery
- Lazy-loaded images
- Delete with confirmation modal
- Clean status feedback (no browser alerts)

---

## Security Notes

- Credentials are loaded from `.env` — never committed to version control
- Filenames are sanitized and replaced with UUIDs
- File type validated on both extension and MIME type
- Presigned URLs expire after 1 hour
- `.env` is excluded via `.gitignore`

---

## .gitignore

```
venv/
.env
__pycache__/
*.pyc
.DS_Store
```
