#!/bin/bash

cd MLH-Fellowship-Portfolio-Personal/
git fetch && git reset origin/main --hard

source .venv/bin/activate
pip install -r requirements.txt

systemctl restart myportfolio