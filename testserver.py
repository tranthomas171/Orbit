from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import requests
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
GOOGLE_OAUTH2_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
JWT_SECRET = 'your-secret-key'  # Change this to a secure secret key
GOOGLE_CLIENT_ID = 'your-client-id.apps.googleusercontent.com'  # Your Google Client ID

# In-memory user storage (replace with a database in production)
users = {}

def verify_google_token(token):
    try:
        # Get user info from Google
        response = requests.get(
            GOOGLE_OAUTH2_USERINFO_URL,
            headers={'Authorization': f'Bearer {token}'}
        )
        if response.status_code != 200:
            return None
        
        user_info = response.json()
        
        # Verify that the token was intended for your app
        if 'aud' in user_info and user_info['aud'] != GOOGLE_CLIENT_ID:
            return None
        
        return user_info
    except Exception as e:
        print(f"Error verifying Google token: {e}")
        return None

def create_jwt_token(user_id, email):
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        
        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            request.user = payload
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
    
    return decorated

@app.route('/api/auth/google', methods=['POST'])
def google_auth():
    data = request.get_json()
    google_token = data.get('google_token')
    
    if not google_token:
        return jsonify({'error': 'No token provided'}), 400
    
    user_info = verify_google_token(google_token)
    if not user_info:
        return jsonify({'error': 'Invalid Google token'}), 401
    
    email = user_info.get('email')
    if not email:
        return jsonify({'error': 'Email not found in token'}), 400
    
    # Create or update user
    if email not in users:
        users[email] = {
            'email': email,
            'name': user_info.get('name'),
            'picture': user_info.get('picture')
        }
    
    # Create JWT token
    jwt_token = create_jwt_token(email, email)
    
    return jsonify({
        'token': jwt_token,
        'user': users[email]
    })

@app.route('/api/auth/verify', methods=['GET'])
@require_auth
def verify_token():
    return jsonify({'valid': True, 'user': request.user})

@app.route('/api/save', methods=['POST'])
@require_auth
def save_data():
    data = request.get_json()
    # Add user information to the saved data
    data['user_email'] = request.user['email']
    # Here you would typically save this to a database
    print(f"Saving data for user {request.user['email']}: {data}")
    return jsonify({'success': True, 'message': 'Data saved successfully'})

if __name__ == '__main__':
    app.run(port=5000)