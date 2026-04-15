import boto3
import os
import io
from PIL import Image, ImageEnhance
from botocore.exceptions import ClientError


def _client():
    return boto3.client(
        "s3",
        region_name=os.environ["AWS_REGION"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


BUCKET = lambda: os.environ["S3_BUCKET_NAME"]
THUMB_PREFIX = "thumbs/"
THUMB_SIZE = (400, 400)


def _make_thumbnail(file_obj):
    img = Image.open(file_obj)
    img.thumbnail(THUMB_SIZE, Image.LANCZOS)
    buf = io.BytesIO()
    fmt = "JPEG" if img.mode in ("RGB", "L") else "PNG"
    if img.mode == "RGBA":
        fmt = "PNG"
    else:
        img = img.convert("RGB")
        fmt = "JPEG"
    img.save(buf, format=fmt, quality=75, optimize=True)
    buf.seek(0)
    return buf, "image/jpeg" if fmt == "JPEG" else "image/png"


def upload_file(file_obj, filename, content_type):
    client = _client()
    # Read once into memory
    data = file_obj.read()

    # Upload original
    client.upload_fileobj(
        io.BytesIO(data), BUCKET(), filename,
        ExtraArgs={"ContentType": content_type},
    )

    # Upload thumbnail
    thumb_buf, thumb_ct = _make_thumbnail(io.BytesIO(data))
    client.upload_fileobj(
        thumb_buf, BUCKET(), THUMB_PREFIX + filename,
        ExtraArgs={"ContentType": thumb_ct},
    )


def list_files():
    response = _client().list_objects_v2(Bucket=BUCKET())
    objects = response.get("Contents", [])
    # Only original files, not thumbs
    objects = [o for o in objects if not o["Key"].startswith(THUMB_PREFIX)]
    objects.sort(key=lambda x: x["LastModified"], reverse=True)
    return [
        {
            "filename": obj["Key"],
            "url": presigned_url(obj["Key"]),
            "thumb_url": presigned_url(THUMB_PREFIX + obj["Key"]),
            "size": obj["Size"],
        }
        for obj in objects
    ]


def edit_file(filename, brightness, saturation):
    client = _client()
    # Download original
    obj = client.get_object(Bucket=BUCKET(), Key=filename)
    data = obj["Body"].read()
    content_type = obj["ContentType"]

    img = Image.open(io.BytesIO(data)).convert("RGB")
    img = ImageEnhance.Brightness(img).enhance(brightness)
    img = ImageEnhance.Color(img).enhance(saturation)

    buf = io.BytesIO()
    fmt = "JPEG" if content_type == "image/jpeg" else "PNG"
    img.save(buf, format=fmt, quality=90, optimize=True)
    buf.seek(0)

    client.upload_fileobj(buf, BUCKET(), filename, ExtraArgs={"ContentType": content_type})

    # Regenerate thumbnail
    buf.seek(0)
    thumb_buf, thumb_ct = _make_thumbnail(buf)
    client.upload_fileobj(thumb_buf, BUCKET(), THUMB_PREFIX + filename, ExtraArgs={"ContentType": thumb_ct})



    client = _client()
    client.delete_object(Bucket=BUCKET(), Key=filename)
    client.delete_object(Bucket=BUCKET(), Key=THUMB_PREFIX + filename)


def presigned_url(filename, expiry=3600):
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET(), "Key": filename},
        ExpiresIn=expiry,
    )
