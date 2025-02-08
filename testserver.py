from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
import requests
import os

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["chrome-extension://*"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
def verify_google_token(token):
    try:
        response = requests.get(
            f'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token={token}'
        )
        if response.status_code == 200:
            print("RFEKGTRKGOKRGOREKGORKFREKOKFWEKF")
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
            
        return f(*args, **kwargs)
    return decorated_function

# Test route to verify server is running
@app.route('/')
def home():
    return jsonify({'status': 'Server is running'})

# Main save endpoint
@app.route('/api/save', methods=['POST'])
@require_auth
def save_content():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Here you would normally save the data to your database
        print(f"Received data: {data}")
        
        return jsonify({
            'status': 'success',
            'message': 'Content saved successfully'
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    print("Server starting on http://localhost:6000")
    app.run(host='0.0.0.0', port=3030, debug=True)