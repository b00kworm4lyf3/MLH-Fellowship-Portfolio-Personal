#!/bin/bash

cd MLH-Fellowship-Portfolio-Personal/
git fetch && git reset origin/main --hard

docker compose -f docker-compose.prod.yaml down
docker compose -f docker-compose.prod.yaml up -d --build