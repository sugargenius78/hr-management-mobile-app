const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./my_hr_db.sqlite', (err) => {
    if (err) {
        console.error("Error opening database " + err.message);
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
        role TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        manager TEXT
        -- Budget column is removed from here!
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        employee_id INTEGER,
        project_id INTEGER,
        status TEXT DEFAULT 'Pending',
        due_date TEXT,
        FOREIGN KEY (employee_id) REFERENCES users(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
    )`);

    console.log("Tables created successfully.");

    const insert = db.prepare("INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?,?,?,?)");
    insert.run("HR Manager", "admin@test.com", "admin123", "admin");
    insert.run("John Doe", "john@test.com", "1234", "employee");
    insert.finalize();
});

module.exports = db;