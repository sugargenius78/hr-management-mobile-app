
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');
let verificationCodes = {};

const app = express();
const PORT = 3000;

const sslOptions = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));


const db = new sqlite3.Database('./hr_system.db', (err) => {
    if (err) {
        console.error("Error connecting to database:", err.message);
    } else {
        console.log("Connected to the SQLite database.");
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT,
        department TEXT DEFAULT 'Unassigned',
        status TEXT DEFAULT 'Active',
        profile_pic TEXT,
        cover_pic TEXT,
        phone TEXT,
        city TEXT,
        zip TEXT,
        joined_date TEXT DEFAULT CURRENT_TIMESTAMP,
        team_id INTEGER
    )`, (err) => {
        if (!err) {
            db.get("SELECT count(*) as count FROM users", (err, row) => {
            });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        manager TEXT DEFAULT 'Unassigned',
        budget INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        department TEXT,
        status TEXT DEFAULT 'Active',
        deadline TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        title TEXT,
        assignee TEXT,
        status TEXT DEFAULT 'To Do',
        priority TEXT DEFAULT 'Medium',
        FOREIGN KEY(project_id) REFERENCES projects(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS leaves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_name TEXT,
        leave_type TEXT,
        start_date TEXT,
        end_date TEXT,
        reason TEXT,
        status TEXT DEFAULT 'Pending'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_name TEXT UNIQUE,
        department_name TEXT,
        team_lead TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    sender_name TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run("ALTER TABLE messages ADD COLUMN receiver_id INTEGER", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Database column 'receiver_id' already exists.");
            } else {
                console.error("Migration Error:", err.message);
            }
        } else {
            console.log("Successfully added 'receiver_id' column to messages table.");
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        content TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`ALTER TABLE users ADD COLUMN notif_prefs TEXT DEFAULT '{"leave":true,"deadlines":true,"registration":false,"tasks":true}'`, (err) => {
        if (!err) console.log("Added updated 'notif_prefs' column.");
    });

    db.run("ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Database column 'is_read' already exists.");
            } else {
                console.error("Migration Error (is_read):", err.message);
            }
        } else {
            console.log("Successfully added 'is_read' column to messages.");
        }
    });
});

app.get('/api/dashboard-stats', (req, res) => {
    const stats = {};

    db.serialize(() => {
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            stats.totalEmployees = row ? row.count : 0;
        });

        db.get("SELECT COUNT(*) as count FROM departments", (err, row) => {
            stats.totalDepartments = row ? row.count : 0;
        });

        db.get("SELECT COUNT(*) as count FROM tasks WHERE status != 'Done'", (err, row) => {
            stats.activeTasks = row ? row.count : 0;
        });

        db.all(`SELECT t.title, p.department, t.status 
                FROM tasks t 
                JOIN projects p ON t.project_id = p.id 
                ORDER BY t.id DESC LIMIT 5`, (err, rows) => {
            stats.recentTasks = rows || [];
            
    
        });

        db.all("SELECT title, department, deadline FROM projects LIMIT 2", (err, projects) => {
        stats.activeProjects = projects || [];
        res.json({ success: true, ...stats });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: "Database Error" });
        
        if (user && user.password === password) {
            res.json({ success: true, user: user });
        } else {
            res.status(401).json({ success: false, message: "Invalid email or password" });
        }
    });
});
app.post('/api/register', (req, res) => {
    const { name, email, password, role } = req.body;

    
    const sql = `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`;
    db.run(sql, [name, email, password, role], function(err) {
        if (err) return res.status(500).json({ success: false, message: "Database Error" });

        const newUserId = this.lastID;

        // 2. Create notification for Admins if a new Employee registers
        if (role === 'Employee') {
            
            db.all("SELECT id FROM users WHERE role = 'Admin'", [], (err, admins) => {
                if (err) return;

                admins.forEach(admin => {
                    
                    const notifSql = `INSERT INTO notifications (user_id, type, content, is_read) 
                                      VALUES (?, 'Registration', ?, 0)`;
                    db.run(notifSql, [admin.id, `New Employee Registered: ${name}`]);
                });
            });
        }
        

        res.json({ success: true, message: "User registered successfully" });
    });
});


app.post('/api/request-code', (req, res) => {
    const { email } = req.body;
    console.log("Password reset requested for:", email);

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err || !user) {
            return res.json({ success: false, message: "Email not found." });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        verificationCodes[email] = code;

        console.log("\n========================================");
        console.log(`[EMAIL SERVICE] To: ${email}`);
        console.log(`[EMAIL SERVICE] Your Verification Code is: ${code}`);
        console.log("========================================\n");
        
        res.json({ success: true });
    });
});

app.post('/api/verify-reset', (req, res) => {
    const { email, code, password } = req.body; 

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email or Password missing" });
    }

    const sql = `UPDATE users SET password = ? WHERE email = ?`;
    
    db.run(sql, [password, email], function(err) {
        if (err) {
            console.error("DB Update Error:", err);
            return res.status(500).json({ success: false });
        }
        
        if (this.changes > 0) {
            res.json({ success: true, message: "Password updated successfully!" });
        } else {
            res.status(404).json({ success: false, message: "User not found" });
        }
    });
});


app.get('/api/users', (req, res) => {
    const sql = `
        SELECT u.id, u.name, u.email, u.role, u.department, t.team_name 
        FROM users u 
        LEFT JOIN teams t ON u.team_id = t.id
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

app.delete('/api/users/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM users WHERE id = ?", id, function(err) {
        if (err) return res.status(400).json({ "error": res.message });
        res.json({ message: "deleted", changes: this.changes });
    });
});

app.get('/api/departments', (req, res) => {
    const sql = `
        SELECT departments.id, departments.name, departments.manager, 
        COUNT(users.id) as emp_count 
        FROM departments 
        LEFT JOIN users ON users.department = departments.name 
        GROUP BY departments.id
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

app.post('/api/departments', (req, res) => {
    const { name, manager } = req.body;
    
    const deptManager = manager || 'Unassigned';

    const sql = "INSERT INTO departments (name, manager) VALUES (?, ?)";

    db.run(sql, [name, deptManager], function(err) {
        if (err) return res.json({ success: false, message: "Department already exists" });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/departments/:id', (req, res) => {
    db.run("DELETE FROM departments WHERE id = ?", req.params.id, function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "deleted", changes: this.changes });
    });
});

app.put('/api/departments/:id', (req, res) => {
    const { name, manager } = req.body;
    const id = req.params.id;
    
    const sql = "UPDATE departments SET name = ?, manager = ? WHERE id = ?";
    
    db.run(sql, [name, manager, id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "updated", changes: this.changes });
    });
});

app.get('/api/projects', (req, res) => {
    const sql = `
        SELECT p.*, 
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'Done') as completed_tasks
        FROM projects p
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

app.post('/api/projects', (req, res) => {
    const { title, department, deadline } = req.body;
    db.run("INSERT INTO projects (title, department, deadline) VALUES (?, ?, ?)", 
        [title, department, deadline], function(err) {
        res.json({ success: true, id: this.lastID });
    });
});

app.get('/api/tasks/:projectId', (req, res) => {
    const sql = "SELECT * FROM tasks WHERE project_id = ?";
    
    db.all(sql, [req.params.projectId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/tasks', (req, res) => {
    const { project_id, title, assignee, priority } = req.body;
    
    db.serialize(() => {
        db.run("INSERT INTO tasks (project_id, title, assignee, priority) VALUES (?, ?, ?, ?)", 
            [project_id, title, assignee, priority], function(err) {
            
            if (err) return res.status(500).json({ success: false });

            db.get("SELECT id FROM users WHERE name = ?", [assignee], (err, user) => {
                if (user) {
                    const msg = `You have been assigned a new task: "${title}"`;
                    db.run("INSERT INTO notifications (user_id, type, content) VALUES (?, 'Task', ?)", 
                           [user.id, msg]);
                }
            });

            res.json({ success: true });
        });
    });
});

app.get('/api/task-details/:id', (req, res) => {
    db.get("SELECT * FROM tasks WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || {});
    });
});

app.put('/api/tasks/:id/status', (req, res) => {
    db.run("UPDATE tasks SET status = ? WHERE id = ?", [req.body.status, req.params.id], function(err) {
        res.json({ success: true });
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    db.run("DELETE FROM tasks WHERE id = ?", [req.params.id], () => res.json({success: true}));
});

app.put('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    const { title, assignee } = req.body; 

    db.serialize(() => {
        const sql = "UPDATE tasks SET title = ?, assignee = ? WHERE id = ?";
        db.run(sql, [title, assignee, taskId], function(err) {
            if (err) return res.status(500).json({ success: false });

            db.get("SELECT id FROM users WHERE name = ?", [assignee], (err, user) => {
                if (user) {
                    const msg = `Task Assignment Updated: You are now responsible for "${title}"`;
                    db.run("INSERT INTO notifications (user_id, type, content) VALUES (?, 'Task', ?)", 
                           [user.id, msg]);
                }
            });

            res.json({ success: true });
        });
    });
});

app.delete('/api/projects/:id', (req, res) => {
    const projectId = req.params.id;

    db.get("SELECT title FROM projects WHERE id = ?", [projectId], (err, project) => {
        if (project) {
            db.serialize(() => {
                db.run("DELETE FROM tasks WHERE project_id = ?", [projectId]);
                
                db.run("DELETE FROM notifications WHERE content LIKE ?", [`%${project.title}%`]);
                
                db.run("DELETE FROM projects WHERE id = ?", [projectId], () => {
                    res.json({ success: true, message: "Project and notifications deleted" });
                });
            });
        } else {
            res.json({ success: false, message: "Project not found" });
        }
    });
});

app.get('/api/leaves', (req, res) => {
    db.all("SELECT * FROM leaves ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

app.post('/api/leaves', (req, res) => {
    const { employee_name, leave_type, start_date, end_date, reason } = req.body;
    const sql = "INSERT INTO leaves (employee_name, leave_type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)";
    
    db.run(sql, [employee_name, leave_type, start_date, end_date, reason], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/leaves/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE leaves SET status = ? WHERE id = ?", [status, req.params.id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/account/:id', (req, res) => {
    const id = req.params.id;
    
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
        if (err || !user) return res.json({ name: 'Unknown' });

        db.get("SELECT COUNT(*) as count FROM projects", (err, projRow) => {
            const projectCount = projRow ? projRow.count : 0;

            db.get("SELECT COUNT(*) as count FROM departments WHERE manager = ?", [user.name], (err, deptRow) => {
                const teamCount = deptRow ? deptRow.count : 0;

                const joinDate = user.joined_date || "2025-01-01";

                res.json({
                    ...user,
                    stats: {
                        projects: projectCount,
                        teams: teamCount, // Will show 0 until you are assigned as Manager
                        joined: joinDate  // Sending the raw date
                    }
                });
            });
        });
    });
});


app.put('/api/account/update/:id', (req, res) => {
    const id = req.params.id; 
    const { name, email, password, role, department, team_id, profile_pic, cover_pic, phone, city, zip } = req.body;
    
    let sql = "UPDATE users SET name = ?, email = ?, role = ?, department = ?, team_id = ?, phone = ?, city = ?, zip = ?";
    let params = [name, email, role, department, team_id, phone, city, zip];

    if (password && password.length > 0 && password !== "123456") {
        sql += ", password = ?";
        params.push(password);
    }
    
    if (profile_pic !== undefined) {
        sql += ", profile_pic = ?";
        params.push(profile_pic);
    }
    if (cover_pic !== undefined) {
        sql += ", cover_pic = ?";
        params.push(cover_pic);
    }

    sql += " WHERE id = ?";
    params.push(id);

    db.run(sql, params, function(err) {
        if (err) {
            console.error("SQL Error:", err.message);
            return res.status(400).json({ success: false, error: err.message });
        }
        console.log(`Updated user ID ${id}: Dept -> ${department}, TeamID -> ${team_id}`);
        res.json({ success: true });
    });
});

app.get('/api/teams', (req, res) => {
    const sql = `
        SELECT teams.*, 
        (SELECT COUNT(*) FROM users WHERE team_id = teams.id) as member_count 
        FROM teams`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

app.post('/api/teams', (req, res) => {
    const { team_name, department_name, team_lead, member_ids } = req.body;
    
    db.run("INSERT INTO teams (team_name, department_name, team_lead) VALUES (?, ?, ?)", 
    [team_name, department_name, team_lead], function(err) {
        if (err) return res.json({ success: false });
        
        const teamId = this.lastID;
        if (member_ids && member_ids.length > 0) {
            const placeholders = member_ids.map(() => '?').join(',');
            db.run(`UPDATE users SET team_id = ? WHERE id IN (${placeholders})`, [teamId, ...member_ids]);
        }
        res.json({ success: true });
    });
});

app.get('/api/calendar-events', (req, res) => {
    const events = [];

    db.all("SELECT title, deadline FROM projects", [], (err, projects) => {
        if (err) return res.status(500).json([]);

        const today = new Date(); 

        projects.forEach(p => {
            const projectDeadline = new Date(p.deadline);
            const isExpired = projectDeadline < today;

            // Add project deadlines to events
            events.push({
                title: p.title,
                start: p.deadline,
                backgroundColor: isExpired ? '#bdc3c7' : '#f1c40f', 
                borderColor: 'transparent',
                textColor: isExpired ? '#7f8c8d' : '#000',
                allDay: true
            });
        });

        db.all("SELECT employee_name, start_date, end_date FROM leaves WHERE status='Approved'", [], (err, leaves) => {
            if (!err && leaves) {
                leaves.forEach(l => {
                    events.push({
                        title: `🏖️ ${l.employee_name}`,
                        start: l.start_date,
                        end: l.end_date,
                        backgroundColor: '#2ecc71',
                        textColor: '#fff',
                        allDay: true
                    });
                });
            }
            res.json(events);
        });
    });
});

app.get('/api/teams-full-detail', (req, res) => {
    const sql = `SELECT * FROM teams`;
    
    db.all(sql, [], async (err, teams) => {
        if (err) return res.status(500).json({ error: err.message });

        const detailedTeams = await Promise.all(teams.map(async (team) => {
            const members = await new Promise((resolve) => {
                const memberSql = `
                SELECT u.id, u.name, 
                    GROUP_CONCAT(p.title, ' | ') as project_names,
                    GROUP_CONCAT(t.title, ', ') as task_names
                FROM users u
                LEFT JOIN tasks t ON t.assignee = u.name
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE u.team_id = ?
                GROUP BY u.id`;
                db.all(memberSql, [team.id], (err, rows) => resolve(rows || []));
            });
            return { ...team, members };
        }));

        res.json({ success: true, data: detailedTeams });
    });
});

app.delete('/api/teams/:id', (req, res) => {
    db.run("DELETE FROM teams WHERE id = ?", [req.params.id], () => {
        res.json({ success: true });
    });
});

app.put('/api/teams/:id', (req, res) => {
    const teamId = req.params.id;
    const { team_name, department_name, team_lead, member_ids } = req.body;

    // serialize ensures these queries run one after the other
    db.serialize(() => {
        db.run("UPDATE teams SET team_name = ?, department_name = ?, team_lead = ? WHERE id = ?", 
            [team_name, department_name, team_lead, teamId]);

        db.run("UPDATE users SET team_id = NULL WHERE team_id = ?", [teamId]);

        if (member_ids && member_ids.length > 0) {
            const placeholders = member_ids.map(() => '?').join(',');
            db.run(`UPDATE users SET team_id = ? WHERE id IN (${placeholders})`, [teamId, ...member_ids], (err) => {
                res.json({ success: true });
            });
        } else {
            res.json({ success: true });
        }
    });
});

app.get('/api/sync-notifications', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.json({ success: false });

    db.get("SELECT name, role, notif_prefs FROM users WHERE id = ?", [userId], (err, user) => {
        if (!user) return res.json({ success: false });

        let prefs = { deadlines: true };
        if (user.notif_prefs) prefs = JSON.parse(user.notif_prefs);

        // Define the logic to fetch after sync
        const fetchNotifications = () => {
            db.all("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", [userId], (err, rows) => {
                const unreadCount = rows ? rows.filter(n => n.is_read === 0).length : 0;
                res.json({ success: true, data: rows || [], unreadCount: unreadCount });
            });
        };

        if (prefs.deadlines) {
            let syncSql = "";
            let params = [userId, userId];

            if (user.role === 'Admin') {
                syncSql = `INSERT INTO notifications (user_id, type, content)
                           SELECT ?, 'Deadline', 'Project "' || title || '" is due soon!'
                           FROM projects WHERE deadline BETWEEN date('now') AND date('now', '+2 days')
                           AND NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = ? AND content LIKE '%' || title || '%')`;
            } else {
                syncSql = `INSERT INTO notifications (user_id, type, content)
                           SELECT ?, 'Deadline', 'Your Project "' || p.title || '" is due soon!'
                           FROM projects p JOIN tasks t ON t.project_id = p.id
                           WHERE t.assignee LIKE ? AND p.deadline BETWEEN date('now') AND date('now', '+2 days')
                           AND NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = ? AND content LIKE '%' || p.title || '%')`;
                params = [userId, `%${user.name}%`, userId];
            }
            // Wait for the sync to finish before fetching the list
            db.run(syncSql, params, () => fetchNotifications());
        } else {
            fetchNotifications();
        }
    });
});

app.post('/api/chat/send', (req, res) => {
    const { sender_id, sender_name, message } = req.body;
    db.run("INSERT INTO messages (sender_id, sender_name, message) VALUES (?, ?, ?)", 
           [sender_id, sender_name, message], function(err) {
        res.json({ success: true });
    });
});

app.get('/api/chat/history', (req, res) => {
    db.all("SELECT * FROM messages ORDER BY timestamp ASC", (err, rows) => {
        res.json({ success: true, data: rows });
    });
});

app.post('/api/chat/send-private', (req, res) => {
    const { sender_id, receiver_id, sender_name, message } = req.body;
    db.run("INSERT INTO messages (sender_id, receiver_id, sender_name, message) VALUES (?, ?, ?, ?)", 
           [sender_id, receiver_id, sender_name, message], () => res.json({ success: true }));
});

app.get('/api/chat/history/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    
    console.log(`[CHAT LOG] History requested for Users: ${user1} and ${user2}`);

    if (user1 === 'undefined' || user2 === 'undefined' || !user1 || !user2) {
        console.error("!! CHAT ERROR: Received undefined IDs from frontend !!");
        return res.json({ success: false, data: [], message: "Invalid User IDs" });
    }

    const sql = `SELECT * FROM messages 
                 WHERE (sender_id = ? AND receiver_id = ?) 
                 OR (sender_id = ? AND receiver_id = ?) 
                 ORDER BY timestamp ASC`;

    db.all(sql, [user1, user2, user2, user1], (err, rows) => {
        if (err) {
            console.error("DB Error:", err.message);
            return res.json({ success: false, data: [] });
        }
        res.json({ success: true, data: rows || [] }); 
    });
});

app.put('/api/account/update-notif-prefs/:id', (req, res) => {
    const id = req.params.id;
    const prefs = JSON.stringify(req.body);

    db.run("UPDATE users SET notif_prefs = ? WHERE id = ?", [prefs, id], function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: "Preferences saved!" });
    });
});
app.put('/api/notifications/mark-read/:userId', (req, res) => {
    const userId = req.params.userId;
    // Set is_read to 1 for all current notifications for this user
    db.run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.get('/api/employee-stats/:id', (req, res) => {
    const userId = req.params.id;
    const stats = {};

    db.get("SELECT name, department FROM users WHERE id = ?", [userId], (err, user) => {
        if (!user) return res.status(404).json({ success: false });

        db.serialize(() => {
            // 1. Count Tasks assigned to the user
            db.get("SELECT COUNT(*) as count FROM tasks WHERE assignee = ?", [user.name], (err, row) => {
                stats.myTasks = row ? row.count : 0;
            });

            // 2. Count personal leaves that are still pending
            db.get("SELECT COUNT(*) as count FROM leaves WHERE employee_name = ? AND status = 'Pending'", [user.name], (err, row) => {
                stats.pendingLeaves = row ? row.count : 0;
            });

            // 3. Count unique projects the user has tasks in
            db.get("SELECT COUNT(DISTINCT project_id) as count FROM tasks WHERE assignee = ?", [user.name], (err, row) => {
                stats.myProjects = row ? row.count : 0;
                
                // Send final combined stats
                res.json({ 
                    success: true, 
                    department: user.department,
                    ...stats 
                });
            });
        });
    });
});

app.get('/api/employee-calendar/:name', (req, res) => {
    
    const employeeName = decodeURIComponent(req.params.name).trim();
    
    
    const sql = `
        SELECT DISTINCT p.title as title, p.deadline as start, '#1abc9c' as backgroundColor
        FROM projects p
        INNER JOIN tasks t ON p.id = t.project_id
        WHERE t.assignee LIKE ?
    `;

    // The % symbols allow it to match even if there are hidden spaces
    db.all(sql, [`%${employeeName}%`], (err, rows) => {
        if (err) {
            console.error("Calendar Query Error:", err.message);
            return res.status(500).json([]);
        }
        res.json(rows); 
    });
});

app.post('/api/update-profile', (req, res) => {
    const { id, name, email, phone, city, zip } = req.body;
    const sql = `UPDATE users SET name = ?, email = ?, phone = ?, city = ?, zip = ? WHERE id = ?`;
    
    db.run(sql, [name, email, phone, city, zip, id], function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

app.get('/api/tasks-by-assignee/:name', (req, res) => {
    const employeeName = decodeURIComponent(req.params.name).trim();
    
    const sql = `
        SELECT t.*, p.title as project_title 
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.assignee LIKE ?
    `;

    db.all(sql, [`%${employeeName}%`], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows || [] });
    });
});

app.post('/api/leaves/submit', (req, res) => {
    const { employee_name, admin_id, days, type, reason } = req.body;
    
    db.serialize(() => {
        const sql = `INSERT INTO leaves (employee_name, leave_type, reason, status) VALUES (?, ?, ?, 'Pending')`;
        const fullReason = `(${days} Days) ${reason}`;
        
        db.run(sql, [employee_name, type, fullReason], function(err) {
            if (err) {
                console.error("Leave Insert Error:", err.message);
                return res.status(500).json({ success: false });
            }

            const msg = `New Leave Request from ${employee_name} for ${days} days.`;
            const notifySql = "INSERT INTO notifications (user_id, type, content) VALUES (?, ?, ?)";
            
            db.run(notifySql, [admin_id, 'Leave', msg], (err) => {
                if (err) console.error("Notification Error:", err.message);
                
                res.json({ success: true });
            });
        });
    });
});

app.get('/api/my-leaves/:name', (req, res) => {
    const name = decodeURIComponent(req.params.name).trim();
    
    const sql = "SELECT * FROM leaves WHERE employee_name LIKE ? ORDER BY id DESC";

    db.all(sql, [`%${name}%`], (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: rows || [] });
    });
});

app.get('/api/my-teammates/:userId', (req, res) => {
    const userId = req.params.userId;

    // 1. Find the user's team ID
    db.get("SELECT team_id FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user || !user.team_id) {
            return res.json({ success: false, members: [], teamName: "No Team", teamLead: "N/A" });
        }

        const sql = `
            SELECT u.id, u.name, u.role, t.team_name, t.team_lead 
            FROM users u 
            JOIN teams t ON u.team_id = t.id 
            WHERE u.team_id = ?
        `;

        db.all(sql, [user.team_id], (err, rows) => {
            if (err) return res.status(500).json({ success: false });
            
            res.json({ 
                success: true, 
                members: rows || [], 
                teamName: rows[0]?.team_name || "Assigned Team",
                teamLead: rows[0]?.team_lead || "Unassigned"
            });
        });
    });
});

app.get('/api/chat/unread-count/:userId', (req, res) => {
    const userId = req.params.userId;
    
    const sql = "SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0";
    
    db.get(sql, [userId], (err, row) => {
        if (err) {
            console.error("SQL Error in unread-count:", err.message);
            return res.status(500).json({ success: false, unread: 0 });
        }
        res.json({ success: true, unread: row ? row.count : 0 });
    });
});

app.put('/api/chat/mark-read', (req, res) => {
    const { me, sender } = req.body;
    db.run("UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?", [me, sender], () => {
        res.json({ success: true });
    });
});

app.put('/api/notifications/read/:id', (req, res) => {
    const notifId = req.params.id;
    db.run("UPDATE notifications SET is_read = 1 WHERE id = ?", [notifId], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, message: "Notification marked as read" });
    });
});

/* ==========================================================================
   START THE SECURE HTTPS SERVER
   ========================================================================== */
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 SECURE Server running on https://localhost:${PORT}`);
    console.log(`✅ SSL Certificates (server.key/server.cert) Loaded.`);
    console.log(`========================================\n`);
});