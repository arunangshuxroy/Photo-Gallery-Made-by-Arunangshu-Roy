import boto3
import os
from botocore.exceptions import ClientError


def _client():
    return boto3.client(
        "s3",
        region_name=os.environ["AWS_REGION"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


BUCKET = lambda: os.environ["S3_BUCKET_NAME"]


def upload_file(file_obj, filename, content_type):
    _client().upload_fileobj(
        file_obj,
        BUCKET(),
        filename,
        ExtraArgs={"ContentType": content_type},
    )


def list_files():
    response = _client().list_objects_v2(Bucket=BUCKET())
    objects = response.get("Contents", [])
    objects.sort(key=lambda x: x["LastModified"], reverse=True)
    return [
        {
            "filename": obj["Key"],
            "url": presigned_url(obj["Key"]),
            "size": obj["Size"],
        }
        for obj in objects
    ]


def delete_file(filename):
    _client().delete_object(Bucket=BUCKET(), Key=filename)


def presigned_url(filename, expiry=3600):
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET(), "Key": filename},
        ExpiresIn=expiry,
    )
