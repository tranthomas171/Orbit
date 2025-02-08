from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
import requests
from data_handlers import TextHandler, ImageHandler, AudioHandler
import chromadb
from users.user_management import init_db, User, db

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
        "origins": ["chrome-extension://*"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

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

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No authorization header'}), 401

        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            return jsonify({'error': 'Invalid authorization header format'}), 401

        token_info = verify_google_token(token)
        
        if not token_info:
            return jsonify({'error': 'Invalid token'}), 401
        
        # Get or create user based on email
        email = token_info.get('email')
        if not email:
            return jsonify({'error': 'Email not found in token'}), 401
            
        user, created = User.get_or_create(email)
        
        # Add user to request context
        request.user = user
            
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def home():
    return jsonify({'status': 'Server is running'})

@app.route('/api/save', methods=['POST'])
@require_auth
def save_content():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        print(data)
        request_content = data.get('content')
        request_tags = data.get('tags')

        if request_content.get('type') == 'text':
            # Save text content using user.id from authenticated request
            text_handler.add_text(
                user_id=request.user.id,  # Using authenticated user's ID
                content=request_content.get('data'),
                meta={
                    'tags': request_tags,
                    'email': request.user.email,  # Optional: include email in metadata
                    'type': 'text'
                }
            )
        elif request_content.get('type') == 'image':
            # Handle image content
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
            # Handle audio content
            audio_handler.add_audio(
                user_id=request.user.id,
                audio_path=request_content.get('path'),
                metadata={
                    'tags': request_tags,
                    'email': request.user.email,
                    'type': 'audio'
                }
            )
        
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
@app.route('/api/search', methods=['GET'])
#@require_auth
def search_content():
    try:
        query = request.args.get('query')
        types = request.args.get('types').split(',') if request.args.get('types') else None
        # If no user is authenticated, testing user is created
        if not hasattr(request, 'user') or not request.user:
            request.user = User.get_or_create("ethan.wanq@gmail.com")[0]

        if 'text' in types:
            # Search text content
            text_results = text_handler.search_texts(
                user_id=request.user.id,  # Using authenticated user's ID
                query=query
            )
            print(f"Text results: {text_results}")

        if not query:
            return jsonify({'error': 'No query provided'}), 400

        print(f"Searching for: {query}")
        print(f"Types: {types}")
        return jsonify({"results": "PLACEHGOLDER"})
    except Exception as e:
        print(f"Error searching content: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    print("Server starting on http://localhost:3030")
    app.run(host='0.0.0.0', port=3030, debug=True)