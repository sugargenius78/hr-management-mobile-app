/* ==========================================================================
   MASTER SCRIPT - HR MANAGEMENT SYSTEM
   ========================================================================== */
async function openModal() {
    await fillTeamDropdown(); 
    
    await fillEmployeeDeptDropdown(); 
    
    const modal = document.getElementById('addEmployeeModal');
    if (modal) modal.style.display = 'flex';
}
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const resetBtn = document.getElementById('btn-reset-password');
    if (resetBtn) {
        resetBtn.addEventListener('click', verifyAndReset);
        console.log("Reset listener re-attached!");
    }
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log("Login listener attached successfully!");
    }
    const publicPages = [
        'index.html', 
        'register.html', 
        'forgot-password.html', 
        'reset-password.html'
    ];

    const isPublicPage = publicPages.some(page => path.endsWith(page)) || path === '/';

    if (!isPublicPage) {
        checkSession();
        loadUserData(); 
        loadNotifications();
        
        if (path.includes('admin.html')) {
            loadDashboardStats();
            loadDepartmentsOverview();
        }
        if (path.includes('employee.html')) {
            loadEmployeeDashboard();
        }
    }

    if(document.getElementById('projects-table')) loadProjects();     
    if(document.getElementById('dept-grid'))      loadDepartments();  
    if(document.getElementById('leave-table-body')) loadLeaves();     
    if(document.getElementById('adminName'))      loadAccountData();  
    if(document.getElementById('table-body'))     fetchEmployees();
    if(document.getElementById('team-grid'))      loadTeams();

    const chatInput = document.getElementById('popupInput');
    if (chatInput) {
        chatInput.addEventListener("keypress", function(event) {
           
            if (event.key === "Enter") {
                event.preventDefault(); 
                sendPrivateMessage();   
            }
        });
    }
    
});


async function fillEmployeeDeptDropdown() {
    const deptSelect = document.getElementById('empDept');
    if (!deptSelect) return;

    try {
        const response = await fetch('/api/departments?t=' + Date.now());
        const result = await response.json();
        
        deptSelect.innerHTML = '<option value="">-- Select Department --</option>';
        
        if (result.success && result.data) {
            result.data.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.name; 
                option.innerText = dept.name;
                deptSelect.appendChild(option);
            });
            console.log("Employee Department dropdown synced with database.");
        }
    } catch (e) { 
        console.error("Failed to sync departments:", e); 
    }
}


async function loadUserData() {
    const userStr = localStorage.getItem('user');
    if(!userStr) return;
    const userObj = JSON.parse(userStr);
    const userId = userObj.id;

    const cachedName = localStorage.getItem('adminName');
    const cachedPic = localStorage.getItem('adminPic');
    if (cachedName) updateGlobalHeaders(cachedName, cachedPic);

    try {
        const response = await fetch(`/api/account/${userId}?t=` + Date.now());
        if (!response.ok) return;

        const data = await response.json();

        localStorage.setItem('adminName', data.name);
        if (data.profile_pic) localStorage.setItem('adminPic', data.profile_pic);
        updateGlobalHeaders(data.name, data.profile_pic);

    } catch (err) { console.error("Sync failed:", err); }
}

function updateGlobalHeaders(name, profilePicBase64) {
    if (!name) return;
    const user = JSON.parse(localStorage.getItem('user'));
    
    let role = user ? user.role : 'Employee';
    if (role === 'Admin') role = 'Manager'; 

    const defaultAvatar = `https://ui-avatars.com/api/?name=${name}&background=1abc9c&color=fff`;
    const finalSrc = profilePicBase64 || defaultAvatar;

    const navImg = document.getElementById('nav-user-pic');
    const navName = document.getElementById('nav-user-name');
    const navRole = document.getElementById('nav-user-role');

    if (navImg) navImg.src = finalSrc;
    if (navName) navName.innerText = name;
    if (navRole) navRole.innerText = role;

    document.querySelectorAll('.user-wrapper').forEach(wrapper => {
        wrapper.classList.add('loaded');
    });

    injectSidebar(); 
}

function checkSession() {
    const path = window.location.pathname;
    const publicPages = ['index.html', 'register.html', 'forgot-password.html', 'reset-password.html'];
    const isPublicPage = publicPages.some(page => path.endsWith(page)) || path === '/';

    if (isPublicPage) return; 

    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('adminName');
    localStorage.removeItem('adminPic');
    window.location.href = 'index.html';
}

async function loadAccountData() {
    if (!document.getElementById('adminName')) return;
    
    const userStr = localStorage.getItem('user');
    const userId = userStr ? JSON.parse(userStr).id : 1; 

    try {
        const response = await fetch(`/api/account/${userId}?t=` + Date.now());
        const data = await response.json();

        const setVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val || ''; }

        let displayRole = (data.role === 'Admin') ? 'Manager' : data.role;
        
        setVal('adminRole', displayRole); 
        setVal('display-role-input', displayRole);

        if(document.getElementById('display-role')) {
            document.getElementById('display-role').innerText = displayRole;
        }

        setVal('adminName', data.name);
        setVal('adminEmail', data.email);
        setVal('adminPhone', data.phone);
        setVal('adminCity', data.city);
        setVal('adminZip', data.zip);

        if(document.getElementById('display-name')) document.getElementById('display-name').innerText = data.name;

        if(data.stats) {
            if(document.getElementById('stat-projects')) 
                document.getElementById('stat-projects').innerText = data.stats.projects;
            
            
            const teamsRow = document.getElementById('stat-teams').parentElement; 
            
            if (data.role === 'Admin' || data.role === 'Manager') {
                
                teamsRow.style.display = 'none';
            } else {
                
                teamsRow.style.display = 'flex'; 

                let finalCount = data.stats.teams;

                
                try {
                    const tRes = await fetch('/api/teams?t=' + Date.now());
                    const tResult = await tRes.json();
                    
                    if (tResult.data) {
                       
                        const realCount = tResult.data.filter(t => t.team_lead === data.name).length;
                        finalCount = realCount; 
                    }
                } catch(e) { console.log("Team check failed, using default"); }

                
                document.getElementById('stat-teams').innerText = finalCount;
            }
            

            if(document.getElementById('stat-years')) {
                const dateObj = new Date(data.stats.joined);
                const readableDate = dateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', month: 'short', day: 'numeric' 
                });
                document.getElementById('stat-years').innerText = readableDate;
            }
        }

        if(data.cover_pic && document.getElementById('account-banner-bg')) {
            document.getElementById('account-banner-bg').style.backgroundImage = `url('${data.cover_pic}')`;
        }
        if(document.getElementById('profile-img-preview')) {
            const def = `https://ui-avatars.com/api/?name=${data.name}&background=1abc9c&color=fff`;
            document.getElementById('profile-img-preview').src = data.profile_pic || def;
        }
    } catch (err) { console.error(err); }
}

async function updateProfile(event) {
    event.preventDefault(); // Prevent page reload

    const user = JSON.parse(localStorage.getItem('user'));
    const updatedData = {
        id: user.id,
        name: document.getElementById('adminName').value,
        email: document.getElementById('adminEmail').value,
        phone: document.getElementById('adminPhone').value,
        city: document.getElementById('adminCity').value,
        zip: document.getElementById('adminZip').value
    };

    try {
        const response = await fetch('/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();

        if (result.success) {
            // 1. Update the local storage so the UI knows the new name
            user.name = updatedData.name;
            user.email = updatedData.email;
            localStorage.setItem('user', JSON.stringify(user));

            showPopup("Success!", "Profile updated successfully.");
            updateGlobalHeaders(user.name, user.profilePic); 
        } else {
            alert("Update failed: " + result.message);
        }
    } catch (err) {
        console.error("Profile update error:", err);
    }
}

/* --- IMAGE CROPPER LOGIC --- */
let cropper;
let currentCropMode = 'profile'; 

function previewImage(event) {
    currentCropMode = 'profile';
    startCropping(event.target.files[0], 1); 
    event.target.value = ''; 
}

function previewCoverImage(event) {
    currentCropMode = 'cover';
    startCropping(event.target.files[0], 3.5); 
    event.target.value = '';
}

function startCropping(file, ratio) {
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const image = document.getElementById('image-to-crop');
            if(image) {
                image.src = e.target.result;
                document.getElementById('cropModal').style.display = 'flex';
                if (cropper) cropper.destroy();
                cropper = new Cropper(image, { aspectRatio: ratio, viewMode: 1, autoCropArea: 1 });
            }
        };
        reader.readAsDataURL(file);
    }
}

async function cropAndSaveImage() {
    if (!cropper) return;

    const userStr = localStorage.getItem('user');
    const userId = userStr ? JSON.parse(userStr).id : 1;

    const canvas = cropper.getCroppedCanvas({ width: currentCropMode === 'profile' ? 300 : 1200, height: currentCropMode === 'profile' ? 300 : 350 });
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);
    
    const payload = { 
        name: document.getElementById('adminName').value, 
        email: document.getElementById('adminEmail').value 
    };

    if (currentCropMode === 'profile') payload.profile_pic = base64Image;
    else payload.cover_pic = base64Image;

    //  add userId to the URL
    await fetch(`/api/account/update/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (currentCropMode === 'profile') {
        document.getElementById('profile-img-preview').src = base64Image;
        localStorage.setItem('adminPic', base64Image);
        updateGlobalHeaders(payload.name, base64Image); 
    } else {
        document.getElementById('account-banner-bg').style.backgroundImage = `url('${base64Image}')`;
    }
    closeCropModal();
}

async function deleteProfileImage() {
    if(!confirm("Remove profile picture?")) return;
    const name = document.getElementById('adminName').value;
    const email = document.getElementById('adminEmail').value;

    await fetch('/api/account/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, profile_pic: null })
    });

    const defaultUrl = `https://ui-avatars.com/api/?name=${name}&background=1abc9c&color=fff`;
    document.getElementById('profile-img-preview').src = defaultUrl;
    localStorage.removeItem('adminPic');
    updateGlobalHeaders(name, null);
}

function closeCropModal() {
    document.getElementById('cropModal').style.display = 'none';
    if (cropper) cropper.destroy();
}

function switchTab(tabName, element) {
    const settingsTab = document.getElementById('tab-settings');
    const notifTab = document.getElementById('tab-notifications');

    // Only hide if they exist on this page
    if (settingsTab) settingsTab.style.display = 'none';
    if (notifTab) notifTab.style.display = 'none';

    // Remove 'active' look from all tab buttons
    document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active-tab'));
    
    
    const target = document.getElementById('tab-' + tabName);
    if (target) {
        target.style.display = 'block';
        element.classList.add('active-tab');
    }

    if (tabName === 'notifications') {
        loadNotificationPrefs();
    }
}

async function loadNotificationPrefs() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    // 1. Identify the rows to hide/show
    const regRow = document.getElementById('notif-registration-row');
    const taskRow = document.getElementById('notif-task-row');
    const leaveTitle = document.getElementById('label-leave-title');
    const leaveDesc = document.getElementById('label-leave-desc');

    if (user.role === 'Admin') {
        if (regRow) regRow.style.display = 'flex'; // Admins see new registrations
        if (taskRow) taskRow.style.display = 'none'; // Admins don't get "New Task" alerts
        if (leaveTitle) leaveTitle.innerText = "New Leave Requests";
        if (leaveDesc) leaveDesc.innerText = "Get alerted when an employee asks for leave";
    } else {
        if (regRow) regRow.style.display = 'none'; // Employees don't see registrations
        if (taskRow) taskRow.style.display = 'flex'; // Employees see "New Task" alerts
        if (leaveTitle) leaveTitle.innerText = "Leave Status Updates";
        if (leaveDesc) leaveDesc.innerText = "Get notified when your leave is Approved or Rejected";
    }

    // 3. Fetch saved toggle states from the database
    try {
        const res = await fetch(`/api/account/${user.id}`);
        const data = await res.json();

        if (data.notif_prefs) {
            const prefs = JSON.parse(data.notif_prefs);
            if(document.getElementById('toggle-leave')) document.getElementById('toggle-leave').checked = prefs.leave;
            if(document.getElementById('toggle-deadlines')) document.getElementById('toggle-deadlines').checked = prefs.deadlines;
            if(document.getElementById('toggle-registration')) document.getElementById('toggle-registration').checked = prefs.registration;
            if(document.getElementById('toggle-tasks')) document.getElementById('toggle-tasks').checked = prefs.tasks;
        }
    } catch (e) { console.error("Could not sync notification settings", e); }
}

/* -------------------------------------------------------------------------- */
/* DASHBOARD (SIMPLE STATS)                                                   */
/* -------------------------------------------------------------------------- */
async function loadDashboardStats() {
    if (!window.location.pathname.includes('admin.html')) return;
    if (!document.querySelector('.recent-grid')) return;

    try {
        const response = await fetch('/api/dashboard-stats?t=' + Date.now());
        const stats = await response.json();

        
        const cards = document.querySelectorAll('.card-single h1');
        if (cards.length >= 3) {
            cards[0].innerText = stats.totalEmployees;    
            cards[1].innerText = stats.totalDepartments;
            cards[2].innerText = stats.activeTasks;
        }

        const projectContainer = document.querySelector('.projects .card-body');
        
        if (projectContainer && stats.activeProjects) {
            const today = new Date();

            projectContainer.innerHTML = stats.activeProjects.map(proj => {
                const isExpired = new Date(proj.deadline) < today;
                const blurStyle = isExpired ? "filter: grayscale(1) blur(1px); opacity: 0.6; pointer-events: none;" : "";
                const borderColor = isExpired ? '#95a5a6' : '#1abc9c';

                return `
                    <div class="project-card-mini" style="background: #fff; padding: 15px; border-radius: 10px; margin-bottom: 10px; border-left: 5px solid ${borderColor}; ${blurStyle} box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: left;">
                        <h4 style="margin: 0; color: #333;">${proj.title} ${isExpired ? '🔒' : ''}</h4>
                        <small style="color: #7f8c8d;">${proj.department}</small>
                        <p style="margin: 8px 0 0 0; font-size: 0.85rem; color: #e74c3c;">
                            <b>Due:</b> ${proj.deadline}
                        </p>
                    </div>
                `;
            }).join('');
        }

        // 3. Departments Overview Logic 
        loadDepartmentsOverview();

    } catch (e) {
        console.error("Failed to load dashboard stats:", e);
    }
}

/* -------------------------------------------------------------------------- */
/* LEAVES LOGIC                                                               */
/* -------------------------------------------------------------------------- */
async function loadLeaves() {
    const tableBody = document.getElementById('leave-table-body');
    if (!tableBody) return;

    try {
        const response = await fetch('/api/leaves?t=' + Date.now());
        const result = await response.json();
        
        tableBody.innerHTML = '';
        let pending = 0, approved = 0, rejected = 0;

        if (result.data && result.data.length > 0) {
            result.data.forEach(leave => {
                
                if (leave.status === 'Pending') pending++;
                else if (leave.status === 'Approved') approved++;
                else if (leave.status === 'Rejected') rejected++;

                let trueDuration = 1; 
                const match = leave.reason ? leave.reason.match(/\((\d+)\s*Days\)/) : null;
                
                if (match) {
                    trueDuration = match[1];
                } else {
                    const start = new Date(leave.start_date);
                    const end = new Date(leave.end_date);
                    const diffTime = Math.abs(end - start);
                    trueDuration = isNaN(diffTime) ? 1 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                }

                
                const cleanReason = leave.reason ? leave.reason.replace(/\(\d+\s*Days\)\s*/, '') : 'Personal reasons';

                // 3. Set color based on status
                let statusColor = '#f39c12'; 
                if (leave.status === 'Approved') statusColor = '#2ecc71'; 
                if (leave.status === 'Rejected') statusColor = '#e74c3c'; 

                // 4. Create action buttons
                let actionHtml = leave.status === 'Pending' ? `
                    <button onclick="updateLeaveStatus(${leave.id}, 'Approved')" style="border:none; background:none; color:#2ecc71; cursor:pointer; font-size:1.1rem; margin-right:10px;">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button onclick="updateLeaveStatus(${leave.id}, 'Rejected')" style="border:none; background:none; color:#e74c3c; cursor:pointer; font-size:1.1rem;">
                        <i class="fas fa-times-circle"></i>
                    </button>
                ` : `<small style="color:#bbb;">Closed</small>`;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><b>${leave.employee_name}</b></td>
                    <td>${trueDuration} Days</td> <td><small>${cleanReason}</small></td> <td><span class="status" style="background:${statusColor}; color:white; padding:2px 8px; border-radius:4px; font-size:0.8rem;">${leave.status}</span></td>
                    <td>${actionHtml}</td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#999;">No leave requests found.</td></tr>';
        }

        document.getElementById('count-pending').innerText = pending;
        document.getElementById('count-approved').innerText = approved;
        document.getElementById('count-rejected').innerText = rejected;

    } catch (err) { console.error("Leave Sync Error:", err); }
}
async function updateLeaveStatus(id, newStatus) {
    const confirmation = confirm(`Are you sure you want to mark this leave as ${newStatus}?`);
    if (!confirmation) return;

    try {
        const response = await fetch(`/api/leaves/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            loadLeaves(); // Refresh the table and cards instantly
        }
    } catch (e) { console.error("Failed to update status", e); }
}

/* -------------------------------------------------------------------------- */
/* DEPARTMENTS LOGIC                                                          */
/* -------------------------------------------------------------------------- */
async function loadDepartments() {
    const grid = document.getElementById('dept-grid');
    if (!grid) return;
    grid.innerHTML = 'Loading...';

    try {
        const response = await fetch('/api/departments?t=' + Date.now());
        const result = await response.json();
        grid.innerHTML = '';

        // Add New Card
        const addCard = document.createElement('div');
        addCard.className = 'dept-card add-new-card';
        addCard.onclick = () => openDeptModal();
        addCard.innerHTML = `<div style="text-align:center; color: #1abc9c;"><i class="fas fa-plus-circle" style="font-size: 3rem; margin-bottom: 10px;"></i><h3>Add Department</h3></div>`;
        grid.appendChild(addCard);

        result.data.forEach(dept => {
            const card = document.createElement('div');
            card.className = `dept-card border-IT`; // Simplified color logic
            card.innerHTML = `
                <div class="dept-header">
                    <div class="dept-info"><h3>${dept.name}</h3><span>Manager: ${dept.manager}</span></div>
                    <div class="dept-icon"><span class="fas fa-building"></span></div>
                </div>
                <div class="dept-stats">
                    <div class="stat-box"><h4>${dept.emp_count || 0}</h4><p>Employees</p></div>
                    <div class="card-actions">
                        <button class="btn-icon btn-edit" onclick='openDeptModal(${JSON.stringify(dept)})'><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" onclick="deleteDepartment(${dept.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            grid.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

function openDeptModal(dept = null) {
    const modal = document.getElementById('deptModal');
    if (!modal) return;

    if (dept) {
        // Edit Mode
        document.getElementById('deptId').value = dept.id;
        document.getElementById('deptName').value = dept.name;
        document.getElementById('deptManager').value = dept.manager;
        document.getElementById('modalTitle').innerText = "Edit Department";
    } else {
        // Add Mode
        const form = document.getElementById('deptForm') || document.getElementById('addDeptForm');
        if (form) form.reset(); // Clear previous values
        
        document.getElementById('deptId').value = '';
        document.getElementById('modalTitle').innerText = "Add New Department";
    }
    modal.style.display = 'flex';
}
function closeDeptModal() { document.getElementById('deptModal').style.display = 'none'; }

async function handleDeptSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('deptId').value;
    const name = document.getElementById('deptName').value;
    const manager = document.getElementById('deptManager').value;
    
    // Choose URL and Method based on if we are editing or adding
    const url = id ? `/api/departments/${id}` : '/api/departments';
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, manager })
        });

        if (response.ok) {
            closeDeptModal();
            loadDepartments(); // Refresh the grid
        }
    } catch (err) {
        console.error("Department save failed:", err);
    }
}
async function deleteDepartment(id) {
    if(!confirm("Delete department?")) return;
    await fetch(`/api/departments/${id}`, { method: 'DELETE' });
    loadDepartments();
}

// --- LIVE SEARCH FILTER FOR DEPARTMENTS ---
document.addEventListener('input', (e) => {
    // 1. Check if the user is typing in the department search bar
    if (e.target.id === 'dept-search-input') {
        const searchTerm = e.target.value.toLowerCase();
        const deptCards = document.querySelectorAll('.dept-card');

        deptCards.forEach(card => {
            
            if (card.classList.contains('add-new-card')) return;

            
            const deptName = card.querySelector('h3')?.innerText.toLowerCase();

            // 2.  Only show cards where the name STARTS with the search term
            if (deptName && deptName.startsWith(searchTerm)) {
                card.style.display = 'block'; 
            } else {
                card.style.display = 'none';  
            }
        });
    }
});

/* -------------------------------------------------------------------------- */
/* PROJECTS & TASKS LOGIC (KANBAN)                                            */
/* -------------------------------------------------------------------------- */
let currentProjectId = null;

async function loadProjects() {
    const list = document.getElementById('project-list');
    if (!list) return;
    
    const today = new Date(); 

    try {
        const response = await fetch('/api/projects?t=' + Date.now());
        const result = await response.json();
        list.innerHTML = '';
        
        result.data.forEach((proj) => {
            const projectDeadline = new Date(proj.deadline);
            const isExpired = projectDeadline < today;

            const card = document.createElement('div');
            card.className = 'project-card';
            card.style.position = 'relative'; 

            // 1. Apply visual blur to the background card if expired
            if (isExpired) {
                card.style.filter = "grayscale(1) blur(1px)";
                card.style.opacity = "0.7";
            }

            card.innerHTML = `
                <span onclick="event.stopPropagation(); deleteProject(${proj.id})" 
                      style="position: absolute; 
                             top: 5px; 
                             right: 10px; 
                             color: #e74c3c; 
                             cursor: pointer; 
                             font-size: 1.5rem; 
                             z-index: 100; 
                             pointer-events: auto !important; 
                             font-weight: bold;">
                      &times;
                </span>
                
                <div class="project-content" 
                     onclick="${isExpired ? '' : `selectProject(${proj.id}, '${proj.title}')`}"
                     style="cursor: ${isExpired ? 'not-allowed' : 'pointer'};">
                    
                    <h4>${proj.title} ${isExpired ? '🔒' : ''}</h4>
                    <small style="display: block; color: #7f8c8d;">${proj.department}</small>
                    <small style="display: block; color: ${isExpired ? '#7f8c8d' : '#e74c3c'}; margin-top: 8px;">
                        <i class="fas fa-calendar-alt"></i> Deadline: ${proj.deadline}
                    </small>
                </div>
            `;
            list.appendChild(card);
        });
    } catch(e) { console.error("Error loading projects:", e); }
}

// --- LIVE SEARCH FILTER FOR PROJECTS ---
document.addEventListener('input', (e) => {
    // 1. Check if the user is typing in the project search bar
    if (e.target.id === 'project-search-input') {
        const searchTerm = e.target.value.toLowerCase();
        const projectCards = document.querySelectorAll('.project-card');

        projectCards.forEach(card => {
            // Find the <h4> or <h3> inside the card where the title is
            const title = card.querySelector('h4')?.innerText.toLowerCase() || 
                          card.querySelector('h3')?.innerText.toLowerCase();

            // 2. Logic: Only show cards that START with the search term
            if (title && title.startsWith(searchTerm)) {
                card.style.display = 'block'; 
            } else {
                card.style.display = 'none';  
            }
        });
    }
});

function selectProject(id, title) {
    currentProjectId = id;
    
    // 1. Update the Header Text
    const projectTitleEl = document.getElementById('current-project-title');
    if (projectTitleEl) {
        projectTitleEl.innerText = title;
    }

    const addTaskBtn = document.getElementById('btn-add-task');
    if (addTaskBtn) {
        addTaskBtn.style.setProperty('display', 'inline-block', 'important');
        
        addTaskBtn.setAttribute('onclick', `openTaskModal(${id})`);

        console.log(`Success: Add Task button updated for Project ID: ${id} (${title})`);
    } else {
        console.error("Error: Could not find button with ID 'btn-add-task'");
    }

    document.querySelectorAll('.project-card').forEach(card => {
        card.classList.remove('active');
    });
    const selected = document.getElementById(`proj-card-${id}`);
    if (selected) selected.classList.add('active');

    // 4. Unlock the Kanban Board
    const kanbanBoard = document.getElementById('kanban-board');
    if (kanbanBoard) {
        kanbanBoard.style.filter = 'none';
        kanbanBoard.style.opacity = '1';
        kanbanBoard.style.pointerEvents = 'all';
    }

    // 5. Load the tasks
    loadTasks(id);
}

async function loadTasks(projectId) {
    const todoCol = document.getElementById('col-todo');
    if (!todoCol) return; 
    const progCol = document.getElementById('col-progress');
    const doneCol = document.getElementById('col-done');
    
    todoCol.innerHTML = ''; progCol.innerHTML = ''; doneCol.innerHTML = '';

    const response = await fetch(`/api/tasks/${projectId}?t=` + Date.now());
    const result = await response.json();

    result.data.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';
        
        let arrows = '';
        if (task.status === 'To Do') arrows = `<button class="btn-move" onclick="moveTask(${task.id}, 'In Progress')">></button>`;
        if (task.status === 'In Progress') arrows = `<button class="btn-move" onclick="moveTask(${task.id}, 'To Do')"><</button><button class="btn-move" onclick="moveTask(${task.id}, 'Done')">></button>`;
        if (task.status === 'Done') arrows = `<button class="btn-move" onclick="moveTask(${task.id}, 'In Progress')"><</button>`;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                <span class="task-tag tag-${task.priority}">${task.priority}</span>
                <div class="edit-delete-icons" style="display:flex; gap: 8px;">
                    <i class="fas fa-edit" onclick="editTask(${task.id})" style="cursor:pointer; color:#3498db; font-size: 0.8rem;"></i>
                    <i class="fas fa-trash" onclick="deleteTask(${task.id})" style="cursor:pointer; color:#e74c3c; font-size: 0.8rem;"></i>
                </div>
            </div>
            
            <b style="display: block; margin-top: 4px; font-size: 1rem; color: #333;">${task.title}</b>
            
            <div class="task-assignee" style="margin-top: 2px; font-size: 0.8rem; color: #7f8c8d; display: flex; align-items: center; gap: 5px;">
                <i class="fas fa-user-circle" style="font-size: 0.75rem;"></i>
                <span>${task.assignee || 'Unassigned'}</span>
            </div>

            <div class="task-actions" style="margin-top: 8px;">${arrows}</div>
        `;
        if (task.status === 'To Do') todoCol.appendChild(card);
        else if (task.status === 'In Progress') progCol.appendChild(card);
        else if (task.status === 'Done') doneCol.appendChild(card);
    });
}

async function moveTask(taskId, newStatus) {
    await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    });
    loadTasks(currentProjectId);
}

// Modal Handlers for Project/Task
function openProjectModal() {  
    fillProjectDeptDropdown(); 

    const modal = document.getElementById('projectModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error("Could not find the 'projectModal' element.");
    }
}
function closeProjectModal() { document.getElementById('projectModal').style.display = 'none'; }
async function handleProjectSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('projTitle').value;
    const department = document.getElementById('projDept').value;
    const deadline = document.getElementById('projDeadline').value;
    await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, department, deadline })
    });
    closeProjectModal();
    loadProjects();
}

function openTaskModal(projectId) {
    // 1. Find the hidden input for project ID
    const projectIdInput = document.getElementById('taskProjectId');
    
    if (projectIdInput) {
        // 2. Set the value to the ID of the project we're adding the task to
        projectIdInput.value = projectId;
        console.log("Task Modal prepared for Project ID:", projectId);
    } else {
        console.error("Could not find input with ID 'taskProjectId'");
    }

    document.getElementById('taskModal').style.display = 'flex';
}
function closeTaskModal() { document.getElementById('taskModal').style.display = 'none'; }
async function handleTaskSubmit(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('taskId')?.value;
    const projectId = document.getElementById('taskProjectId')?.value;
    const title = document.getElementById('taskTitle')?.value;
    const assignee = document.getElementById('taskAssignee')?.value;
    
    
    const priority = document.getElementById('taskPriority')?.value || 'Medium';

    if (!projectId || !title) return;

    const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
    const method = taskId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                project_id: projectId, 
                title: title, 
                assignee: assignee || 'Unassigned',
                priority: priority 
            })
        });

        if (response.ok) {
            closeTaskModal();
            loadTasks(projectId); 
            console.log("Task saved with priority:", priority);
        }
    } catch (err) {
        console.error("Task save failed:", err);
    }
}

/* -------------------------------------------------------------------------- */
/* EMPLOYEE LIST LOGIC                                                        */
/* -------------------------------------------------------------------------- */
async function fetchEmployees() {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';

    try {
        const response = await fetch('/api/users?t=' + Date.now());
        const result = await response.json();
        tableBody.innerHTML = '';
        
        result.data.forEach(user => {
            const row = document.createElement('tr');
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
            const teamName = user.team_name || 'Unassigned';

            row.innerHTML = `
                <td><input type="checkbox" class="emp-checkbox" value="${user.id}" onclick="toggleBulkActions()"></td>
                <td>
                    <div class="user-cell">
                        <img src="${avatarUrl}" width="30px">
                        <div><b>${user.name}</b><br><small>${user.email}</small></div>
                    </div>
                </td>
                <td>${user.role}</td>
                <td>${user.department || 'Unassigned'}</td>
                <td><span class="team-tag">${teamName}</span></td> <td><button class="action-btn btn-delete" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch(e) { console.error(e); }
}
async function deleteUser(id) {
    if(!confirm("Remove user?")) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    fetchEmployees();
}

function closeModal() { document.getElementById('addEmployeeModal').style.display = 'none'; }
async function submitNewEmployee(e) {
    if(e) e.preventDefault();
    
    // 1. Capture ALL fields, including the Team!
    const name = document.getElementById('empName').value;
    const email = document.getElementById('empEmail').value;
    const role = document.getElementById('empRole').value;
    const department = document.getElementById('empDept').value;
    const teamId = document.getElementById('empTeam').value; 
    const password = document.getElementById('empPassword')?.value || "123456"; 

    const modalHeader = document.querySelector('#addEmployeeModal h3') || 
                        document.querySelector('#addEmployeeModal h2');
    
    const isEdit = modalHeader && modalHeader.innerText.includes("Edit");
    const selected = document.querySelector('.emp-checkbox:checked');

    let url = '/api/register';
    let method = 'POST';
    
    // 2. Add 'team_id' to the payload
    let bodyData = { name, email, password, role, department, team_id: teamId };

    if (isEdit && selected) {
        url = `/api/account/update/${selected.value}`;
        method = 'PUT';
        if (password === "123456" || password === "") delete bodyData.password; 
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        if (response.ok) {
            closeModal();
            fetchEmployees(); 
            
            
            document.querySelectorAll('.emp-checkbox').forEach(box => box.checked = false);
            toggleBulkActions();
            if (modalHeader) modalHeader.innerText = "Add New Employee";
        }
    } catch (err) { console.error("Save failed:", err); }
}
// Bulk Actions
function toggleAll(source) {
    document.querySelectorAll('.emp-checkbox').forEach(box => box.checked = source.checked);
    toggleBulkActions();
}
function toggleBulkActions() {
    const selectedCheckboxes = document.querySelectorAll('.emp-checkbox:checked');
    const count = selectedCheckboxes.length;
    const container = document.getElementById('bulk-actions');
    
    // 1. Show or hide the entire container
    if (container) {
        container.style.display = count > 0 ? 'flex' : 'none';
    }

    const editBtn = document.getElementById('btn-bulk-edit');
    const deleteBtn = document.getElementById('btn-bulk-delete');

    // 2. Handle Delete Button logic
    if (deleteBtn) {
        deleteBtn.innerHTML = `<span class="fas fa-trash"></span> Delete (${count})`;
        deleteBtn.style.opacity = count > 0 ? "1" : "0.5";
        deleteBtn.style.pointerEvents = count > 0 ? "all" : "none";
    }

    // 3. Handle Edit Button logic (Only active for exactly 1 selection)
    if (editBtn) {
        editBtn.style.opacity = count === 1 ? "1" : "0.5";
        editBtn.style.pointerEvents = count === 1 ? "all" : "none";
    }
}
async function deleteSelected() {
    if(!confirm("Delete selected?")) return;
    const boxes = document.querySelectorAll('.emp-checkbox:checked');
    for (const box of boxes) await fetch(`/api/users/${box.value}`, { method: 'DELETE' });
    fetchEmployees();
}

function filterTable() {
    // 1. Get the typed search term from your HTML input
    const input = document.getElementById("searchInput");
    const filter = input.value.toLowerCase();
    
    // 2. Get the table and all its rows
    const table = document.getElementById("employeeTable");
    const tr = table.getElementsByTagName("tr");

    // 3. Loop through all table rows, starting from index 1 to skip the header
    for (let i = 1; i < tr.length; i++) {
        // 4. Get the cell that contains the employee name (assuming it's the 2nd column, index 1)
        const nameCell = tr[i].getElementsByTagName("td")[1]; 
        
        if (nameCell) {
            // 5. Extract the text from the <b> tag inside the cell
            const nameElement = nameCell.querySelector('b');
            const nameText = nameElement ? nameElement.innerText.toLowerCase() : "";

            if (nameText.trim().startsWith(filter)) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}

/* -------------------------------------------------------------------------- */
/* AUTHENTICATION (LOGIN & REGISTER)                                          */
/* -------------------------------------------------------------------------- */

async function handleRegister(event) {
    if(event) event.preventDefault(); // Stop page from reloading

    // 1. Get Values (Make sure your HTML IDs match these!)
    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-password');
    const roleInput = document.getElementById('reg-role');

    if (!nameInput || !emailInput || !passInput) {
        console.error("Missing ID in register.html. Check for reg-name, reg-email, reg-password.");
        return;
    }

    const name = nameInput.value;
    const email = emailInput.value;
    const password = passInput.value;
    const role = roleInput ? roleInput.value : 'Employee'; // Default to Employee

    if(!name || !email || !password) {
        alert("Please fill in all fields");
        return;
    }

    try {
        // 2. Send to Server
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await response.json();

        if (data.success) {
            alert("Registration Successful! Please Login.");
            window.location.href = 'index.html'; // Go to login page
        } else {
            alert("Error: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Server Error. Is the database connected?");
    }
}

async function handleLogin(event) {
    if(event) event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showPopup("Wait!", "Please enter your email and password", false);
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('adminName', data.user.name);
            if(data.user.profile_pic) localStorage.setItem('adminPic', data.user.profile_pic);

            if(data.user.role === 'Admin') {
                window.location.assign('/admin.html'); 
            } else {
                window.location.assign('/employee.html');
            }
        } else {
            showPopup("Login Failed", data.message || "Invalid email or password", false);
        }
    } catch (err) { 
        console.error("Login Error:", err); 
        showPopup("Error", "Could not connect to the server", false); 
    }
}

/* --- CUSTOM POPUP LOGIC --- */
function showPopup(title, message, isSuccess = true) {
    const popup = document.getElementById('custom-popup');
    if (!popup) { alert(message); return; }

    const titleEl = document.getElementById('popup-title');
    const msgEl = document.getElementById('popup-message');
    const iconEl = document.querySelector('.popup-icon i');

    if(titleEl) titleEl.innerText = title;
    if(msgEl) msgEl.innerText = message;

    if (isSuccess) {
        if(iconEl) { iconEl.className = "fas fa-check-circle"; iconEl.style.color = "#2ecc71"; }
    } else {
        if(iconEl) { iconEl.className = "fas fa-times-circle"; iconEl.style.color = "#e74c3c"; }
    }
    popup.style.display = 'flex';
}

function closePopup() {
    const popup = document.getElementById('custom-popup');
    if(popup) popup.style.display = 'none';
    
    const titleEl = document.getElementById('popup-title');
    const path = window.location.pathname;

    // ONLY redirect to login if we are on the register page and just succeeded
    if (titleEl && titleEl.innerText === "Success!" && path.includes('register.html')) {
        window.location.href = 'index.html';
    }
    // Otherwise, do nothing so the user can see the Reset Password screen
}

/* --- PUBLIC PROFILE ID CARD MODAL --- */
function openProfileModal() {
    const modal = document.getElementById('profileCardModal');
    if (!modal) {
        console.error("Modal element 'profileCardModal' not found in HTML.");
        return;
    }
    
    // 1. Gather Data from the current page elements
    const name = document.getElementById('display-name')?.innerText || "User";
    const role = document.getElementById('display-role')?.innerText || "Manager";
    const avatar = document.getElementById('profile-img-preview')?.src || "";
    const email = document.getElementById('adminEmail')?.value || "No Email";
    const phone = document.getElementById('adminPhone')?.value || "No Phone";
    const joined = document.getElementById('stat-years')?.innerText || "Unknown";

    // 2. Populate the ID Card Modal fields
    if(document.getElementById('card-name')) document.getElementById('card-name').innerText = name;
    if(document.getElementById('card-role')) document.getElementById('card-role').innerText = role;
    if(document.getElementById('card-avatar')) document.getElementById('card-avatar').src = avatar;
    if(document.getElementById('card-email')) document.getElementById('card-email').innerText = email;
    if(document.getElementById('card-phone')) document.getElementById('card-phone').innerText = phone;
    if(document.getElementById('card-joined')) document.getElementById('card-joined').innerText = joined;

    const banner = document.getElementById('account-banner-bg');
    const cardCoverImg = document.getElementById('card-cover');
    if (banner && cardCoverImg) {
        const coverUrl = banner.style.backgroundImage.slice(5, -2).replace(/"/g, "");
        if (coverUrl && coverUrl !== 'none' && coverUrl !== '') {
            cardCoverImg.src = coverUrl;
            cardCoverImg.style.display = 'block';
        } else {
            cardCoverImg.style.display = 'none';
        }
    }

    const qrImg = document.querySelector('.qr-code');

    if(qrImg) {
        // 2. Prepare the data you want the phone to see
        const name = document.getElementById('card-name').innerText;
        const email = document.getElementById('card-email').innerText;
        const phone = document.getElementById('card-phone').innerText;
        
        const qrData = `Name: ${name}\nRole: MANAGER\nEmail: ${email}\nPhone: ${phone}\nCompany: Nexus Global Corp`;
        
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    }

    
    modal.style.display = 'flex';
}

function closeProfileModal() {
    const modal = document.getElementById('profileCardModal');
    if(modal) modal.style.display = 'none';
}

async function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks(currentProjectId);
}

async function editTask(id) {
    try {
        // 1. Fetch current details from server
        const response = await fetch(`/api/task-details/${id}`);
        const task = await response.json();

        // 2. Fill the modal boxes
        document.getElementById('editTaskId').value = id;
        document.getElementById('editTaskTitle').value = task.title || "";
        document.getElementById('editTaskAssignee').value = task.assignee || "";

        document.getElementById('editTaskModal').style.display = 'flex';
    } catch (err) {
        console.error("Edit failed:", err);
    }
}

// --- ONLY KEEP THIS ONE VERSION ---
async function submitEditTask(e) {
    e.preventDefault();
    
    // 1. Get the data from your modal inputs
    const id = document.getElementById('editTaskId').value;
    const title = document.getElementById('editTaskTitle').value;
    const assignee = document.getElementById('editTaskAssignee').value; 

    // Debugging: This will show in your browser console (F12)
    console.log("Saving Task:", { id, title, assignee });

    try {
        const response = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // 2. Send BOTH Title and Assignee to the server
            body: JSON.stringify({ title, assignee })
        });

        if (response.ok) {
            closeEditModal();
            loadTasks(currentProjectId); // Refresh the board instantly
        }
    } catch (err) {
        console.error("Save failed:", err);
    }
}



// 2. CLOSE THE MODAL
function closeEditModal() {
    document.getElementById('editTaskModal').style.display = 'none';
}




async function deleteProject(id) {
    if (!confirm("Are you sure you want to delete this project and all its tasks?")) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    location.reload(); 
}

async function editSelected() {
    // 1. Find the selected checkbox FIRST
    const selected = document.querySelector('.emp-checkbox:checked');
    
    // 2. NOW check if it exists
    if (!selected) {
        alert("Please select an employee to edit.");
        return;
    }

    const userId = selected.value;
    
    try {
        await fillEmployeeDeptDropdown(); 
        await fillTeamDropdown(); 

        const response = await fetch(`/api/account/${userId}`);
        const user = await response.json();

        // Fill the modal fields
        if(document.getElementById('empName')) document.getElementById('empName').value = user.name;
        if(document.getElementById('empEmail')) document.getElementById('empEmail').value = user.email;
        if(document.getElementById('empRole')) document.getElementById('empRole').value = user.role;
        if(document.getElementById('empDept')) document.getElementById('empDept').value = user.department;
        if(document.getElementById('empTeam')) document.getElementById('empTeam').value = user.team_id || "";
        
        const modalTitle = document.querySelector('#addEmployeeModal h3') || 
                           document.querySelector('#addEmployeeModal h2');
        if(modalTitle) modalTitle.innerText = "Edit Employee";
        
        document.getElementById('addEmployeeModal').style.display = 'flex';

    } catch (err) { console.error("Failed to load employee for editing:", err); }
}


let allTeamsData = [];
async function loadTeams() {
    const grid = document.getElementById('team-grid');
    if (!grid) return;

    try {
        const response = await fetch('/api/teams-full-detail?t=' + Date.now());
        const result = await response.json();
        
        allTeamsData = result.data; 
        grid.innerHTML = '';

        const addCard = document.createElement('div');
        addCard.className = 'dept-card add-new-card';
        addCard.onclick = () => openTeamModal();
        addCard.innerHTML = `<div style="text-align:center; color: #1abc9c;"><i class="fas fa-plus-circle" style="font-size: 3rem; margin-bottom: 10px;"></i><h3>Create Team</h3></div>`;
        grid.appendChild(addCard);

        allTeamsData.forEach(team => {
            let membersListHtml = team.members.map(m => {
                // Split the combined strings back into arrays to show them line-by-line
                const tasks = m.task_names ? m.task_names.split(', ') : ['No Task'];
                
                return `
                    <div style="margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                        <b style="color: #2c3e50; font-size: 0.95rem;">${m.name}</b><br>
                        <div style="margin-top: 4px;">
                            ${tasks.map(t => `<small style="display: block; color: #7f8c8d;">• Task: ${t}</small>`).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            const card = document.createElement('div');
            card.className = 'dept-card';
            card.innerHTML = `
                <div class="dept-header">
                    <div class="dept-info">
                        <h3>${team.team_name}</h3>
                        <span>Lead: ${team.team_lead}</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" onclick="prepareEditTeam(${team.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" onclick="deleteTeam(${team.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="team-members-list" style="margin-top: 15px; max-height: 150px; overflow-y: auto;">
                    <p style="font-weight: bold; font-size: 0.8rem; color: #34495e;">MEMBERS & TASKS:</p>
                    ${membersListHtml || '<p><small>No members assigned</small></p>'}
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) { console.error("Load Teams Error:", e); }
}

function prepareEditTeam(teamId) {
    // Find the team object from our global array
    const team = allTeamsData.find(t => t.id === teamId);
    if (team) {
        openTeamModal(team);
    }
}

// 1. Fill the Department Dropdown in the Team Modal
async function fillDeptDropdown() {
    const select = document.getElementById('teamDeptSelect');
    if (!select) return;

    try {
        const response = await fetch('/api/departments');
        const result = await response.json();
        
        
        select.innerHTML = '<option value="">-- Select Department --</option>';
        
        result.data.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.name;
            option.innerText = dept.name;
            select.appendChild(option);
        });
    } catch (e) { console.error("Failed to load departments for dropdown:", e); }
}

// 2. Open/Close Modal
async function openTeamModal(team = null) {
    const modal = document.getElementById('teamModal');
    const container = document.getElementById('team-member-selector');
    
    if (team) {
        document.getElementById('teamModalTitle').innerText = "Edit Team";
        document.getElementById('teamId').value = team.id;
        document.getElementById('teamName').value = team.team_name;
        document.getElementById('teamDeptSelect').value = team.department_name;
        document.getElementById('teamLead').value = team.team_lead;

        // 1. Get the list of IDs for the people currently in this team
        const currentMemberIds = team.members ? team.members.map(m => m.id) : [];

        // 2. Load the list AND check the boxes in one step
        // We pass the IDs as the second argument
        await refreshMemberSelector(team.department_name, currentMemberIds);
        
    } else {
        document.getElementById('teamModalTitle').innerText = "Add New Team";
        document.getElementById('teamForm').reset();
        document.getElementById('teamId').value = '';
        if (container) container.innerHTML = '<p>Select a department first...</p>';
    }
    modal.style.display = 'flex';
}

function closeTeamModal() {
    document.getElementById('teamModal').style.display = 'none';
}

// 3. Handle Submit (Add or Update)
async function handleTeamSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('teamId').value;
    const team_name = document.getElementById('teamName').value;
    const department_name = document.getElementById('teamDeptSelect').value;
    const team_lead = document.getElementById('teamLead').value;

    const checkedBoxes = document.querySelectorAll('.team-member-checkbox:checked');
    const member_ids = Array.from(checkedBoxes).map(cb => cb.value);

    const url = id ? `/api/teams/${id}` : '/api/teams';
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team_name, department_name, team_lead, member_ids })
        });

        if (response.ok) {
            
            await loadTeams(); 
            
            closeTeamModal();
            console.log("Team saved and UI updated successfully!");
        } else {
            const errorData = await response.json();
            alert("Error saving team: " + errorData.message);
        }
    } catch (err) {
        console.error("Team save failed:", err);
    }
}

// 4. Delete Team
async function deleteTeam(id) {
    if (!confirm("Are you sure you want to delete this team?")) return;
    try {
        await fetch(`/api/teams/${id}`, { method: 'DELETE' });
        loadTeams();
    } catch (e) { console.error("Delete failed:", e); }
}

async function fillTeamDropdown() {
    // 1. Find the dropdown in your Employee Modal
    const teamSelect = document.getElementById('empTeam');
    if (!teamSelect) return;

    try {
        // 2. Fetch the latest teams from your database
        const response = await fetch('/api/teams');
        const result = await response.json();
        
        // 3. Clear existing options and add the default "No Team"
        teamSelect.innerHTML = '<option value="">-- No Team (General) --</option>';
        
        // 4. Populate with fresh data
        if (result.success && result.data) {
            result.data.forEach(team => {
                const option = document.createElement('option');
                option.value = team.id; 
                option.innerText = team.team_name;
                teamSelect.appendChild(option);
            });
        }
    } catch (e) { 
        console.error("Failed to load teams for employee modal:", e); 
    }
}

async function refreshMemberSelector(selectedDept, memberIdsToCheck = []) {
    const container = document.getElementById('team-member-selector');
    if (!container || !selectedDept) return;

    try {
        const response = await fetch('/api/users');
        const result = await response.json();
        const filteredUsers = result.data.filter(user => user.department === selectedDept);

        container.innerHTML = filteredUsers.map(user => {
            const isChecked = memberIdsToCheck.some(mId => mId == user.id) ? 'checked' : '';
            
            return `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <input type="checkbox" class="team-member-checkbox" 
                           value="${user.id}" id="user-${user.id}" ${isChecked}>
                    <label for="user-${user.id}" style="margin-left: 10px; cursor: pointer;">
                        ${user.name}
                    </label>
                </div>`;
        }).join('');
    } catch (e) { console.error("Error loading members:", e); }
}

// Add a check to see if the element exists before adding the listener
const deptDropdown = document.getElementById('teamDeptSelect');
if (deptDropdown) {
    deptDropdown.addEventListener('change', (e) => {
        refreshMemberSelector(e.target.value);
    });
}

async function loadDepartmentsOverview() {
    const container = document.querySelector('.Departments-Overview');
    if (!container) return;

    const cardBody = container.querySelector('.card-body');

    try {
        const response = await fetch('/api/departments?t=' + Date.now());
        const result = await response.json();

        if (result.success && result.data) {
            cardBody.innerHTML = ''; 

            cardBody.innerHTML = result.data.map(dept => {
                let icon = "fa-building";
                if (dept.name.toLowerCase().includes('it')) icon = "fa-code";
                if (dept.name.toLowerCase().includes('marketing')) icon = "fa-bullhorn";
                if (dept.name.toLowerCase().includes('management')) icon = "fa-briefcase";

                return `
                    <div class="customer" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <div class="info" style="display: flex; align-items: center;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: #f0f2f5; display: flex; align-items: center; justify-content: center; margin-right: 1rem;">
                                <span class="fas ${icon}" style="color: #1abc9c;"></span>
                            </div>
                            <div>
                                <h4 style="font-size: 0.9rem; margin: 0;">${dept.name}</h4>
                                <small style="color: #7f8c8d;">${dept.emp_count || 0} Employees</small>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.error("Dashboard Sync Error:", e);
    }
}

async function fillProjectDeptDropdown() {
    // 1. Target the dropdown in the "Start New Project" modal
    const select = document.getElementById('projDept');
    if (!select) return;

    try {
        // 2. Fetch the latest departments
        const response = await fetch('/api/departments?t=' + Date.now());
        const result = await response.json();

        // 3. Clear old static options and add the default one
        select.innerHTML = '<option value="">-- Select Department --</option>';

        // 4. Populate with real data from the database
        if (result.success && result.data) {
            result.data.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.name;
                option.innerText = dept.name;
                select.appendChild(option);
            });
            console.log("Project Department dropdown synchronized.");
        }
    } catch (e) { 
        console.error("Failed to sync project departments:", e); 
    }
}
async function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    const chatPanel = document.getElementById('chat-list-panel'); // Target the other panel

    if (panel) {
        if (chatPanel) chatPanel.style.display = 'none'; // CLOSE CHAT FIRST
        
        const isOpening = (panel.style.display !== 'block');
        panel.style.display = isOpening ? 'block' : 'none';
        
        if (isOpening) loadNotifications();
    }
}

function toggleChatPanel() {
    const panel = document.getElementById('chat-panel');
    const notifPanel = document.getElementById('notif-panel');
    
    // Close notifications if they're open
    notifPanel.style.display = 'none';
    
    // Toggle chat panel
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
    
    if(panel.style.display === 'block') ;
}

// Close panels if user clicks anywhere else on the screen
window.onclick = function(event) {
    if (!event.target.closest('.action-item')) {
        document.getElementById('notif-panel').style.display = 'none';
        document.getElementById('chat-panel').style.display = 'none';
    }
}

let activeChatId = null;

// 1. Show the list of people to chat with
function toggleChatList() {
    const panel = document.getElementById('chat-list-panel');
    const notifPanel = document.getElementById('notif-panel'); // Target the other panel

    if (panel) {
        if (notifPanel) notifPanel.style.display = 'none'; // CLOSE NOTIFICATIONS FIRST
        
        const isOpening = (panel.style.display !== 'block');
        panel.style.display = isOpening ? 'block' : 'none';
        
        if (isOpening) {
            loadChatParticipants();
            // Reset badge when opening chat list
            const chatBadge = document.getElementById('chat-count');
            if (chatBadge) chatBadge.style.display = 'none';
        }
    }
}
async function loadChatParticipants() {
    const listContainer = document.getElementById('employee-chat-list');
    if (!listContainer) return;

    try {
        // 1. Fetch all users
        const res = await fetch('/api/users?t=' + Date.now());
        const result = await res.json();
        const currentUser = JSON.parse(localStorage.getItem('user'));
        
        
        const usersList = result.data || result; 

        if (usersList && usersList.length > 0) {
            
            const otherUsers = usersList.filter(u => u.id !== currentUser.id);

            
            const usersWithStatus = await Promise.all(otherUsers.map(async (u) => {
                let hasUnread = false;
                try {
                    // Fetch history
                    const hRes = await fetch(`/api/chat/history/${currentUser.id}/${u.id}?t=` + Date.now());
                    const hData = await hRes.json();
                    
                    
                    if (hData && hData.data) {
                        
                        hasUnread = hData.data.some(m => m.sender_id == u.id && m.is_read == 0);
                    }
                } catch (err) { }
                
                return { ...u, hasUnread };
            }));

            
            listContainer.innerHTML = usersWithStatus.map(u => {
                const displayRole = u.role ? u.role : 'Manager';
                
                
                const nameColor = u.hasUnread ? '#2ecc71' : '#2c3e50'; 
                const fontWeight = u.hasUnread ? 'bold' : 'normal';
                
                
                const dotHtml = u.hasUnread ? 
                    `<span style="width:10px; height:10px; background:#2ecc71; border-radius:50%; margin-left:auto; box-shadow: 0 0 5px rgba(46, 204, 113, 0.5);"></span>` 
                    : '';

                return `
                    <div class="user-chat-item" onclick="openPrivateChat(${u.id}, '${u.name}')" 
                         style="padding: 12px; border-bottom: 1px solid #f4f7f6; display: flex; align-items: center; gap: 12px; cursor: pointer;">
                        
                        <img src="https://ui-avatars.com/api/?name=${u.name}&background=random" width="35" style="border-radius: 50%;">
                        
                        <div style="flex: 1;">
                            <h4 style="margin:0; font-size: 0.9rem; color: ${nameColor}; font-weight: ${fontWeight};">
                                ${u.name}
                            </h4>
                            <small style="color: #95a5a6;">${displayRole}</small>
                        </div>
                        
                        ${dotHtml}
                    </div>
                `;
            }).join('');
        }
    } catch (e) { console.error("Chat list error:", e); }
}

window.onclick = function(event) {
    if (!event.target.closest('.action-item')) {
        const notif = document.getElementById('notif-panel');
        const chat = document.getElementById('chat-list-panel');
        
        // Only try to hide them if they actually exist on this page
        if (notif) notif.style.display = 'none';
        if (chat) chat.style.display = 'none';
    }
}
// 2. Open the Middle Popup
function openPrivateChat(userId, userName) {
    activeChatId = userId;
    document.getElementById('chat-with-name').innerText = "Chat with " + userName;
    document.getElementById('chat-popup').style.display = 'flex';
    document.getElementById('chat-list-panel').style.display = 'none'; // Close the list
    loadPrivateHistory();
}

function closeChatPopup() {
    document.getElementById('chat-popup').style.display = 'none';
    activeChatId = null;
}


async function loadPrivateHistory() {
    const history = document.getElementById('popup-messages');
    if (!history || !activeChatId) return; 

    const userStr = localStorage.getItem('user');
    if(!userStr) return;
    const currentUser = JSON.parse(userStr);
    

    const myId = currentUser.id || 1; 

    try {
        
        const res = await fetch(`/api/chat/history/${myId}/${activeChatId}?t=` + Date.now());
        const result = await res.json();

        if (result.success && result.data) {
            history.innerHTML = result.data.map(m => {
                const isMe = (Number(m.sender_id) === Number(myId));
                return `
                    <div style="text-align: ${isMe ? 'right' : 'left'}; margin-bottom: 15px;">
                        <div style="display: inline-block; padding: 10px 15px; border-radius: 15px; 
                                    background: ${isMe ? '#1abc9c' : '#fff'}; 
                                    color: ${isMe ? 'white' : '#333'};
                                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                                    max-width: 80%; word-wrap: break-word;">
                            ${m.message}
                        </div>
                    </div> 
                `;
            }).join('');
            history.scrollTop = history.scrollHeight;
        }
    } catch (e) { console.error("Sync error:", e); }
}

async function sendPrivateMessage() {
    const input = document.getElementById('popupInput');
    const userStr = localStorage.getItem('user');
    if (!input || !input.value.trim() || !activeChatId || !userStr) return;
    
    const currentUser = JSON.parse(userStr);
    const myId = currentUser.id || 1; 

    try {
        await fetch('/api/chat/send-private', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sender_id: myId, 
                receiver_id: activeChatId, 
                sender_name: currentUser.name, 
                message: input.value.trim() 
            })
        });
        input.value = '';
        loadPrivateHistory(); 
    } catch (e) { console.error("Send error:", e); }
}

 

/* ==========================================================================
   BACKGROUND SYNC PROCESSES
   ========================================================================== */

// 1. Chat Sync (Fast - Every 3 seconds)
setInterval(() => {
    const popup = document.getElementById('chat-popup');
    // Only fetch from the database if the chat window is actually open
    if (activeChatId && popup && popup.style.display === 'flex') {
        loadPrivateHistory();
    }
}, 3000);

// 2. Notification Sync (Medium - Every 30 seconds)
setInterval(() => {
    // Only sync notifications if the user is actually logged in
    if (localStorage.getItem('user')) {
        loadNotifications();
    }
}, 30000);

// Add event listeners to your toggles in your DOMContentLoaded block
document.querySelectorAll('.notifications input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', saveNotificationPrefs);
});

async function loadNotifications() {
    const list = document.getElementById('notif-list');
    const countBadge = document.getElementById('notif-count');
    const userStr = localStorage.getItem('user');
    if (!userStr || !countBadge) return;
    const user = JSON.parse(userStr);

    try {
        const res = await fetch(`/api/sync-notifications?userId=${user.id}&t=` + Date.now());
        const result = await res.json();

        const unread = result.unreadCount || 0;
        countBadge.innerText = unread;
        countBadge.style.display = (unread > 0) ? 'block' : 'none';

        if (list && result.data) {
            list.innerHTML = result.data.map(n => {
                const isRead = n.is_read === 1;
                const bgColor = isRead ? '#ffffff' : '#f0fdf4';
                
                const titleColor = isRead ? '#333333' : '#1abc9c';

                const statusMark = isRead ? '<span style="color:#999; font-size:0.7rem;"><i class="fas fa-check-double"></i> Seen</span>' : 
                                            '<span style="color:#1abc9c; font-size:0.7rem;"><i class="fas fa-circle"></i> New</span>';

                return `
                    <div class="notif-item" 
                        onclick="markNotifAsRead(${n.id})" 
                        style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; background: ${bgColor}; border-left: 4px solid ${isRead ? 'transparent' : '#1abc9c'};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <small style="color: ${titleColor}; font-weight: bold;">${n.type}</small>
                            ${statusMark}
                        </div>
                        <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #333;">${n.content}</p>
                    </div>
                `;
            }).join('');
        }
    } catch (e) { console.error("Notification sync failed", e); }
}

async function markNotifAsRead(notifId) {
    try {
        const res = await fetch(`/api/notifications/read/${notifId}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (res.ok) {
            await loadNotifications();
        }
    } catch (e) { console.error("Notification update failed", e); }
}
async function saveNotificationPrefs() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    const prefs = {
        leave: document.getElementById('toggle-leave')?.checked || false,
        deadlines: document.getElementById('toggle-deadlines')?.checked || false,
        registration: document.getElementById('toggle-registration')?.checked || false,
        tasks: document.getElementById('toggle-tasks')?.checked || false // Save task preference
    };

    await fetch(`/api/account/update-notif-prefs/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
    });
}

async function requestResetCode() {
    const emailInput = document.getElementById('forgot-email');
    if (!emailInput || !emailInput.value) {
        alert("Please enter your email address.");
        return;
    }

    const email = emailInput.value;

    try {
        const response = await fetch('/api/request-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            // 1. Hide Step 1 and Show Step 2 immediately
            document.getElementById('step-1').style.display = 'none';
            document.getElementById('step-2').style.display = 'block';
            
            // 2. Clear any error messages
            if(document.getElementById('msg')) document.getElementById('msg').innerText = "";
            
            console.log("Step 2 revealed. Check your terminal for the code!");
        } else {
            if(document.getElementById('msg')) document.getElementById('msg').innerText = data.message;
        }
    } catch (err) {
        console.error("Request failed:", err);
    }
}
async function verifyAndReset() {
    // 1. CAPTURE THE VALUES FIRST
    const email = document.getElementById('forgot-email').value;
    const code = document.getElementById('reset-code').value;
    const newPassword = document.getElementById('reset-new-pass').value;

    // 2. SAFETY CHECK: Ensure they aren't empty
    if (!code || !newPassword) {
        alert("Please fill in both fields.");
        return;
    }

    // 3. CREATE THE DATA OBJECT
    const bodyData = { 
        email: email, 
        code: code, 
        password: newPassword // Matches the 'password' column in your DB
    };

    try {
        const response = await fetch('/api/verify-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();

        if (data.success) {
            showPopup("Success!", "Password updated! You can now login.");
            setTimeout(() => { window.location.href = 'index.html'; }, 3000);
        } else {
            if(document.getElementById('msg')) {
                document.getElementById('msg').innerText = data.message;
            }
        }
    } catch (err) { 
        console.error("Verification failed:", err); 
    }
}
async function loadEmployeeDashboard() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    try {
        // 1. Fetch Stats (Keep your existing stats fetch)
        const statsRes = await fetch(`/api/employee-stats/${user.id}`);
        const statsData = await statsRes.json();
        if (statsData.success) {
            document.getElementById('emp-total-tasks').innerText = statsData.myTasks;
            document.getElementById('emp-pending-leaves').innerText = statsData.pendingLeaves;
            document.getElementById('emp-active-projects').innerText = statsData.myProjects;
        }

        // 2. Fetch Team Members
        const teamRes = await fetch(`/api/my-teammates/${user.id}?t=` + Date.now());
        const teamData = await teamRes.json();
        const teamList = document.getElementById('team-members-list');

        if (teamData.success && teamData.members.length > 0) {
            // Show Team Name and Leader in the header
            document.getElementById('my-team-title').innerHTML = `
                Team: <b>${teamData.teamName}</b> | Lead: <span style="color: #e67e22;">${teamData.teamLead}</span>
            `;

            teamList.innerHTML = teamData.members.map(m => `
                <div class="customer" style="border-bottom: 1px solid #f0f0f0; padding: 10px 0;">
                    <div class="info" style="display: flex; align-items: center;">
                        <img src="https://ui-avatars.com/api/?name=${m.name}&background=random" width="30px" height="30px" style="border-radius:50%; margin-right: 10px;" >
                        <div>
                            <h4 style="margin:0; font-size: 0.85rem;">
                                ${m.name} ${m.name === teamData.teamLead ? '👑' : ''} ${m.id === user.id ? '(Me)' : ''}
                            </h4>
                            <small style="color: #999;">${m.role}</small>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            teamList.innerHTML = '<p style="padding:1rem; color:#999;">You are not assigned to a team yet.</p>';
        }

        // 3. Load Leave History (The function we built earlier)
        loadMyLeaveHistory();

    } catch (e) { console.error("Dash Load Error:", e); }
}

function injectSidebar() {
    const sidebarContainer = document.querySelector('.sidebar');
    if (!sidebarContainer) return;

    const user = JSON.parse(localStorage.getItem('user'));
    const role = user ? user.role : 'Employee';
    const activePath = window.location.pathname;

   
    const brandTitle = (role === 'Admin') ? 'HR Manager' : 'Employee ';
    const brandIcon = (role === 'Admin') ? 'fa-user-tie' : 'fa-user';
   

    
    const adminLinks = `
        <li><a href="/admin.html" ${activePath.includes('admin.html') ? 'class="active"' : ''}><span class="fas fa-igloo"></span> <span>Dashboard</span></a></li>
        <li><a href="/employees.html" ${activePath.includes('employees.html') ? 'class="active"' : ''}><span class="fas fa-users"></span> <span>Employees</span></a></li>
        <li><a href="/departments.html" ${activePath.includes('departments.html') ? 'class="active"' : ''}><span class="fas fa-building"></span> <span>Departments</span></a></li>
        <li><a href="/teams.html" ${activePath.includes('teams.html') ? 'class="active"' : ''}><span class="fas fa-user-friends"></span> <span>Teams</span></a></li>
        <li><a href="/tasks.html" ${activePath.includes('tasks.html') ? 'class="active"' : ''}><span class="fas fa-tasks"></span> <span>Tasks & Projects</span></a></li>
        <li><a href="/leaves.html" ${activePath.includes('leaves.html') ? 'class="active"' : ''}><span class="fas fa-clipboard-list"></span> <span>Leaves</span></a></li>
    `;

    
    const employeeLinks = `
        <li><a href="/employee.html" ${activePath.includes('employee.html') ? 'class="active"' : ''}><span class="fas fa-igloo"></span> <span>Dashboard</span></a></li>
        <li><a href="/operations.html" ${activePath.includes('operations.html') ? 'class="active"' : ''}><span class="fas fa-project-diagram"></span> <span>Operations</span></a></li>
        <li><a href="/my-leaves.html" ${activePath.includes('my-leaves.html') ? 'class="active"' : ''}><span class="fas fa-clipboard-list"></span> <span>My Leaves</span></a></li>
    `;

    const sharedLinks = `
        <li><a href="calendar.html" ${activePath.includes('calendar.html') ? 'class="active"' : ''}><span class="fas fa-calendar-alt"></span> <span>Calendar</span></a></li>
        <li><a href="account.html" ${activePath.includes('account.html') ? 'class="active"' : ''}><span class="fas fa-user-circle"></span> <span>Account</span></a></li>
        <li><a href="#" onclick="logout()"><span class="fas fa-sign-out-alt"></span> <span>Logout</span></a></li>
    `;

    sidebarContainer.innerHTML = `
        <div class="sidebar-brand">
            <h2><span class="fas ${brandIcon}"></span> <span>${brandTitle}</span></h2>
        </div>
        <div class="sidebar-menu">
            <ul>
                ${role === 'Admin' ? adminLinks : employeeLinks}
                ${sharedLinks}
            </ul>
        </div>
    `;
}

async function loadOperationsData() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    try {
        
        const userRes = await fetch(`/api/users?t=${Date.now()}`);
        const userResult = await userRes.json();
        const me = userResult.data.find(u => u.id === user.id);

        if (me) {
            document.getElementById('op-dept-name').innerText = me.department || "General Staff";
            document.getElementById('op-team-name').innerText = me.team_name || "No Team Assigned";
        }

        
        const taskRes = await fetch(`/api/tasks-by-assignee/${encodeURIComponent(user.name)}`);
        const taskResult = await taskRes.json();

        const tableBody = document.getElementById('op-tasks-body');
        if (taskResult.data && taskResult.data.length > 0) {
            tableBody.innerHTML = taskResult.data.map(task => `
                <tr>
                    <td><b>${task.project_title || 'General'}</b></td>
                    <td>${task.title}</td>
                    <td><span class="task-tag tag-${task.priority || 'Medium'}">${task.priority || 'Medium'}</span></td>
                    <td>
                        <select onchange="moveTask(${task.id}, this.value)" style="padding: 5px; border-radius: 50px; border: 1px solid #ddd;">
                            <option value="To Do" ${task.status === 'To Do' ? 'selected' : ''}>To Do</option>
                            <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Done" ${task.status === 'Done' ? 'selected' : ''}>Done</option>
                        </select>
                    </td>
                </tr>
            `).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #999;">No tasks assigned to you yet.</td></tr>';
        }
    } catch (e) { console.error("Operations Load Error:", e); }
}

// 1. Fill the dropdown with only people who have the 'Admin' role
async function fillAdminDropdown() {
    const select = document.getElementById('leave-admin-select');
    if (!select) return;

    try {
        const res = await fetch('/api/users');
        const result = await res.json();
        const admins = result.data.filter(u => u.role === 'Admin');

        select.innerHTML = '<option value="">-- Select Admin --</option>';
        admins.forEach(admin => {
            select.innerHTML += `<option value="${admin.id}">${admin.name}</option>`;
        });
    } catch (e) { console.error(e); }
}

// 2. Submit the form data to the server
async function submitLeave(e) {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('user'));
    
    const leaveData = {
        employee_name: user.name,
        admin_id: document.getElementById('leave-admin-select').value,
        days: document.getElementById('leave-days').value, 
        type: document.getElementById('leave-type').value,
        reason: document.getElementById('leave-reason').value // Don't add (Days) here manually
    };

    try {
        const res = await fetch('/api/leaves/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leaveData)
        });

        // --- SUCCESS BLOCK ---
        if (res.ok) {
            showPopup("Success!", "Leave request sent to admin.");
            document.getElementById('leave-form').reset();
            
            loadMyLeaveHistory(); 
        }
    } catch (err) { 
        console.error("Submit failed:", err); 
    }
}

// 1. Fetch and display only MY leave requests
async function loadMyLeaveHistory() {
    const user = JSON.parse(localStorage.getItem('user'));
    // We trim the name just in case of that "Imane Sahib " extra space glitch
    const myName = user.name.trim(); 

    try {
        const res = await fetch(`/api/my-leaves/${encodeURIComponent(myName)}`);
        const result = await res.json();
        const tableBody = document.getElementById('my-leave-history');

        if (tableBody && result.data && result.data.length > 0) {
            tableBody.innerHTML = result.data.map(leave => {
                // Determine color
                let color = leave.status === 'Approved' ? '#2ecc71' : 
                            leave.status === 'Rejected' ? '#e74c3c' : '#f39c12';
                
                return `
                    <tr>
                        <td>${leave.leave_type}</td>
                        <td>${leave.reason}</td>
                        <td>
                            <span style="background:${color}; color:white; padding:4px 10px; border-radius:15px; font-size:0.8rem; font-weight:bold;">
                                ${leave.status}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        } else if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1.5rem; color:#999;">No history found.</td></tr>';
        }
    } catch (e) { console.error("History fetch failed:", e); }
}

// Background Sync to check for new messages
setInterval(async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    const chatPopup = document.getElementById('chat-popup');
    if (chatPopup && chatPopup.style.display !== 'flex') {
        try {
            const res = await fetch(`/api/chat/unread-count/${user.id}`);
            const data = await res.json();
            
            const badge = document.getElementById('chat-count');
            if (badge && data.unread > 0) {
                badge.innerText = data.unread;
                badge.style.display = 'block';
            }
        } catch (e) { /* silent fail */ }
    }
    }, 5000);
async function openPrivateChat(userId, userName) {
    activeChatId = userId;
    document.getElementById('chat-with-name').innerText = "Chat with " + userName;
    document.getElementById('chat-popup').style.display = 'flex';
    document.getElementById('chat-list-panel').style.display = 'none';

    const currentUser = JSON.parse(localStorage.getItem('user'));
    await fetch(`/api/chat/mark-read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ me: currentUser.id, sender: userId })
    });

    loadPrivateHistory();
}
async function markNotifAsRead(notifId) {
    try {
        const res = await fetch(`/api/notifications/read/${notifId}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            await loadNotifications(); 
            console.log(`Notification ${notifId} marked as read.`);
        }
    } catch (e) { 
        console.error("Failed to update notification status:", e); 
    }
}