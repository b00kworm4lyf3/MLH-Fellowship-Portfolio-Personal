import unittest
import os
os.environ['TESTING'] = 'true'

from app import app

class AppTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_home(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)

        html = response.get_data(as_text=True)
        self.assertIn('<title>Home</title>', html)

    def test_timeline(self):
        response = self.client.get('/api/timeline_post')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Content-Type'), 'application/json')

        json = response.get_json()
        self.assertIn("timeline_posts", json)
        self.assertEqual(len(json["timeline_posts"]), 0)

    def test_timeline_post(self):
        response = self.client.post('/api/timeline_post', data={
            'name': 'John Doe',
            'email': 'john@example.com',
            'content': "Hello world, I'm John!"
        })
        self.assertEqual(response.status_code, 200)

        response = self.client.get('/api/timeline_post')
        self.assertEqual(response.status_code, 200)

        json = response.get_json()
        self.assertEqual(len(json["timeline_posts"]), 1)
        self.assertEqual(json['timeline_posts'][0]['name'], 'John Doe')
        self.assertEqual(json['timeline_posts'][0]['email'], 'john@example.com')

    def test_timeline_page(self):
        response = self.client.get('/timeline')
        self.assertEqual(response.status_code, 200)

    def test_malformed_timeline_post(self):
        # POST request missing name
        response = self.client.post('/api/timeline_post', data={
            'email': 'john@example.com',
            'content': "Hello world, I'm John!"
        })
        self.assertEqual(response.status_code, 400)

        html = response.get_data(as_text=True)
        self.assertIn('Invalid name', html)

        # POST request with empty content
        response = self.client.post('/api/timeline_post', data={
            'name': 'John Doe',
            'email': 'john@example.com',
            'content': ''
        })
        self.assertEqual(response.status_code, 400)

        html = response.get_data(as_text=True)
        self.assertIn('Invalid content', html)

        # POST request with malformed email
        response = self.client.post('/api/timeline_post', data={
            'name': 'John Doe',
            'email': 'not-an-email',
            'content': "Hello world, I'm John!"
        })
        self.assertEqual(response.status_code, 400)

        html = response.get_data(as_text=True)
        self.assertIn('Invalid email', html)
