#ruff: noqa: F403 F405
import unittest
from peewee import *

from app import TimelinePost

MODELS = [TimelinePost]

test_db = SqliteDatabase(':memory:')

class TestTimelinePost(unittest.TestCase):
    def setUp(self):
        test_db.bind(MODELS, bind_refs=False, bind_backrefs=False)
        test_db.connect()
        test_db.create_tables(MODELS)

    def tearDown(self):
        test_db.drop_tables(MODELS)
        test_db.close()

    def test_timeline_post(self):
        first_post = TimelinePost.create(name='John Doe', email='john@example.com', content="Hello world, I'm John!")
        self.assertEqual(first_post.id, 1)

        second_post = TimelinePost.create(name='Jane Doe', email='jane@example.com', content="Hello world, I'm Jane!")
        self.assertEqual(second_post.id, 2)

        posts = TimelinePost.select().order_by(TimelinePost.created_at.desc())
        self.assertEqual(len(posts), 2)

        actual = [(p.name, p.email, p.content) for p in posts]
        self.assertEqual(actual, [
            ('Jane Doe', 'jane@example.com', "Hello world, I'm Jane!"),
            ('John Doe', 'john@example.com', "Hello world, I'm John!"),
        ])
