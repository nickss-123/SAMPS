"""
SAPMS - Student Academic Performance Monitoring System
Flask backend application (app.py)

Run with:  python app.py
Requires:  MySQL server running, schema.sql imported, .env configured
"""

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ── Database connection pool ──
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "sapms"),
}

try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="sapms_pool",
        pool_size=5,
        **db_config
    )
except mysql.connector.Error as err:
    print(f"⚠️  Could not create connection pool: {err}")
    connection_pool = None


def get_db():
    """Get a connection from the pool."""
    if connection_pool is None:
        raise RuntimeError("Database connection pool is not available.")
    return connection_pool.get_connection()


def gpa_from_avg(avg_score):
    """Convert a 0-100 average score to a 0-4 GPA scale."""
    if avg_score is None:
        return None
    return round(avg_score / 25, 2)


# ============================================================
#  PAGE ROUTES (serve HTML templates)
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


# ============================================================
#  API ROUTES — STUDENTS
# ============================================================

@app.route("/api/students", methods=["GET"])
def get_students():
    """Return all students with computed GPA and risk status."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT s.id, s.name, s.class, s.gender, s.attendance,
                   ROUND(AVG(g.score), 1) AS avg_score,
                   COUNT(g.id) AS grade_count
            FROM students s
            LEFT JOIN grades g ON g.student_id = s.id
            GROUP BY s.id
            ORDER BY s.name ASC
        """)
        rows = cursor.fetchall()
        students = []
        for r in rows:
            gpa = gpa_from_avg(r["avg_score"])
            at_risk = (gpa is not None and gpa < 2.0) or r["attendance"] < 75
            students.append({
                "id": r["id"],
                "name": r["name"],
                "class": r["class"],
                "gender": r["gender"],
                "attendance": r["attendance"],
                "gpa": gpa,
                "grade_count": r["grade_count"],
                "at_risk": at_risk
            })
        return jsonify(students)
    finally:
        cursor.close()
        conn.close()


@app.route("/api/students", methods=["POST"])
def add_student():
    """Create a new student."""
    data = request.get_json()
    name = (data.get("name") or "").strip()
    cls = data.get("class")
    gender = data.get("gender")
    attendance = data.get("attendance")

    if not name or not cls or not gender or attendance is None:
        return jsonify({"error": "Missing required fields."}), 400
    try:
        attendance = int(attendance)
        if not (0 <= attendance <= 100):
            raise ValueError
    except ValueError:
        return jsonify({"error": "Attendance must be a number between 0 and 100."}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO students (name, class, gender, attendance) VALUES (%s, %s, %s, %s)",
            (name, cls, gender, attendance)
        )
        conn.commit()
        return jsonify({"id": cursor.lastrowid, "message": "Student added successfully."}), 201
    finally:
        cursor.close()
        conn.close()


@app.route("/api/students/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    """Remove a student (cascades to delete their grades)."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM students WHERE id = %s", (student_id,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Student not found."}), 404
        return jsonify({"message": "Student removed."})
    finally:
        cursor.close()
        conn.close()


@app.route("/api/students/<int:student_id>/profile", methods=["GET"])
def student_profile(student_id):
    """Return a single student's detail profile including per-subject scores."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM students WHERE id = %s", (student_id,))
        student = cursor.fetchone()
        if not student:
            return jsonify({"error": "Student not found."}), 404

        cursor.execute("""
            SELECT subject, ROUND(AVG(score), 0) AS avg_score
            FROM grades
            WHERE student_id = %s
            GROUP BY subject
        """, (student_id,))
        subjects = cursor.fetchall()

        cursor.execute("""
            SELECT ROUND(AVG(score), 1) AS avg_score
            FROM grades WHERE student_id = %s
        """, (student_id,))
        overall = cursor.fetchone()
        gpa = gpa_from_avg(overall["avg_score"])

        return jsonify({
            "id": student["id"],
            "name": student["name"],
            "class": student["class"],
            "gender": student["gender"],
            "attendance": student["attendance"],
            "gpa": gpa,
            "at_risk": (gpa is not None and gpa < 2.0) or student["attendance"] < 75,
            "subjects": [{"subject": s["subject"], "score": int(s["avg_score"])} for s in subjects]
        })
    finally:
        cursor.close()
        conn.close()


# ============================================================
#  API ROUTES — GRADES
# ============================================================

@app.route("/api/grades", methods=["GET"])
def get_grades():
    """Return recent grade entries (most recent first)."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT g.id, g.subject, g.assessment_type, g.score, g.entered_at,
                   s.id AS student_id, s.name AS student_name, s.class AS student_class
            FROM grades g
            JOIN students s ON s.id = g.student_id
            ORDER BY g.entered_at DESC, g.id DESC
            LIMIT 50
        """)
        return jsonify(cursor.fetchall())
    finally:
        cursor.close()
        conn.close()


@app.route("/api/grades", methods=["POST"])
def add_grade():
    """Record a new grade for a student."""
    data = request.get_json()
    student_id = data.get("student_id")
    subject = data.get("subject")
    assessment_type = data.get("assessment_type")
    score = data.get("score")

    if not all([student_id, subject, assessment_type]) or score is None:
        return jsonify({"error": "Missing required fields."}), 400
    try:
        score = int(score)
        if not (0 <= score <= 100):
            raise ValueError
    except ValueError:
        return jsonify({"error": "Score must be a number between 0 and 100."}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO grades (student_id, subject, assessment_type, score) VALUES (%s, %s, %s, %s)",
            (student_id, subject, assessment_type, score)
        )
        conn.commit()
        return jsonify({"id": cursor.lastrowid, "message": "Grade saved."}), 201
    finally:
        cursor.close()
        conn.close()


# ============================================================
#  API ROUTES — DASHBOARD / ANALYTICS
# ============================================================

@app.route("/api/dashboard/summary", methods=["GET"])
def dashboard_summary():
    """Return KPI summary, subject performance, heat map, and class breakdown."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        # Overall KPIs
        cursor.execute("SELECT AVG(score) AS avg_score FROM grades")
        avg_score_row = cursor.fetchone()
        avg_gpa = gpa_from_avg(avg_score_row["avg_score"])

        cursor.execute("SELECT AVG(attendance) AS avg_attend FROM students")
        avg_attend = round(cursor.fetchone()["avg_attend"] or 0)

        cursor.execute("""
            SELECT s.id, s.attendance, AVG(g.score) AS avg_score
            FROM students s LEFT JOIN grades g ON g.student_id = s.id
            GROUP BY s.id
        """)
        all_students = cursor.fetchall()
        at_risk_count = 0
        for s in all_students:
            gpa = gpa_from_avg(s["avg_score"])
            if (gpa is not None and gpa < 2.0) or s["attendance"] < 75:
                at_risk_count += 1

        cursor.execute("SELECT AVG(score) AS avg FROM grades")
        avg_assignment = round(cursor.fetchone()["avg"] or 0)

        # Subject performance
        cursor.execute("""
            SELECT subject, ROUND(AVG(score), 0) AS avg_score, COUNT(*) AS total,
                   SUM(CASE WHEN score < 50 THEN 1 ELSE 0 END) AS fails
            FROM grades GROUP BY subject
        """)
        subjects = cursor.fetchall()
        subject_data = []
        for s in subjects:
            fail_rate = round((s["fails"] / s["total"]) * 100) if s["total"] else 0
            subject_data.append({
                "subject": s["subject"],
                "avg_score": int(s["avg_score"]),
                "fail_rate": fail_rate
            })

        # Class breakdown
        cursor.execute("""
            SELECT class, COUNT(*) AS count, ROUND(AVG(attendance), 0) AS avg_attendance
            FROM students GROUP BY class ORDER BY class
        """)
        class_data = cursor.fetchall()

        return jsonify({
            "avg_gpa": avg_gpa,
            "avg_attendance": avg_attend,
            "avg_assignment_rate": avg_assignment,
            "at_risk_count": at_risk_count,
            "subjects": subject_data,
            "classes": class_data
        })
    finally:
        cursor.close()
        conn.close()


@app.route("/api/at-risk", methods=["GET"])
def at_risk_students():
    """Return students flagged as at-risk with reasons."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT s.id, s.name, s.class, s.attendance, AVG(g.score) AS avg_score
            FROM students s LEFT JOIN grades g ON g.student_id = s.id
            GROUP BY s.id
        """)
        rows = cursor.fetchall()
        result = []
        for r in rows:
            gpa = gpa_from_avg(r["avg_score"])
            reasons = []
            if gpa is not None and gpa < 2.0:
                reasons.append(f"Low GPA ({gpa})")
            if r["attendance"] < 75:
                reasons.append(f"Low Attendance ({r['attendance']}%)")
            if reasons:
                result.append({
                    "id": r["id"], "name": r["name"], "class": r["class"],
                    "gpa": gpa, "attendance": r["attendance"], "reasons": reasons
                })
        return jsonify(result)
    finally:
        cursor.close()
        conn.close()


@app.route("/api/health", methods=["GET"])
def health_check():
    """Simple health check endpoint to verify DB connectivity."""
    try:
        conn = get_db()
        conn.close()
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "database": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
