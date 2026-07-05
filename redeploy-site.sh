#!/bin/bash

tmux kill-server
cd MLH-Fellowship-Portfolio-Personal/
git fetch && git reset origin/main --hard

source .venv/bin/activate
pip install -r requirements.txt

tmux new-session -d -s portfolio
tmux send-keys -t portfolio "cd MLH-Fellowship-Portfolio-Personal/" C-m
tmux send-keys -t portfolio "source .venv/bin/activate" C-m
tmux send-keys -t portfolio "flask run --host=0.0.0.0" C-m