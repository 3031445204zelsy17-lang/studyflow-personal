const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 数据库初始化
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

db.serialize(() => {
    // 课程表
    db.run(`CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        credits INTEGER NOT NULL,
        category TEXT NOT NULL,
        level TEXT NOT NULL,
        year TEXT NOT NULL,
        term TEXT NOT NULL,
        description TEXT,
        prerequisite TEXT
    )`);

    // 评价表
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL,
        helpful INTEGER DEFAULT 0,
        FOREIGN KEY (course_id) REFERENCES courses(id)
    )`);

    // 资料表
    db.run(`CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size TEXT NOT NULL,
        file_type TEXT NOT NULL,
        uploader_name TEXT NOT NULL,
        upload_date TEXT NOT NULL,
        downloads INTEGER DEFAULT 0,
        FOREIGN KEY (course_id) REFERENCES courses(id)
    )`);

    // 用户进度表
    db.run(`CREATE TABLE IF NOT EXISTS user_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, course_id)
    )`);

    // 初始化课程数据
    initCourses();
});

// 初始化课程数据
function initCourses() {
    const courses = [
        // Year 1 Autumn
        { id: 'COMP1080SEF', code: 'COMP 1080SEF', title: 'Introduction to Computer Programming', credits: 3, category: 'Core', level: 'Foundation', year: '1', term: 'Autumn', description: 'This is intended to be a first course in computer programming. In this course, students will study how to write computer programs in the Python language to solve simple computing problems.', prerequisite: null },
        { id: 'IT1020SEF', code: 'IT 1020SEF', title: 'Computing Fundamentals', credits: 3, category: 'Core', level: 'Foundation', year: '1', term: 'Autumn', description: 'The aim of this course is to introduce a number of basic concepts concerning computing and information technology.', prerequisite: null },
        { id: 'MATH1410SEF', code: 'MATH 1410SEF', title: 'Algebra and Calculus', credits: 3, category: 'Core', level: 'Foundation', year: '1', term: 'Autumn', description: 'This course teaches fundamental concepts in calculus and linear algebra.', prerequisite: null },
        { id: 'GE1', code: 'GE 1', title: 'General Education Course 1', credits: 3, category: 'GE', level: 'Foundation', year: '1', term: 'Autumn', description: 'General education course.', prerequisite: null },
        { id: 'ENG1', code: 'ENG 1', title: 'English Enhancement Course 1', credits: 3, category: 'ENG', level: 'Foundation', year: '1', term: 'Autumn', description: 'English enhancement course.', prerequisite: null },
        
        // Year 1 Spring
        { id: 'COMP2090SEF', code: 'COMP 2090SEF', title: 'Data Structures, Algorithms & Problem Solving', credits: 3, category: 'Core', level: 'Middle', year: '1', term: 'Spring', description: 'As a sequel to COMP 1080SEF, the aim of this course is to facilitate students to acquire skills for writing larger programs effectively.', prerequisite: 'COMP1080SEF' },
        { id: 'IT1030SEF', code: 'IT 1030SEF', title: 'Introduction to Internet Application Development', credits: 3, category: 'Core', level: 'Foundation', year: '1', term: 'Spring', description: 'The aim of this course is to introduce the fundamental skills in web programming for developing internet applications.', prerequisite: null },
        { id: 'STAT1510SEF', code: 'STAT 1510SEF', title: 'Probability & Distributions', credits: 3, category: 'Core', level: 'Foundation', year: '1', term: 'Spring', description: 'This course is intended to provide conceptual understandings of Probability & Distributions.', prerequisite: null },
        { id: 'STAT2610SEF', code: 'STAT 2610SEF', title: 'Data Analytics with Applications', credits: 3, category: 'Core', level: 'Middle', year: '1', term: 'Spring', description: 'This course aims to introduce a range of topics and concepts related to the data science process.', prerequisite: null },
        { id: 'GE2', code: 'GE 2', title: 'General Education Course 2', credits: 3, category: 'GE', level: 'Foundation', year: '1', term: 'Spring', description: 'General education course.', prerequisite: null },
        { id: 'ENG2', code: 'ENG 2', title: 'English Enhancement Course 2', credits: 3, category: 'ENG', level: 'Foundation', year: '1', term: 'Spring', description: 'English enhancement course.', prerequisite: null },
        
        // Year 2 Autumn
        { id: 'COMP2020SEF', code: 'COMP 2020SEF', title: 'Java Programming Fundamentals', credits: 3, category: 'Core', level: 'Middle', year: '2', term: 'Autumn', description: 'The aim of this course is to provide students with sound foundation in software development using the object-oriented programming language Java.', prerequisite: null },
        { id: 'COMP2640SEF', code: 'COMP 2640SEF', title: 'Discrete Mathematics', credits: 3, category: 'Core', level: 'Middle', year: '2', term: 'Autumn', description: 'The aim of this course is to lay the foundation of discrete mathematics of students which will be used in studying other more advanced programming courses.', prerequisite: null },
        { id: 'MATH2150SEF', code: 'MATH 2150SEF', title: 'Linear Algebra', credits: 3, category: 'Core', level: 'Middle', year: '2', term: 'Autumn', description: 'This course is intended to provide conceptual understandings and computational techniques of linear algebra.', prerequisite: null },
        { id: 'STAT2510SEF', code: 'STAT 2510SEF', title: 'Statistical Data Analysis', credits: 3, category: 'Core', level: 'Middle', year: '2', term: 'Autumn', description: 'Statistical data analysis course.', prerequisite: null },
        
        // Year 2 Spring
        { id: 'COMP2030SEF', code: 'COMP 2030SEF', title: 'Intermediate Java Programming & UI Design', credits: 3, category: 'Core', level: 'Middle', year: '2', term: 'Spring', description: 'This course aims to provide students with more knowledge in Java programming as well as an introduction to user interface design.', prerequisite: null },
        { id: 'IT2900SEF', code: 'IT 2900SEF', title: 'Human Computer Interaction & UX Design', credits: 3, category: 'Core', level: 'Middle', year: '2', term: 'Spring', description: 'This course introduces students to the key concepts, theories and best practices used by user experience engineers.', prerequisite: null },
        { id: 'STAT2520SEF', code: 'STAT 2520SEF', title: 'Applied Statistical Methods', credits: 3, category: 'Core', level: 'Middle', year: '2', term: 'Spring', description: 'Applied statistical methods course.', prerequisite: null },
        { id: 'STAT2630SEF', code: 'STAT 2630SEF', title: 'Big Data Analytics with Applications', credits: 3, category: 'Core', level: 'Middle', year: '2', term: 'Spring', description: 'Big data analytics course.', prerequisite: null },
        
        // Year 3 Autumn
        { id: 'COMP3130SEF', code: 'COMP 3130SEF', title: 'Mobile Application Programming', credits: 3, category: 'Core', level: 'Higher', year: '3', term: 'Autumn', description: 'The course aims to provide students with a foundation in designing and developing Android applications.', prerequisite: null },
        { id: 'COMP3200SEF', code: 'COMP 3200SEF', title: 'Database Management', credits: 3, category: 'Core', level: 'Higher', year: '3', term: 'Autumn', description: 'This course aims to provide an explanation of the concepts underlying all relational databases.', prerequisite: null },
        { id: 'COMP3500SEF', code: 'COMP 3500SEF', title: 'Software Engineering', credits: 3, category: 'Core', level: 'Higher', year: '3', term: 'Autumn', description: 'The course aims to develop in learners the terminology, notations and understanding needed for effective communication with team members during software engineering activities.', prerequisite: null },
        
        // Year 3 Spring
        { id: 'COMP3510SEF', code: 'COMP 3510SEF', title: 'Software Project Management', credits: 3, category: 'Core', level: 'Higher', year: '3', term: 'Spring', description: 'As a sequel to COMP 3500SEF, This course aims to develop in learners the know-how of project management recognized as good practices in software development.', prerequisite: 'COMP3500SEF' },
        { id: 'COMP3810SEF', code: 'COMP 3810SEF', title: 'Server-side Technologies and Cloud Computing', credits: 3, category: 'Core', level: 'Higher', year: '3', term: 'Spring', description: 'This course introduces some of the contemporary techniques, technologies and tools for designing, constructing and deploying flexible server-side Internet applications.', prerequisite: null },
        { id: 'COMP3920SEF', code: 'COMP 3920SEF', title: 'Machine Learning', credits: 3, category: 'Core', level: 'Higher', year: '3', term: 'Spring', description: 'This course aims to introduce students to the field of machine learning, and develop them to apply machine learning algorithms to real-world problems.', prerequisite: null },
        { id: 'STAT3110SEF', code: 'STAT 3110SEF', title: 'Time Series Analysis & Forecasting', credits: 3, category: 'Core', level: 'Higher', year: '3', term: 'Spring', description: 'Time series analysis course.', prerequisite: null },
        { id: 'STAT3660SEF', code: 'STAT 3660SEF', title: 'SAS Programming', credits: 3, category: 'Core', level: 'Higher', year: '3', term: 'Spring', description: 'SAS programming course.', prerequisite: null },
        
        // Year 3 Summer
        { id: 'MATH4950SEF', code: 'MATH 4950SEF', title: 'Professional Placement', credits: 3, category: 'Elective', level: 'Higher', year: '3', term: 'Summer', description: 'Professional placement course.', prerequisite: null },
        
        // Year 4 Autumn
        { id: 'COMP4330SEF', code: 'COMP 4330SEF', title: 'Advanced Programming & AI Algorithms', credits: 3, category: 'Core', level: 'Higher', year: '4', term: 'Autumn', description: 'This course aims to introduce basic concepts and algorithms of artificial intelligence (AI) and to facilitate students to develop advanced programming skills.', prerequisite: null },
        { id: 'COMP4610SEF', code: 'COMP 4610SEF', title: 'Data Science Project', credits: 6, category: 'Project', level: 'Higher', year: '4', term: 'Autumn', description: 'This is a project course. Students will attempt a final year project which should provide an opportunity to integrate knowledge and skills acquired in the programme of study.', prerequisite: null },
        { id: 'COMP4930SEF', code: 'COMP 4930SEF', title: 'Deep Learning', credits: 3, category: 'Core', level: 'Higher', year: '4', term: 'Autumn', description: 'Deep learning course.', prerequisite: null },
        { id: 'ELECTIVE1', code: 'ELECTIVE 1', title: 'Elective Course 1', credits: 3, category: 'Elective', level: 'Higher', year: '4', term: 'Autumn', description: 'Elective course.', prerequisite: null },
        
        // Year 4 Spring
        { id: 'COMP4210SEF', code: 'COMP 4210SEF', title: 'Advanced Database & Data Warehousing', credits: 3, category: 'Core', level: 'Higher', year: '4', term: 'Spring', description: 'As a sequel to COMP 3200SEF, this course aims to provide students with more advanced concepts of relational databases.', prerequisite: 'COMP3200SEF' },
        { id: 'COMP4600SEF', code: 'COMP 4600SEF', title: 'Advanced Topics in Data Mining', credits: 3, category: 'Core', level: 'Higher', year: '4', term: 'Spring', description: 'Advanced topics in data mining course.', prerequisite: null },
        { id: 'ELECTIVE2', code: 'ELECTIVE 2', title: 'Elective Course 2', credits: 3, category: 'Elective', level: 'Higher', year: '4', term: 'Spring', description: 'Elective course.', prerequisite: null },
        { id: 'ELECTIVE3', code: 'ELECTIVE 3', title: 'Elective Course 3', credits: 3, category: 'Elective', level: 'Higher', year: '4', term: 'Spring', description: 'Elective course.', prerequisite: null }
    ];

    const stmt = db.prepare(`INSERT OR IGNORE INTO courses (id, code, title, credits, category, level, year, term, description, prerequisite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    courses.forEach(course => {
        stmt.run(course.id, course.code, course.title, course.credits, course.category, course.level, course.year, course.term, course.description, course.prerequisite);
    });
    stmt.finalize();
    console.log('Courses initialized');
}

// 文件上传配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = uuidv4() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// API 路由

// 获取所有课程
app.get('/api/courses', (req, res) => {
    const { year, category } = req.query;
    let sql = 'SELECT * FROM courses';
    const params = [];
    
    if (year || category) {
        sql += ' WHERE';
        if (year) {
            sql += ' year = ?';
            params.push(year);
        }
        if (category) {
            if (year) sql += ' AND';
            sql += ' category = ?';
            params.push(category);
        }
    }
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 获取单个课程
app.get('/api/courses/:id', (req, res) => {
    db.get('SELECT * FROM courses WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Course not found' });
            return;
        }
        res.json(row);
    });
});

// 获取课程评价
app.get('/api/reviews/:courseId', (req, res) => {
    db.all('SELECT * FROM reviews WHERE course_id = ? ORDER BY date DESC', [req.params.courseId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 添加评价
app.post('/api/reviews', (req, res) => {
    const { course_id, student_name, rating, content } = req.body;
    const id = uuidv4();
    const date = new Date().toISOString();
    
    db.run('INSERT INTO reviews (id, course_id, student_name, rating, content, date) VALUES (?, ?, ?, ?, ?, ?)',
        [id, course_id, student_name, rating, content, date],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id, course_id, student_name, rating, content, date, helpful: 0 });
        }
    );
});

// 点赞评价
app.put('/api/reviews/:id/helpful', (req, res) => {
    db.run('UPDATE reviews SET helpful = helpful + 1 WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Review liked' });
    });
});

// 获取课程资料
app.get('/api/materials/:courseId', (req, res) => {
    db.all('SELECT * FROM materials WHERE course_id = ? ORDER BY upload_date DESC', [req.params.courseId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 上传资料
app.post('/api/materials', upload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    
    const { course_id, uploader_name } = req.body;
    const id = uuidv4();
    const upload_date = new Date().toISOString();
    
    db.run('INSERT INTO materials (id, course_id, file_name, file_path, file_size, file_type, uploader_name, upload_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, course_id, req.file.originalname, req.file.filename, formatFileSize(req.file.size), req.file.mimetype, uploader_name || 'Anonymous', upload_date],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id, course_id, file_name: req.file.originalname, file_size: formatFileSize(req.file.size), uploader_name: uploader_name || 'Anonymous', upload_date });
        }
    );
});

// 下载资料
app.get('/api/materials/download/:id', (req, res) => {
    db.get('SELECT * FROM materials WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        
        // 增加下载次数
        db.run('UPDATE materials SET downloads = downloads + 1 WHERE id = ?', [req.params.id]);
        
        const filePath = path.join(uploadsDir, row.file_path);
        res.download(filePath, row.file_name);
    });
});

// 获取用户进度
app.get('/api/progress/:userId', (req, res) => {
    db.all('SELECT * FROM user_progress WHERE user_id = ?', [req.params.userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 更新课程状态
app.post('/api/progress', (req, res) => {
    const { user_id, course_id, status } = req.body;
    const id = uuidv4();
    const updated_at = new Date().toISOString();
    
    db.run(`INSERT INTO user_progress (id, user_id, course_id, status, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, course_id) DO UPDATE SET status = ?, updated_at = ?`,
        [id, user_id, course_id, status, status, updated_at],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ user_id, course_id, status, updated_at });
        }
    );
});

// 获取进度统计
app.get('/api/progress/stats/:userId', (req, res) => {
    db.all('SELECT status, COUNT(*) as count FROM user_progress WHERE user_id = ? GROUP BY status', [req.params.userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const stats = { completed: 0, inProgress: 0, notStarted: 0 };
        rows.forEach(row => {
            if (row.status === 'completed') stats.completed = row.count;
            else if (row.status === 'in-progress') stats.inProgress = row.count;
            else stats.notStarted = row.count;
        });
        
        res.json(stats);
    });
});

// 辅助函数
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
