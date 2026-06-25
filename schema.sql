-- ============================================================
-- SAPMS - Student Academic Performance Monitoring System
-- MySQL Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS sapms;
USE sapms;

-- ── Students table ──
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    class VARCHAR(5) NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    attendance INT NOT NULL DEFAULT 100 CHECK (attendance BETWEEN 0 AND 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Grades table ──
CREATE TABLE IF NOT EXISTS grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject VARCHAR(60) NOT NULL,
    assessment_type ENUM('quiz','midterm','assignment','final') NOT NULL,
    score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
    entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Indexes for performance ──
CREATE INDEX idx_grades_student ON grades(student_id);
CREATE INDEX idx_students_class ON students(class);

-- ── Sample seed data ──
INSERT INTO students (name, class, gender, attendance) VALUES
('Aisha Malik',      'A', 'Female', 92),
('Carlos Rivera',    'A', 'Male',   68),
('Priya Nair',       'B', 'Female', 85),
('James Okonkwo',    'B', 'Male',   55),
('Lin Mei',          'C', 'Female', 96),
('Omar Hassan',      'C', 'Male',   78),
('Sophie Dupont',    'D', 'Female', 88),
('Marcus Tan',       'D', 'Male',   71),
('Fatima Al-Rashid', 'A', 'Female', 91),
('David Kim',        'B', 'Male',   60),
('Elena Petrova',    'C', 'Female', 83),
('Ahmed Saeed',      'D', 'Male',   74);

INSERT INTO grades (student_id, subject, assessment_type, score) VALUES
(1, 'Mathematics',        'midterm',    88),
(1, 'English',            'quiz',       75),
(1, 'Science',            'assignment', 90),
(2, 'Mathematics',        'midterm',    42),
(2, 'English',            'quiz',       58),
(3, 'Mathematics',        'final',      79),
(3, 'Science',            'midterm',    85),
(4, 'Mathematics',        'final',      34),
(4, 'History',            'quiz',       48),
(5, 'Computer Studies',   'assignment', 95),
(5, 'English',            'final',      88),
(6, 'History',            'midterm',    71),
(7, 'Science',            'final',      83),
(8, 'Mathematics',        'midterm',    62),
(9, 'English',            'final',      91),
(10,'Science',            'quiz',       45),
(11,'Computer Studies',   'assignment', 78),
(12,'Physical Education', 'assignment', 69);
