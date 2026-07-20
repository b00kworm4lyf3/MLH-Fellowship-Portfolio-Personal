import os
import folium
import datetime
from flask import Flask, render_template, request
from dotenv import load_dotenv
from peewee import *
from playhouse.shortcuts import model_to_dict

from .data import user, hobbies, exp, edu, travel

load_dotenv()
app = Flask(__name__)

if os.getenv("TESTING") == "true":
    print("Running in test mode")
    mydb = SqliteDatabase('file:memory?mode=memory&cache=shared', uri=True)
else:
    mydb = MySQLDatabase(os.getenv("MYSQL_DATABASE"),
                         user = os.getenv("MYSQL_USER"),
                         password = os.getenv("MYSQL_PASSWORD"),
                         host = os.getenv("MYSQL_HOST"),
                         port = 3306)

print(mydb)

class TimelinePost(Model):
    name = CharField()
    email = CharField()
    content = TextField()
    created_at = DateTimeField(default = datetime.datetime.now)

    class Meta:
        database = mydb

mydb.connect()
mydb.create_tables([TimelinePost])

LINKS = [
    {"name": "About",    "endpoint": "about",       "tagline": "About Me"},
    {"name": "Work",     "endpoint": "work",        "tagline": "Work Experience"},
    {"name": "Hobbies",  "endpoint": "hobby",       "tagline": "My Hobbies"},
    {"name": "Travel",   "endpoint": "travel_page", "tagline": "My Travels"},
    {"name": "Timeline", "endpoint": "timeline",    "tagline": "Timeline"}
]

CONTACT = [
    {"label": "Contact Me", "href": "mailto:you@example.com"},
    {"label": "GitHub", "href": "https://github.com/"},
    {"label": "LinkedIn", "href": "https://linkedin.com/"},
]

@app.route('/')
def index():
    return render_template('index.html', title="Home", user = user)

@app.route('/hobbies')
def hobby():
    return render_template('hobbies.html', title = "My Hobbies", hobbies = hobbies)

@app.route('/about')
def about():
    return render_template('about.html', title="About Me", user = user, edu = edu)

@app.route('/work')
def work():
    return render_template('work.html', title="Work Experience", exp = exp)

@app.route('/travel')
def travel_page():
    # Create a world map
    travel_map = folium.Map(location=[20, 0], zoom_start=2)

    # Loop through visited places
    for place in travel["visited"]:
        folium.Marker(
            location=[place["lat"], place["lon"]],
            popup=f"{place['name']} (Visited - {place['year']})",
            icon=folium.Icon(color='green', icon='ok-sign')
        ).add_to(travel_map)

    # Loop through wishlist places
    for place in travel["wishlist"]:
        folium.Marker(
            location=[place["lat"], place["lon"]],
            popup=f"{place['name']} (Wishlist)",
            icon=folium.Icon(color='lightgreen', icon='star')
        ).add_to(travel_map)

    # Convert map to HTML
    map_html = travel_map._repr_html_()

    return render_template('travel.html', title="Travel", map_html=map_html)

@app.route('/timeline')
def timeline():
    return render_template('timeline.html', title = 'Timeline')

@app.context_processor
def nav():
    return{"links": LINKS, "contact": CONTACT, "url": os.getenv("URL")}

@app.route('/api/timeline_post', methods = ['POST'])
def post_timeline_post():
    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    content = request.form.get('content', '').strip()

    if not name:
        return 'Invalid name', 400
    if not content:
        return 'Invalid content', 400
    if '@' not in email or '.' not in email.split('@')[-1]:
        return 'Invalid email', 400

    timeline_post = TimelinePost.create(name=name, email=email, content=content)
    return model_to_dict(timeline_post)

@app.route('/api/timeline_post', methods = ['GET'])
def get_timeline_post():
    return{
        'timeline_posts': [
            model_to_dict(p)
            for p in TimelinePost.select().order_by(TimelinePost.created_at.desc())
        ]
    }

@app.route('/api/timeline_post/<int:post_id>', methods = ['DELETE'])
def delete_timeline_post(post_id):
    post = TimelinePost.get_or_none(TimelinePost.id == post_id)
    if post is None:
        return {'error': 'post not found'}
    post.delete_instance()
    return {'deleted post with id': post_id}