#!/usr/bin/env python3
"""
Deploy script for 豆豆背单词.
Builds the Vite app, generates index.csv from datasets/index.yaml,
and uploads everything to Qiniu Cloud.
"""

import os
import sys
import hashlib
import subprocess
import csv
import io

import yaml

QINIU_AK = 'TXm80_kK-F8QU6CxKF_Aq1rFGzn-C1TYVHBULNtu'
QINIU_SK = '2F81LdnTggWSaj7XtiImdXUQabwz6VaH72_wWvOh'
BUCKET = 'ripple-files'

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(PROJECT_ROOT, 'dist')
DATASETS_DIR = os.path.join(PROJECT_ROOT, 'datasets')
INDEX_YAML = os.path.join(DATASETS_DIR, 'index.yaml')


def md5_file(filepath):
    h = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def run_build():
    print('==> Running npm build...')
    result = subprocess.run(
        ['npm', 'run', 'build'],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f'Build failed:\n{result.stderr}')
        sys.exit(1)
    print('Build succeeded.')


def load_index_yaml():
    with open(INDEX_YAML, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def generate_index_csv(entries):
    """Generate index.csv content from dataset entries with computed md5."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['id', 'name', 'category', 'category_name', 'file_md5'])

    for entry in entries:
        csv_path = os.path.join(DATASETS_DIR, entry['file'])
        if not os.path.exists(csv_path):
            print(f'WARNING: {csv_path} not found, skipping.')
            continue
        file_md5 = md5_file(csv_path)
        entry['_md5'] = file_md5
        entry['_path'] = csv_path
        writer.writerow([
            entry['id'],
            entry['name'],
            entry['category'],
            entry['category_name'],
            file_md5,
        ])

    return output.getvalue()


def upload_to_qiniu(key, filepath):
    from qiniu import Auth, put_file, BucketManager

    auth = Auth(QINIU_AK, QINIU_SK)
    token = auth.upload_token(BUCKET, key, 3600)
    ret, info = put_file(token, key, filepath, version='v2')
    if info.status_code == 200:
        print(f'  Uploaded: {key}')
    else:
        print(f'  FAILED: {key} -> {info}')
        return False
    return True


def upload_data(key, data_bytes):
    from qiniu import Auth, put_data

    auth = Auth(QINIU_AK, QINIU_SK)
    token = auth.upload_token(BUCKET, key, 3600)
    ret, info = put_data(token, key, data_bytes, version='v2')
    if info.status_code == 200:
        print(f'  Uploaded: {key}')
    else:
        print(f'  FAILED: {key} -> {info}')
        return False
    return True


def check_exists(key):
    from qiniu import Auth, BucketManager

    auth = Auth(QINIU_AK, QINIU_SK)
    bucket_mgr = BucketManager(auth)
    ret, info = bucket_mgr.stat(BUCKET, key)
    return info.status_code == 200


def deploy():
    run_build()

    print('\n==> Loading datasets/index.yaml...')
    entries = load_index_yaml()
    print(f'Found {len(entries)} wordbooks.')

    print('\n==> Generating index.csv...')
    index_csv_content = generate_index_csv(entries)

    print('\n==> Uploading to Qiniu...')

    # Upload main HTML
    html_path = os.path.join(DIST_DIR, 'remember_words.html')
    if os.path.exists(html_path):
        upload_to_qiniu('remember_words.html', html_path)
    else:
        print(f'ERROR: {html_path} not found!')
        sys.exit(1)

    # Upload assets
    assets_dir = os.path.join(DIST_DIR, 'remember_words')
    if os.path.isdir(assets_dir):
        for filename in os.listdir(assets_dir):
            filepath = os.path.join(assets_dir, filename)
            if os.path.isfile(filepath):
                key = f'remember_words/{filename}'
                upload_to_qiniu(key, filepath)

    # Upload index.csv
    upload_data(
        'remember_words/dataset/index.csv',
        index_csv_content.encode('utf-8'),
    )

    # Upload wordbook CSVs
    for entry in entries:
        if '_md5' not in entry:
            continue
        key = f'remember_words/dataset/{entry["_md5"]}.csv'
        if check_exists(key):
            print(f'  Skipped (exists): {key}')
        else:
            upload_to_qiniu(key, entry['_path'])

    print('\n==> Done! Site: https://statics01.readland.cn/remember_words.html')


if __name__ == '__main__':
    deploy()
