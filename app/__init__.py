import os
from flask import Flask, render_template, request
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html', title="MLH Fellow", url=os.getenv("URL"))


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/work')
def work():
    return render_template('work.html')
