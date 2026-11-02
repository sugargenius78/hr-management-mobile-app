# Nexus Global HR Portal (PWA)

## Overview
A Progressive Web Application (PWA) engineered to streamline human resources management, employee administration, and internal communication. Developed for the Mobile and Web Technologies module (SEN5001) under the Cardiff Metropolitan University curriculum. Grade Achieved: 66% (2:1).

## Key Features
- **User Authentication & RBAC:** Role-based access for Administrators and Employees with secure session handling.
- **Task & Project Tracking:** Task delegation with priority classifications (High, Medium, Low) and deadline monitoring.
- **Internal Messaging & Alerts:** Direct 1-on-1 messaging and automated notifications for assigned tasks.
- **Leave Management:** Interface for submitting and managing employee leave requests.

## Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript (Progressive Web App Architecture)
- **Backend:** Node.js, Express.js
- **Database:** SQLite (`hr_system.db`)
- **System Design:** UML Use Case, Class, and Entity Relationship Diagrams (ERD)

## Project Structure
- `server.js` - Main Express server and API routing
- `database.js` - SQLite database initialization and schema setup
- `hr_system.db` - Relational SQLite database
- `public/` - Frontend client assets, styles, and scripts
- `st20320120 SEN5001 PRES1.pdf` - Project architectural presentation and system design slides

## Setup and Installation
```bash
# Install dependencies
npm install

# Start the application server
npm start
