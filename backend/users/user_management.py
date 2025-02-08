from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, default=datetime.utcnow)
    
    @staticmethod
    def get_or_create(email):
        """
        Get existing user or create new one based on email.
        
        Args:
            email (str): User's email from Google login
            
        Returns:
            Tuple[User, bool]: (user, created) where created is True if new user
        """
        user = User.query.filter_by(email=email).first()
        created = False
        
        if not user:
            user = User(email=email)
            db.session.add(user)
            db.session.commit()
            created = True
        else:
            # Update last login time
            user.last_login = datetime.utcnow()
            db.session.commit()
            
        return user, created

def init_db(app):
    """
    Initialize database with Flask app
    
    Args:
        app: Flask application instance
    """
    # Configure SQLAlchemy
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///orbit.db'  # Can be changed to PostgreSQL in production
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize SQLAlchemy with app
    db.init_app(app)
    
    # Create all tables
    with app.app_context():
        db.create_all()