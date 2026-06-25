# SAPMS — Student Academic Performance Monitoring System

A full-stack web application for tracking student grades, attendance, and
automatically flagging at-risk students. Built with **Python (Flask)**,
**MySQL**, and vanilla **HTML / CSS / JavaScript** — each layer kept in its
own file so the project is easy to read, grade, and extend.

## 📁 Project Structure

```
sapms/
├── app.py                  # Flask backend — routes & REST API
├── schema.sql               # MySQL database schema + seed data
├── requirements.txt          # Python dependencies
├── .env.example               # Template for DB credentials
├── templates/
│   └── index.html              # Main HTML page (Jinja2 template)
└── static/
    ├── css/
    │   └── style.css            # All styling
    └── js/
        └── app.js                # All frontend logic (calls the API)
```

This separation means:
- **app.py** — Python / business logic / database queries
- **schema.sql** — pure SQL / database language
- **index.html** — markup only, no inline styles or scripts
- **style.css** — pure CSS
- **app.js** — pure JavaScript, communicates with the backend via `fetch()`

## 🛠️ Setup Instructions

### 1. Install MySQL and create the database
Make sure MySQL Server is installed and running, then import the schema:

```bash
mysql -u root -p < schema.sql
```

This creates the `sapms` database with two tables (`students`, `grades`)
and loads 12 sample students with sample grades so you can test immediately.

### 2. Install Python dependencies
It's recommended to use a virtual environment:

```bash
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure your database credentials
Copy the example env file and edit it with your MySQL password:

```bash
cp .env.example .env
# then edit .env and set DB_PASSWORD=your_actual_password
```

### 4. Run the application

```bash
python app.py
```

The app will start at **http://localhost:5000** — open that URL in your browser.

## 🔌 API Endpoints (for reference)

| Method | Endpoint                        | Description                          |
|--------|----------------------------------|---------------------------------------|
| GET    | `/api/students`                  | List all students with GPA & risk     |
| POST   | `/api/students`                  | Add a new student                     |
| DELETE | `/api/students/<id>`             | Remove a student                      |
| GET    | `/api/students/<id>/profile`     | Get one student's full profile        |
| GET    | `/api/grades`                    | List recent grade entries             |
| POST   | `/api/grades`                    | Record a new grade                    |
| GET    | `/api/dashboard/summary`         | KPI summary for the dashboard         |
| GET    | `/api/at-risk`                   | List of students flagged at-risk      |
| GET    | `/api/health`                    | Check server + DB connectivity        |

## 🎓 How At-Risk Detection Works

A student is automatically flagged **At-Risk** if either:
- Their GPA (average grade ÷ 25, scaled to 4.0) is **below 2.0**, or
- Their attendance is **below 75%**

This logic lives in `app.py` and is recalculated live from the database
every time the dashboard or student list is loaded — no manual flagging needed.

## 🧩 Notes for Presentation / Submission

- The **Use Case, Activity, and Sequence diagrams** from the project report
  map directly onto this implementation: e.g. the Sequence Diagram's
  "Teacher → Power BI UI → Data Model" flow corresponds here to
  "Browser → app.js (fetch) → Flask route → MySQL".
- The Star Schema described in the report is simplified here into two
  relational tables (`students`, `grades`) suited to a transactional web app;
  Power BI's star schema is more appropriate for a read-only analytics tool.
- You can extend this further by adding a login system, CSV export, or
  email alerts to parents when a student is flagged at-risk.
