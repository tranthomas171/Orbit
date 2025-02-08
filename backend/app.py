from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS
from functools import wraps
import requests
from data_handlers import TextHandler, ImageHandler, AudioHandler
import chromadb
from users.user_management import init_db, User, db
from dotenv import load_dotenv
import os

load_dotenv()

# Initialize ChromaDB client
chroma_path = "OrbitDB"
client = chromadb.PersistentClient(path=chroma_path)

# Initialize handlers
text_handler = TextHandler(client)
image_handler = ImageHandler(client)
audio_handler = AudioHandler(client)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["chrome-extension://*", "http://localhost:5173"],
        "methods": ["POST", "GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.secret_key = os.getenv("SESSION_SECRET")

# Initialize database
init_db(app)

def verify_google_token(token):
    try:
        response = requests.get(
            f'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token={token}'
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Token verification error: {e}")
        return None

# ------------------------------------------------------------------------------
# New require_auth decorator: now checks the session instead of Authorization header.
# ------------------------------------------------------------------------------
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'User not logged in'}), 401
        # Retrieve the user from the database using the session value.
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': 'Invalid session or user not found'}), 401
        request.user = user  # Make user available to the endpoint.
        return f(*args, **kwargs)
    return decorated_function

# ------------------------------------------------------------------------------
# New Login endpoint:
# This endpoint receives a POST with the Google token, validates it,
# then creates or retrieves the user and sets session variables.
# ------------------------------------------------------------------------------
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or 'token' not in data:
            return jsonify({'error': 'No token provided'}), 400

        token = data['token']
        token_info = verify_google_token(token)
        if not token_info:
            return jsonify({'error': 'Invalid token'}), 401

        email = token_info.get('email')
        if not email:
            return jsonify({'error': 'Email not found in token'}), 401

        # Get or create the user based on email.
        user, created = User.get_or_create(email)
        # Store user details in the session.
        session['user_id'] = user.id
        session['email'] = user.email

        return jsonify({
            'status': 'success',
            'user': {
                'id': user.id,
                'email': user.email
            }
        })
    except Exception as e:
        print(f"Error logging in: {e}")
        return jsonify({'error': str(e)}), 500

# ------------------------------------------------------------------------------
# Auth check endpoint.
# ------------------------------------------------------------------------------
@app.route('/api/auth', methods=['GET'])
@require_auth
def auth():
    return jsonify({
        'status': 'authenticated',
        'user': {
            'id': request.user.id,
            'email': request.user.email
        }
    })

# ------------------------------------------------------------------------------
# Save Content Endpoint: now uses the session-based user.
# ------------------------------------------------------------------------------
@app.route('/api/save', methods=['POST'])
@require_auth
def save_content():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        print(data)
        request_content = data.get('content')
        request_tags = data.get('tags')

        if request_content.get('type') == 'text':
            text_handler.add_text(
                user_id=request.user.id,  # Using authenticated user's ID from the session.
                content=request_content.get('data'),
                meta={
                    'tags': request_tags,
                    'email': request.user.email,
                    'type': 'text'
                }
            )
        elif request_content.get('type') == 'image':
            image_handler.add_image(
                user_id=request.user.id,
                image_path=request_content.get('path'),
                metadata={
                    'tags': request_tags,
                    'email': request.user.email,
                    'type': 'image'
                }
            )
        elif request_content.get('type') == 'audio':
            audio_handler.add_audio(
                user_id=request.user.id,
                audio_path=request_content.get('path'),
                metadata={
                    'tags': request_tags,
                    'email': request.user.email,
                    'type': 'audio'
                }
            )
        else:
            return jsonify({'error': 'Unsupported content type'}), 400

        return jsonify({
            'status': 'success',
            'message': 'Content saved successfully'
        })

    except Exception as e:
        print(f"Error saving content: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# ------------------------------------------------------------------------------
# Search Content Endpoint: now requires a logged-in user.
# ------------------------------------------------------------------------------
@app.route('/api/search', methods=['GET'])
@require_auth
def search_content():
    try:
        query = request.args.get('query')
        if not query:
            return jsonify({'error': 'No query provided'}), 400

        types_param = request.args.get('types')
        types = types_param.split(',') if types_param else None

        # For example, search only in text data if specified.
        if types and 'text' in types:
            text_results = text_handler.search_texts(
                user_id=request.user.id,
                query=query
            )
            print(f"Text results: {text_results}")

        print(f"Searching for: {query}")
        print(f"Types: {types}")
        return jsonify({"results": "PLACEHOLDER"})  # Replace with actual search results.
    except Exception as e:
        print(f"Error searching content: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/')
def home():
    return jsonify({'status': 'Server is running'})

if __name__ == '__main__':
    print("Server starting on http://localhost:3030")
    app.run(host='0.0.0.0', port=3030, debug=True)
