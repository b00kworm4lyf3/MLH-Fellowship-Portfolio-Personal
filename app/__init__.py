import os
from flask import Flask, render_template
from dotenv import load_dotenv

from .data import hobbies

load_dotenv()
app = Flask(__name__)

LINKS = [{"name": "About",   "endpoint": "about"},
         {"name": "Work",    "endpoint": "work"},
         {"name": "Hobbies", "endpoint": "hobbyPage"}]

@app.route('/')
def index():
    return render_template('index.html', title="MLH Fellow")

@app.route('/hobbies')
def hobbyPage():
    return render_template('hobbies.html', title = "My Hobbies", hobbies = hobbies)

@app.route('/about')
def about():
    return render_template('about.html', title="About Me")

@app.route('/work')
def work():
    return render_template('work.html', title="Work Experience")

@app.context_processor
def nav():
    return{"links": LINKS, "url": os.getenv("URL")}