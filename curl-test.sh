#!/bin/bash

response=$(curl.exe -s -X POST http://127.0.0.1:5000/api/timeline_post -d 'name=From Script&email=bash@CLI.sh&content=Testing adding posts with a bash script')

echo "$response"

curl.exe -s http://127.0.0.1:5000/api/timeline_post

id=$(echo "$response" | grep -o '"id":[0-9]*' | tr -dc '0-9')

curl.exe -s -X DELETE http://127.0.0.1:5000/api/timeline_post/$id
