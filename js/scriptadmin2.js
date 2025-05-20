// Initialize Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loader = document.querySelector('.loader-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const navLinks = document.querySelectorAll('.sidebar-nav a');
const contentSections = document.querySelectorAll('.content-section');
const menuItemsGrid = document.getElementById('menu-items-grid');
const menuModal = document.getElementById('menu-modal');
const menuForm = document.getElementById('menu-form');
const closeMenuModal = document.getElementById('close-menu-modal');
const staffModal = document.getElementById('staff-modal');
const staffForm = document.getElementById('staff-form');
const closeStaffModal = document.getElementById('close-staff-modal');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Global Variables
let currentAdmin = null;
let menuItems = [];
let orders = [];
let customers = [];
let staff = [];

// Check Authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const adminDoc = await db.collection('users').doc(user.uid).get();
            const adminData = adminDoc.data();
            
            if (adminData && adminData.role === 'admin') {
                currentAdmin = { ...adminData, uid: user.uid };
                initializeApp();
            } else {
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            showToast('Error verifying admin credentials');
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Initialize App
async function initializeApp() {
    await Promise.all([
        loadMenuItems(),
        loadOrders(),
        loadCustomers(),
        loadStaff()
    ]);
    
    setupRealtimeListeners();
    initializeCharts();
    
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 500);
}

// Load Menu Items
async function loadMenuItems() {
    try {
        const snapshot = await db.collection('menuItems').get();
        menuItems = snapshot.docs.map(doc => ({
            id: parseInt(doc.id),
            ...doc.data()
        }));
        displayMenuItems();
    } catch (error) {
        console.error('Error loading menu items:', error);
        showToast('Error loading menu items');
    }
}

// Display Menu Items
function displayMenuItems() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    let filteredItems = menuItems;
    
    if (searchTerm) {
        filteredItems = menuItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.category.toLowerCase().includes(searchTerm)
        );
    }
    
    menuItemsGrid.innerHTML = '';
    
    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'menu-item';
        
        card.innerHTML = `
            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-category">${item.category}</div>
                <div class="item-price">₹${item.price}</div>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${item.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-btn" data-id="${item.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        menuItemsGrid.appendChild(card);
    });
    
    // Add event listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemId = parseInt(btn.dataset.id);
            openMenuModal(itemId);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemId = parseInt(btn.dataset.id);
            deleteMenuItem(itemId);
        });
    });
}

// Delete Menu Item
async function deleteMenuItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
        await db.collection('menuItems').doc(itemId.toString()).delete();
        menuItems = menuItems.filter(item => item.id !== itemId);
        displayMenuItems();
        showToast('Menu item deleted successfully');
    } catch (error) {
        console.error('Error deleting menu item:', error);
        showToast('Error deleting menu item');
    }
}

// Load Orders with Statistics
async function loadOrders() {
    try {
        const snapshot = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .get();
        
        orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateOrderStats();
        displayOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        showToast('Error loading orders');
    }
}

// Update Order Statistics
function updateOrderStats() {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    document.getElementById('total-orders').textContent = totalOrders;
    document.getElementById('total-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
    document.getElementById('avg-order-value').textContent = `₹${avgOrderValue.toFixed(2)}`;
}

// Load Customers
async function loadCustomers() {
    try {
        const snapshot = await db.collection('users')
            .where('role', '==', 'customer')
            .get();
        
        customers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateCustomerStats();
        displayCustomers();
    } catch (error) {
        console.error('Error loading customers:', error);
        showToast('Error loading customers');
    }
}

// Update Customer Statistics
function updateCustomerStats() {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(customer => {
        const lastOrder = orders.find(order => order.userId === customer.id);
        if (!lastOrder) return false;
        const lastOrderDate = lastOrder.createdAt.toDate();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return lastOrderDate > thirtyDaysAgo;
    }).length;
    
    document.getElementById('total-customers').textContent = totalCustomers;
    document.getElementById('active-customers').textContent = activeCustomers;
}

// Load Staff Members
async function loadStaff() {
    try {
        const snapshot = await db.collection('users')
            .where('role', 'in', ['staff', 'admin'])
            .get();
        
        staff = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayStaff();
    } catch (error) {
        console.error('Error loading staff:', error);
        showToast('Error loading staff');
    }
}

// Initialize Charts
function initializeCharts() {
    // Revenue Trends
    const revenueCtx = document.getElementById('revenue-chart').getContext('2d');
    new Chart(revenueCtx, {
        type: 'line',
        data: getRevenueData(),
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // Popular Items
    const itemsCtx = document.getElementById('popular-items-chart').getContext('2d');
    new Chart(itemsCtx, {
        type: 'bar',
        data: getPopularItemsData(),
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // Order Time Distribution
    const timeCtx = document.getElementById('order-time-chart').getContext('2d');
    new Chart(timeCtx, {
        type: 'bar',
        data: getOrderTimeData(),
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // Customer Growth
    const growthCtx = document.getElementById('customer-growth-chart').getContext('2d');
    new Chart(growthCtx, {
        type: 'line',
        data: getCustomerGrowthData(),
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Show Toast Message
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Event Listeners
document.getElementById('add-item-btn').addEventListener('click', () => openMenuModal());
document.getElementById('add-staff-btn').addEventListener('click', () => openStaffModal());

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        const section = link.dataset.section;
        
        navLinks.forEach(l => l.parentElement.classList.remove('active'));
        link.parentElement.classList.add('active');
        
        contentSections.forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
        
        // Update header title
        document.querySelector('.header-middle h2').textContent = 
            section.charAt(0).toUpperCase() + section.slice(1) + ' Dashboard';
    });
});

logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut();
    }
});

// Setup Realtime Listeners
function setupRealtimeListeners() {
    // Menu Items Listener
    db.collection('menuItems').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const item = { id: parseInt(change.doc.id), ...change.doc.data() };
            
            if (change.type === 'added' || change.type === 'modified') {
                const index = menuItems.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    menuItems[index] = item;
                } else {
                    menuItems.push(item);
                }
            } else if (change.type === 'removed') {
                menuItems = menuItems.filter(i => i.id !== item.id);
            }
        });
        
        displayMenuItems();
    });
    
    // Orders Listener
    db.collection('orders')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            let hasChanges = false;
            
            snapshot.docChanges().forEach(change => {
                const order = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added') {
                    if (!orders.some(o => o.id === order.id)) {
                        hasChanges = true;
                        orders.unshift(order);
                    }
                } else if (change.type === 'modified') {
                    const index = orders.findIndex(o => o.id === order.id);
                    if (index !== -1) {
                        hasChanges = true;
                        orders[index] = order;
                    }
                } else if (change.type === 'removed') {
                    const initialLength = orders.length;
                    orders = orders.filter(o => o.id !== order.id);
                    hasChanges = initialLength !== orders.length;
                }
            });
            
            if (hasChanges) {
                updateOrderStats();
                displayOrders();
                initializeCharts();
            }
        });
}
