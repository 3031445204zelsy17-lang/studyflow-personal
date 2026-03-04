"""
HKMU DSAI Course Planner - Flask Backend API Server
====================================================

A comprehensive REST API for managing courses, progress tracking,
course reviews, and study materials.

Author: Backend Developer
Version: 1.0.0
"""

import os
import sqlite3
import logging
import uuid
from datetime import datetime
from functools import wraps
from pathlib import Path

from flask import Flask, request, jsonify, send_file, g
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge

# ============================================================================
# Configuration
# ============================================================================

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / 'data'
UPLOADS_DIR = BASE_DIR / 'uploads'
DATABASE_PATH = DATA_DIR / 'courses.db'

# File upload settings
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip'}

# Create necessary directories
DATA_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

# ============================================================================
# Logging Setup
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(BASE_DIR / 'server.log')
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# Flask App Initialization
# ============================================================================

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Enable CORS for all domains on all routes
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# ============================================================================
# Database Helpers
# ============================================================================

def get_db():
    """Get database connection for current request context."""
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """Close database connection at end of request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Initialize database with required tables if they don't exist."""
    db = sqlite3.connect(DATABASE_PATH)
    cursor = db.cursor()
    
    # Courses table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            credits INTEGER DEFAULT 0,
            category TEXT,
            year INTEGER,
            semester TEXT,
            prerequisites TEXT
        )
    ''')
    
    # User courses progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT 'default_user',
            course_id INTEGER NOT NULL,
            status TEXT DEFAULT 'not_started',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses (id),
            UNIQUE(user_id, course_id)
        )
    ''')
    
    # Reviews table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            user_id TEXT DEFAULT 'default_user',
            author_name TEXT,
            author_year INTEGER,
            semester TEXT,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            content TEXT NOT NULL,
            helpful_count INTEGER DEFAULT 0,
            is_anonymous BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses (id)
        )
    ''')
    
    # Materials table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_size INTEGER,
            file_type TEXT,
            category TEXT,
            description TEXT,
            uploaded_by TEXT,
            uploader_id TEXT DEFAULT 'default_user',
            download_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses (id)
        )
    ''')
    
    # Review votes table (to prevent duplicate helpful votes)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS review_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER NOT NULL,
            user_id TEXT DEFAULT 'default_user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (review_id) REFERENCES reviews (id),
            UNIQUE(review_id, user_id)
        )
    ''')
    
    db.commit()
    db.close()
    logger.info("Database initialized successfully")


# ============================================================================
# Response Helpers
# ============================================================================

def success_response(data=None, message=None, status_code=200):
    """Create a standardized success response."""
    response = {"success": True}
    if data is not None:
        response["data"] = data
    if message is not None:
        response["message"] = message
    return jsonify(response), status_code


def error_response(error, code="ERROR", status_code=400):
    """Create a standardized error response."""
    return jsonify({
        "success": False,
        "error": error,
        "code": code
    }), status_code


# ============================================================================
# Validation Helpers
# ============================================================================

def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def validate_course_status(status):
    """Validate course status value."""
    valid_statuses = {'not_started', 'in_progress', 'completed'}
    return status in valid_statuses


def validate_rating(rating):
    """Validate review rating."""
    try:
        rating = int(rating)
        return 1 <= rating <= 5
    except (ValueError, TypeError):
        return False


# ============================================================================
# API Endpoints - Health & Info
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint.
    
    Returns:
        Server status and timestamp.
    """
    return success_response(
        data={
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        },
        message="Server is running"
    )


@app.route('/api/courses', methods=['GET'])
def get_courses():
    """
    Get all courses with optional filters.
    
    Query Parameters:
        year (int): Filter by year (1-4)
        category (str): Filter by category
        semester (str): Filter by semester
        
    Returns:
        List of courses matching the filters.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Build query with optional filters
        query = "SELECT * FROM courses WHERE 1=1"
        params = []
        
        year = request.args.get('year', type=int)
        if year is not None:
            query += " AND year = ?"
            params.append(year)
        
        category = request.args.get('category')
        if category:
            query += " AND category = ?"
            params.append(category)
        
        semester = request.args.get('semester')
        if semester:
            query += " AND semester = ?"
            params.append(semester)
        
        query += " ORDER BY year, code"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        courses = []
        for row in rows:
            course = dict(row)
            # Parse prerequisites JSON if stored as string
            if course.get('prerequisites'):
                try:
                    import json
                    course['prerequisites'] = json.loads(course['prerequisites'])
                except:
                    course['prerequisites'] = []
            else:
                course['prerequisites'] = []
            courses.append(course)
        
        return success_response(data={"courses": courses, "count": len(courses)})
    
    except Exception as e:
        logger.error(f"Error fetching courses: {str(e)}")
        return error_response("Failed to fetch courses", "DB_ERROR", 500)


@app.route('/api/courses/<int:course_id>', methods=['GET'])
def get_course(course_id):
    """
    Get single course details.
    
    Path Parameters:
        course_id (int): The course ID
        
    Returns:
        Course details including reviews summary.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Get course details
        cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        row = cursor.fetchone()
        
        if not row:
            return error_response("Course not found", "NOT_FOUND", 404)
        
        course = dict(row)
        
        # Parse prerequisites
        if course.get('prerequisites'):
            try:
                import json
                course['prerequisites'] = json.loads(course['prerequisites'])
            except:
                course['prerequisites'] = []
        else:
            course['prerequisites'] = []
        
        # Get review statistics
        cursor.execute('''
            SELECT COUNT(*) as review_count, AVG(rating) as avg_rating 
            FROM reviews WHERE course_id = ?
        ''', (course_id,))
        stats = cursor.fetchone()
        course['review_count'] = stats['review_count'] or 0
        course['average_rating'] = round(stats['avg_rating'], 2) if stats['avg_rating'] else None
        
        return success_response(data=course)
    
    except Exception as e:
        logger.error(f"Error fetching course {course_id}: {str(e)}")
        return error_response("Failed to fetch course", "DB_ERROR", 500)


@app.route('/api/courses/stats/summary', methods=['GET'])
def get_course_stats():
    """
    Get degree statistics summary.
    
    Returns:
        Statistics including total courses, credits, categories, etc.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Total courses
        cursor.execute("SELECT COUNT(*) as count FROM courses")
        total_courses = cursor.fetchone()['count']
        
        # Total credits
        cursor.execute("SELECT SUM(credits) as total FROM courses")
        total_credits = cursor.fetchone()['total'] or 0
        
        # Courses by year
        cursor.execute('''
            SELECT year, COUNT(*) as count, SUM(credits) as credits 
            FROM courses GROUP BY year ORDER BY year
        ''')
        by_year = [dict(row) for row in cursor.fetchall()]
        
        # Courses by category
        cursor.execute('''
            SELECT category, COUNT(*) as count, SUM(credits) as credits 
            FROM courses GROUP BY category
        ''')
        by_category = [dict(row) for row in cursor.fetchall()]
        
        # User progress stats
        user_id = request.args.get('user_id', 'default_user')
        cursor.execute('''
            SELECT status, COUNT(*) as count 
            FROM user_courses WHERE user_id = ? GROUP BY status
        ''', (user_id,))
        progress_stats = {row['status']: row['count'] for row in cursor.fetchall()}
        
        return success_response(data={
            "total_courses": total_courses,
            "total_credits": total_credits,
            "by_year": by_year,
            "by_category": by_category,
            "user_progress": progress_stats
        })
    
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        return error_response("Failed to fetch statistics", "DB_ERROR", 500)


# ============================================================================
# API Endpoints - Progress Tracking
# ============================================================================

@app.route('/api/progress', methods=['GET'])
def get_progress():
    """
    Get user's course progress.
    
    Query Parameters:
        user_id (str): User identifier (default: 'default_user')
        
    Returns:
        List of courses with their progress status.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        user_id = request.args.get('user_id', 'default_user')
        
        cursor.execute('''
            SELECT c.*, uc.status, uc.updated_at
            FROM courses c
            LEFT JOIN user_courses uc ON c.id = uc.course_id AND uc.user_id = ?
            ORDER BY c.year, c.code
        ''', (user_id,))
        
        rows = cursor.fetchall()
        progress_list = []
        
        for row in rows:
            item = dict(row)
            # Set default status if not set
            if not item.get('status'):
                item['status'] = 'not_started'
            progress_list.append(item)
        
        return success_response(data={
            "user_id": user_id,
            "progress": progress_list,
            "count": len(progress_list)
        })
    
    except Exception as e:
        logger.error(f"Error fetching progress for user {user_id}: {str(e)}")
        return error_response("Failed to fetch progress", "DB_ERROR", 500)


@app.route('/api/progress', methods=['POST'])
def update_progress():
    """
    Update course status for a user.
    
    Request Body:
        course_id (int): The course ID
        status (str): One of 'not_started', 'in_progress', 'completed'
        user_id (str, optional): User identifier
        
    Returns:
        Updated progress record.
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Request body required", "INVALID_INPUT", 400)
        
        course_id = data.get('course_id')
        status = data.get('status')
        user_id = data.get('user_id', 'default_user')
        
        # Validation
        if not course_id:
            return error_response("course_id is required", "MISSING_FIELD", 400)
        
        if not status:
            return error_response("status is required", "MISSING_FIELD", 400)
        
        if not validate_course_status(status):
            return error_response(
                f"Invalid status. Must be one of: not_started, in_progress, completed",
                "INVALID_STATUS", 400
            )
        
        db = get_db()
        cursor = db.cursor()
        
        # Verify course exists
        cursor.execute("SELECT id FROM courses WHERE id = ?", (course_id,))
        if not cursor.fetchone():
            return error_response("Course not found", "NOT_FOUND", 404)
        
        # Insert or update progress
        cursor.execute('''
            INSERT INTO user_courses (user_id, course_id, status, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, course_id) 
            DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
        ''', (user_id, course_id, status))
        
        db.commit()
        
        logger.info(f"Progress updated: user={user_id}, course={course_id}, status={status}")
        
        return success_response(
            data={"course_id": course_id, "status": status, "user_id": user_id},
            message="Progress updated successfully"
        )
    
    except Exception as e:
        logger.error(f"Error updating progress: {str(e)}")
        return error_response("Failed to update progress", "DB_ERROR", 500)


# ============================================================================
# API Endpoints - Reviews
# ============================================================================

@app.route('/api/courses/<int:course_id>/reviews', methods=['GET'])
def get_reviews(course_id):
    """
    Get reviews for a course.
    
    Path Parameters:
        course_id (int): The course ID
        
    Query Parameters:
        sort (str): Sort by 'newest', 'highest', 'lowest', 'helpful'
        limit (int): Maximum number of reviews to return
        
    Returns:
        List of reviews for the course.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Verify course exists
        cursor.execute("SELECT id FROM courses WHERE id = ?", (course_id,))
        if not cursor.fetchone():
            return error_response("Course not found", "NOT_FOUND", 404)
        
        # Build query with sorting
        sort = request.args.get('sort', 'newest')
        order_clause = {
            'newest': 'created_at DESC',
            'highest': 'rating DESC, created_at DESC',
            'lowest': 'rating ASC, created_at DESC',
            'helpful': 'helpful_count DESC, created_at DESC'
        }.get(sort, 'created_at DESC')
        
        query = f'''
            SELECT id, course_id, author_name, author_year, semester,
                   rating, content, helpful_count, is_anonymous, created_at
            FROM reviews WHERE course_id = ? ORDER BY {order_clause}
        '''
        
        limit = request.args.get('limit', type=int)
        if limit:
            query += f" LIMIT {limit}"
        
        cursor.execute(query, (course_id,))
        rows = cursor.fetchall()
        
        reviews = []
        for row in rows:
            review = dict(row)
            # Hide author name if anonymous
            if review.get('is_anonymous'):
                review['author_name'] = 'Anonymous'
            reviews.append(review)
        
        return success_response(data={
            "course_id": course_id,
            "reviews": reviews,
            "count": len(reviews)
        })
    
    except Exception as e:
        logger.error(f"Error fetching reviews for course {course_id}: {str(e)}")
        return error_response("Failed to fetch reviews", "DB_ERROR", 500)


@app.route('/api/courses/<int:course_id>/reviews', methods=['POST'])
def add_review(course_id):
    """
    Add a review for a course.
    
    Path Parameters:
        course_id (int): The course ID
        
    Request Body:
        author_name (str): Reviewer's name
        author_year (int): Reviewer's year of study
        semester (str): Semester when course was taken
        rating (int): Rating from 1-5
        content (str): Review content
        is_anonymous (bool): Whether to show as anonymous
        
    Returns:
        Created review record.
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Request body required", "INVALID_INPUT", 400)
        
        # Required fields
        rating = data.get('rating')
        content = data.get('content', '').strip()
        
        if rating is None:
            return error_response("rating is required", "MISSING_FIELD", 400)
        
        if not content:
            return error_response("content is required", "MISSING_FIELD", 400)
        
        if not validate_rating(rating):
            return error_response("rating must be between 1 and 5", "INVALID_RATING", 400)
        
        # Optional fields
        author_name = data.get('author_name', 'Anonymous')
        author_year = data.get('author_year')
        semester = data.get('semester')
        is_anonymous = data.get('is_anonymous', False)
        user_id = data.get('user_id', 'default_user')
        
        db = get_db()
        cursor = db.cursor()
        
        # Verify course exists
        cursor.execute("SELECT id FROM courses WHERE id = ?", (course_id,))
        if not cursor.fetchone():
            return error_response("Course not found", "NOT_FOUND", 404)
        
        # Insert review
        cursor.execute('''
            INSERT INTO reviews 
            (course_id, user_id, author_name, author_year, semester, rating, content, is_anonymous)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (course_id, user_id, author_name, author_year, semester, rating, content, is_anonymous))
        
        review_id = cursor.lastrowid
        db.commit()
        
        logger.info(f"Review added: course={course_id}, review_id={review_id}")
        
        return success_response(
            data={
                "id": review_id,
                "course_id": course_id,
                "rating": rating,
                "content": content,
                "author_name": "Anonymous" if is_anonymous else author_name
            },
            message="Review added successfully",
            status_code=201
        )
    
    except Exception as e:
        logger.error(f"Error adding review: {str(e)}")
        return error_response("Failed to add review", "DB_ERROR", 500)


@app.route('/api/reviews/<int:review_id>/helpful', methods=['POST'])
def mark_helpful(review_id):
    """
    Mark a review as helpful.
    
    Path Parameters:
        review_id (int): The review ID
        
    Request Body:
        user_id (str, optional): User identifier
        
    Returns:
        Updated helpful count.
    """
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id', 'default_user')
        
        db = get_db()
        cursor = db.cursor()
        
        # Verify review exists
        cursor.execute("SELECT id FROM reviews WHERE id = ?", (review_id,))
        if not cursor.fetchone():
            return error_response("Review not found", "NOT_FOUND", 404)
        
        # Check if user already voted
        cursor.execute(
            "SELECT id FROM review_votes WHERE review_id = ? AND user_id = ?",
            (review_id, user_id)
        )
        if cursor.fetchone():
            return error_response("You have already marked this review as helpful", "ALREADY_VOTED", 409)
        
        # Add vote record
        cursor.execute(
            "INSERT INTO review_votes (review_id, user_id) VALUES (?, ?)",
            (review_id, user_id)
        )
        
        # Increment helpful count
        cursor.execute(
            "UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?",
            (review_id,)
        )
        
        # Get updated count
        cursor.execute(
            "SELECT helpful_count FROM reviews WHERE id = ?",
            (review_id,)
        )
        helpful_count = cursor.fetchone()['helpful_count']
        
        db.commit()
        
        logger.info(f"Review marked helpful: review_id={review_id}, user={user_id}")
        
        return success_response(
            data={"review_id": review_id, "helpful_count": helpful_count},
            message="Review marked as helpful"
        )
    
    except Exception as e:
        logger.error(f"Error marking review helpful: {str(e)}")
        return error_response("Failed to mark review as helpful", "DB_ERROR", 500)


# ============================================================================
# API Endpoints - Materials
# ============================================================================

@app.route('/api/courses/<int:course_id>/materials', methods=['GET'])
def get_materials(course_id):
    """
    Get materials for a course.
    
    Path Parameters:
        course_id (int): The course ID
        
    Query Parameters:
        category (str): Filter by category
        
    Returns:
        List of materials for the course.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Verify course exists
        cursor.execute("SELECT id FROM courses WHERE id = ?", (course_id,))
        if not cursor.fetchone():
            return error_response("Course not found", "NOT_FOUND", 404)
        
        query = "SELECT * FROM materials WHERE course_id = ?"
        params = [course_id]
        
        category = request.args.get('category')
        if category:
            query += " AND category = ?"
            params.append(category)
        
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        materials = [dict(row) for row in rows]
        
        return success_response(data={
            "course_id": course_id,
            "materials": materials,
            "count": len(materials)
        })
    
    except Exception as e:
        logger.error(f"Error fetching materials for course {course_id}: {str(e)}")
        return error_response("Failed to fetch materials", "DB_ERROR", 500)


@app.route('/api/courses/<int:course_id>/materials', methods=['POST'])
def upload_material(course_id):
    """
    Upload a material for a course.
    
    Path Parameters:
        course_id (int): The course ID
        
    Form Data:
        file (file): The file to upload
        category (str): Material category
        description (str): Material description
        uploaded_by (str): Uploader name
        
    Returns:
        Created material record.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Verify course exists
        cursor.execute("SELECT id FROM courses WHERE id = ?", (course_id,))
        if not cursor.fetchone():
            return error_response("Course not found", "NOT_FOUND", 404)
        
        # Check if file is present
        if 'file' not in request.files:
            return error_response("No file provided", "MISSING_FILE", 400)
        
        file = request.files['file']
        
        if file.filename == '':
            return error_response("No file selected", "EMPTY_FILE", 400)
        
        # Validate file type
        if not allowed_file(file.filename):
            return error_response(
                f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
                "INVALID_FILE_TYPE", 400
            )
        
        # Generate unique filename
        original_filename = secure_filename(file.filename)
        file_ext = original_filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
        
        # Save file
        file_path = UPLOADS_DIR / unique_filename
        file.save(str(file_path))
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Get form data
        category = request.form.get('category', 'general')
        description = request.form.get('description', '')
        uploaded_by = request.form.get('uploaded_by', 'Anonymous')
        uploader_id = request.form.get('user_id', 'default_user')
        
        # Save to database
        cursor.execute('''
            INSERT INTO materials 
            (course_id, filename, original_name, file_size, file_type, category, description, uploaded_by, uploader_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (course_id, unique_filename, original_filename, file_size, file_ext, 
              category, description, uploaded_by, uploader_id))
        
        material_id = cursor.lastrowid
        db.commit()
        
        logger.info(f"Material uploaded: course={course_id}, material_id={material_id}, file={original_filename}")
        
        return success_response(
            data={
                "id": material_id,
                "course_id": course_id,
                "original_name": original_filename,
                "file_size": file_size,
                "file_type": file_ext,
                "category": category,
                "description": description
            },
            message="Material uploaded successfully",
            status_code=201
        )
    
    except RequestEntityTooLarge:
        return error_response(f"File too large. Maximum size: {MAX_CONTENT_LENGTH // (1024*1024)}MB", "FILE_TOO_LARGE", 413)
    
    except Exception as e:
        logger.error(f"Error uploading material: {str(e)}")
        return error_response("Failed to upload material", "UPLOAD_ERROR", 500)


@app.route('/api/materials/<int:material_id>/download', methods=['GET'])
def download_material(material_id):
    """
    Download a material.
    
    Path Parameters:
        material_id (int): The material ID
        
    Returns:
        File download response.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Get material info
        cursor.execute("SELECT * FROM materials WHERE id = ?", (material_id,))
        material = cursor.fetchone()
        
        if not material:
            return error_response("Material not found", "NOT_FOUND", 404)
        
        file_path = UPLOADS_DIR / material['filename']
        
        if not file_path.exists():
            return error_response("File not found on server", "FILE_NOT_FOUND", 404)
        
        # Increment download count
        cursor.execute(
            "UPDATE materials SET download_count = download_count + 1 WHERE id = ?",
            (material_id,)
        )
        db.commit()
        
        logger.info(f"Material downloaded: material_id={material_id}, file={material['original_name']}")
        
        return send_file(
            str(file_path),
            as_attachment=True,
            download_name=material['original_name']
        )
    
    except Exception as e:
        logger.error(f"Error downloading material: {str(e)}")
        return error_response("Failed to download material", "DOWNLOAD_ERROR", 500)


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return error_response("Endpoint not found", "NOT_FOUND", 404)


@app.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors."""
    return error_response("Method not allowed", "METHOD_NOT_ALLOWED", 405)


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {str(error)}")
    return error_response("Internal server error", "INTERNAL_ERROR", 500)


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(error):
    """Handle file too large errors."""
    return error_response(
        f"File too large. Maximum size: {MAX_CONTENT_LENGTH // (1024*1024)}MB",
        "FILE_TOO_LARGE", 413
    )


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == '__main__':
    # Initialize database
    init_db()
    
    logger.info("=" * 60)
    logger.info("HKMU DSAI Course Planner API Server")
    logger.info("=" * 60)
    logger.info(f"Database: {DATABASE_PATH}")
    logger.info(f"Uploads directory: {UPLOADS_DIR}")
    logger.info(f"Max file size: {MAX_CONTENT_LENGTH // (1024*1024)}MB")
    logger.info("=" * 60)
    
    # Run server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
