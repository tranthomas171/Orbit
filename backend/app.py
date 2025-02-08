from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS
from functools import wraps
import requests
from data_handlers import TextHandler, ImageHandler, AudioHandler
import chromadb
from users.user_management import init_db, User, db
from dotenv import load_dotenv
import os
import random
import base64

load_dotenv()

# Initialize ChromaDB client
chroma_path = "OrbitDB"
client = chromadb.PersistentClient(path=chroma_path)

# Initialize handlers
text_handler = TextHandler(client)
image_handler = ImageHandler(client)
audio_handler = AudioHandler(client)

app = Flask(__name__)
CORS(app, supports_credentials=True,resources={
    r"/api/*": {
        "origins": ["chrome-extension://*", "http://localhost:5173"],
        "methods": ["POST", "GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
app.config["SESSION_COOKIE_SECURE"] = False
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
            print(dict.keys(request_content))
            image_handler.add_image(
                user_id=request.user.id,
                image_data=request_content.get('data'),
                meta={
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

        # Determine which content types to search (default: all)
        types_param = request.args.get('types')
        if types_param:
            types = [t.strip().lower() for t in types_param.split(',')]
        else:
            types = ['text', 'image', 'audio']

        results = {}

        # Search text items if requested
        if 'text' in types:
            text_results = text_handler.search_texts(
                user_id=request.user.id,
                query=query
            )
            results['text'] = text_results

        # Search image items if requested
        if 'image' in types:
            image_results = image_handler.search_images(
                user_id=request.user.id,
                query=query
            )
            # Process the image search results:
            # The returned 'uris' field is a list of lists; for each URI, read the file
            # and convert its contents into a base64-encoded data URI.
            if image_results and "uris" in image_results:
                data_result = []  # this will mirror the structure of image_results["uris"]
                for uri_list in image_results["uris"]:
                    base64_images = []
                    for uri in uri_list:
                        if uri and os.path.exists(uri):
                            with open(uri, "rb") as f:
                                img_bytes = f.read()
                            # Determine the file extension for the MIME type.
                            ext = os.path.splitext(uri)[1][1:]  # remove the leading dot
                            base64_str = base64.b64encode(img_bytes).decode("utf-8")
                            base64_image = f"data:image/{ext};base64,{base64_str}"
                            base64_images.append(base64_image)
                        else:
                            base64_images.append(None)
                    data_result.append(base64_images)
                # Add the base64-encoded image data to the result under a new key.
                image_results["data"] = data_result

            results['image'] = image_results

        # Search audio items if requested
        if 'audio' in types:
            # Assuming your AudioHandler implements a similar method.
            audio_results = audio_handler.retrieve_audio(
                user_id=request.user.id,
                query=query
            )
            results['audio'] = audio_results

        print(f"Searching for: {query}")
        print(f"Types: {types}")

        return jsonify({"results": results})

    except Exception as e:
        print(f"Error searching content: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/')
def home():
    return jsonify({'status': 'Server is running'})

@app.route('/api/random', methods=['GET'])
@require_auth
def random_items():
    """
    Return a JSON response with N random items sampled from the user's stored items
    across texts, images, and audio. The number N can be provided via the 'n' query
    parameter (defaulting to 5 if not specified).
    """
    try:
        # Get the desired sample count from query parameters; default to 5 if not provided.
        n_param = request.args.get('n', '5')
        try:
            n = int(n_param)
        except ValueError:
            n = 5

        user_id = str(request.user.id)
        all_items = []

        # --- TEXT ITEMS ---
        text_collection = text_handler._get_user_collection(user_id)
        # Include metadatas, documents, and (optionally) uris.
        text_data = text_collection.get(include=["metadatas", "documents", "uris"])
        text_ids = text_data.get("ids", [])
        if text_ids:
            for idx, item_id in enumerate(text_ids):
                item = {
                    "id": item_id,
                    "document": text_data.get("documents", [])[idx],
                    "metadata": text_data.get("metadatas", [])[idx],
                    "type": "text"
                }
                all_items.append(item)

        # --- IMAGE ITEMS ---
        image_collection = image_handler._get_user_collection(user_id)
        # Retrieve metadatas, documents, and uris for images.
        image_data = image_collection.get(include=["metadatas", "documents", "uris"])
        image_ids = image_data.get("ids", [])
        if image_ids:
            for idx, item_id in enumerate(image_ids):
                metadata = image_data.get("metadatas", [])[idx]
                # Get the stored file path from metadata.
                file_path = metadata.get("file_path")
                base64_image = None
                if file_path and os.path.exists(file_path):
                    with open(file_path, "rb") as f:
                        img_bytes = f.read()
                    # Determine the file extension (without the dot)
                    ext = os.path.splitext(file_path)[1][1:]
                    # Encode the image bytes to a base64 string
                    base64_str = base64.b64encode(img_bytes).decode("utf-8")
                    # Build a data URI for the image
                    base64_image = f"data:image/{ext};base64,{base64_str}"
                item = {
                    "id": item_id,
                    "document": None,  # Not including raw binary data here.
                    "metadata": metadata,
                    "type": "image",
                    "data": base64_image,  # Include the base64-encoded image data.
                    "uri": file_path      # Optionally include the original file path.
                }
                all_items.append(item)

        # --- AUDIO ITEMS ---
        try:
            audio_collection = audio_handler._get_user_collection(user_id)
            audio_data = audio_collection.get(include=["metadatas", "documents", "uris"])
            audio_ids = audio_data.get("ids", [])
            if audio_ids:
                for idx, item_id in enumerate(audio_ids):
                    metadata = audio_data.get("metadatas", [])[idx]
                    item = {
                        "id": item_id,
                        "document": audio_data.get("documents", [])[idx],
                        "metadata": metadata,
                        "type": "audio",
                        "uri": metadata.get("file_path")
                    }
                    all_items.append(item)
        except Exception as e:
            # If the audio handler isn't properly set up or returns no items, log and skip it.
            print(f"Audio retrieval error: {e}")

        # --- SAMPLE RANDOM ITEMS ---
        if not all_items:
            return jsonify({
                "status": "success",
                "count": 0,
                "items": [],
                "message": "No stored items found for this user."
            })

        # If the total number of items is less than n, return all items.
        sampled_items = random.sample(all_items, min(n, len(all_items)))

        return jsonify({
            "status": "success",
            "count": len(sampled_items),
            "items": sampled_items
        })

    except Exception as e:
        print(f"Error retrieving random items: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    print("Server starting on http://localhost:3030")
    app.run(host='0.0.0.0', port=3030, debug=True)
