// 業務目標數據
let salesTargets = {
    '詹采榆': 1000,
    '劉家昇': 1000,
    '施雯晴': 1000,
    '黃柏飛': 1000,
    '曹馨勻': 1000,
    '徐小凡': 1000
};

// 客戶數據存儲
let customers = [];
let customerIdCounter = 1;
let unsubscribe = null;

// 客戶清單密碼保護
const CUSTOMER_LIST_PASSWORD = '73648219';
let isCustomerListUnlocked = false;

// Firebase 數據庫操作
const COLLECTION_NAME = 'customers_2026';

// 客戶姓名隱碼函數
function maskCustomerName(name) {
    if (name.length <= 1) return name;
    if (name.length === 2) return name[0] + 'O';
    if (name.length === 3) return name[0] + 'O' + name[2];
    return name[0] + 'O'.repeat(name.length - 2) + name[name.length - 1];
}

// 顯示提示訊息
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 初始化 Firebase 連接
function initializeFirebase() {
    if (!window.db || !window.firestoreActions) {
        console.log('等待 Firebase 初始化...');
        setTimeout(initializeFirebase, 100);
        return;
    }
    
    console.log('Firebase 可用，開始設置監聽器');
    setupRealtimeListener();
    console.log('Firebase 初始化完成');
}

// 設置即時數據監聽
function setupRealtimeListener() {
    try {
        const { collection, query, orderBy, onSnapshot } = window.firestoreActions;
        const q = query(collection(window.db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        
        console.log('正在設置 Firestore 監聽器...');
        
        unsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('收到 Firestore 數據，文檔數量:', querySnapshot.size);
            customers = [];
            querySnapshot.forEach((doc) => {
                const customerData = { id: doc.id, ...doc.data() };
                customers.push(customerData);
                console.log('載入客戶:', customerData.maskedName || customerData.name);
            });
            
            // 更新 customerIdCounter
            if (customers.length > 0) {
                const maxId = Math.max(...customers.map(c => parseInt(c.numericId) || 0));
                customerIdCounter = maxId + 1;
            }
            
            console.log('載入客戶總數:', customers.length);
            updateAllDisplays();
        }, (error) => {
            console.error('監聽數據時出錯:', error);
            showToast('數據同步出錯，請刷新頁面', true);
        });
        
        console.log('Firestore 監聽器設置完成');
        
        // 備用：手動載入數據一次
        loadCustomersOnce();
    } catch (error) {
        console.error('設置監聽器時出錯:', error);
        showToast('初始化數據監聽失敗', true);
        // 如果監聽器失敗，嘗試手動載入數據
        loadCustomersOnce();
    }
}

// 手動載入客戶數據（備用方案）
async function loadCustomersOnce() {
    try {
        console.log('手動載入客戶數據...');
        const { collection, getDocs, query, orderBy } = window.firestoreActions;
        const q = query(collection(window.db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        console.log('手動載入文檔數量:', querySnapshot.size);
        
        customers = [];
        querySnapshot.forEach((doc) => {
            const customerData = { id: doc.id, ...doc.data() };
            customers.push(customerData);
            console.log('手動載入客戶:', customerData.maskedName || customerData.name);
        });
        
        // 更新 customerIdCounter
        if (customers.length > 0) {
            const maxId = Math.max(...customers.map(c => parseInt(c.numericId) || 0));
            customerIdCounter = maxId + 1;
        }
        
        console.log('手動載入客戶總數:', customers.length);
        updateAllDisplays();
        
    } catch (error) {
        console.error('手動載入數據時出錯:', error);
        showToast('載入數據失敗', true);
    }
}

// 保存數據到 Firestore - 修復版本
async function saveCustomerToFirestore(customerData) {
    try {
        console.log('嘗試保存到 Firestore:', customerData);
        
        if (!window.db || !window.firestoreActions) {
            throw new Error('Firebase 未初始化');
        }
        
        const { collection, addDoc } = window.firestoreActions;
        const docRef = await addDoc(collection(window.db, COLLECTION_NAME), customerData);
        
        console.log('Firestore 保存成功，文檔 ID:', docRef.id);
        showToast('客戶新增成功！');
        return docRef;
        
    } catch (error) {
        console.error('保存數據時出錯:', error);
        console.error('錯誤詳情:', error.code, error.message);
        
        if (error.code === 'permission-denied') {
            showToast('保存失敗：權限不足。請檢查 Firebase 安全規則設置。', true);
        } else if (error.code === 'unavailable') {
            showToast('保存失敗：網路連接問題，請重試。', true);
        } else {
            showToast(`保存失敗：${error.message}`, true);
        }
        throw error;
    }
}

// 更新客戶數據到 Firestore
async function updateCustomerInFirestore(customerId, customerData) {
    try {
        const { doc, updateDoc } = window.firestoreActions;
        await updateDoc(doc(window.db, COLLECTION_NAME, customerId), customerData);
        showToast('客戶資料更新成功！');
    } catch (error) {
        console.error('更新數據時出錯:', error);
        showToast('更新失敗，請重試', true);
    }
}

// 從 Firestore 刪除客戶數據
async function deleteCustomerFromFirestore(customerId) {
    try {
        const { doc, deleteDoc } = window.firestoreActions;
        await deleteDoc(doc(window.db, COLLECTION_NAME, customerId));
        showToast('客戶資料已刪除！');
    } catch (error) {
        console.error('刪除數據時出錯:', error);
        showToast('刪除失敗，請重試', true);
    }
}

// 新增客戶 - 修復版本
async function addCustomer(customerData) {
    console.log('開始新增客戶:', customerData.name);
    
    const newCustomer = {
        numericId: customerIdCounter++,
        name: customerData.name,
        maskedName: maskCustomerName(customerData.name),
        salesperson: customerData.salesperson,
        orderMonth: customerData.orderMonth,
        productType: customerData.productType,
        amount: parseInt(customerData.amount),
        createdAt: new Date().toISOString()
    };
    
    console.log('準備保存客戶數據:', newCustomer);
    
    try {
        await saveCustomerToFirestore(newCustomer);
        console.log('客戶數據保存成功');
    } catch (error) {
        console.error('新增客戶失敗:', error);
        showToast('新增客戶失敗，請重試', true);
    }
}

// 編輯客戶
function editCustomer(id, customerData) {
    const updatedData = {
        name: customerData.name,
        maskedName: maskCustomerName(customerData.name),
        salesperson: customerData.salesperson,
        orderMonth: customerData.orderMonth,
        productType: customerData.productType,
        amount: parseInt(customerData.amount),
        updatedAt: new Date().toISOString()
    };
    
    updateCustomerInFirestore(id, updatedData);
}

// 刪除客戶
function deleteCustomer(id) {
    // 檢查客戶清單是否已解鎖
    if (!isCustomerListUnlocked) {
        showToast('請先輸入密碼解鎖客戶清單', true);
        return;
    }

    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    // 第一次確認：基本確認
    if (!confirm('確定要刪除這筆客戶資料嗎？')) {
        return;
    }

    // 第二次確認：顯示詳細資訊防止誤刪
    const monthNames = {
        '2025-12': '2025年12月',
        '2026-01': '2026年1月',
        '2026-02': '2026年2月',
        '2026-03': '2026年3月',
        '2026-04': '2026年4月',
        '2026-05': '2026年5月',
        '2026-06': '2026年6月',
        '2026-07': '2026年7月',
        '2026-08': '2026年8月',
        '2026-09': '2026年9月',
        '2026-10': '2026年10月',
        '2026-11': '2026年11月'
    };
    const confirmMessage = `請再次確認刪除以下客戶資料：\n\n` +
                          `客戶：${customer.maskedName}\n` +
                          `業務：${customer.salesperson}\n` +
                          `月份：${monthNames[customer.orderMonth] || customer.orderMonth}\n` +
                          `商品：${customer.productType}\n` +
                          `金額：${customer.amount.toLocaleString()}萬元\n\n` +
                          `刪除後無法復原，確定要繼續嗎？`;

    if (confirm(confirmMessage)) {
        deleteCustomerFromFirestore(id);
    }
}

// 計算統計數據
function calculateStats() {
    const totalTarget = Object.values(salesTargets).reduce((sum, target) => sum + target, 0);
    const totalAchieved = customers.reduce((sum, customer) => sum + customer.amount, 0);
    const totalRemaining = totalTarget - totalAchieved;
    const progressPercentage = totalTarget > 0 ? (totalAchieved / totalTarget * 100).toFixed(1) : 0;
    
    return {
        totalTarget,
        totalAchieved,
        totalRemaining,
        progressPercentage
    };
}

// 計算各業務達成狀況
function calculateSalespersonStats() {
    const stats = {};
    
    Object.keys(salesTargets).forEach(salesperson => {
        const target = salesTargets[salesperson];
        const achieved = customers
            .filter(c => c.salesperson === salesperson)
            .reduce((sum, c) => sum + c.amount, 0);
        const remaining = target - achieved;
        const progress = target > 0 ? (achieved / target * 100).toFixed(1) : 0;
        
        stats[salesperson] = {
            target,
            achieved,
            remaining,
            progress: parseFloat(progress)
        };
    });
    
    return stats;
}

// 計算月份統計
function calculateMonthlyStats() {
    const months = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    const monthlyStats = {};
    
    months.forEach(month => {
        const monthCustomers = customers.filter(c => c.orderMonth === month);
        const total = monthCustomers.reduce((sum, c) => sum + c.amount, 0);
        const finance = monthCustomers
            .filter(c => c.productType === '理財')
            .reduce((sum, c) => sum + c.amount, 0);
        const insurance = monthCustomers
            .filter(c => c.productType === '保險')
            .reduce((sum, c) => sum + c.amount, 0);
        
        monthlyStats[month] = { total, finance, insurance };
    });
    
    return monthlyStats;
}

// 更新整體統計顯示
function updateOverviewStats() {
    const stats = calculateStats();
    
    document.getElementById('totalTarget').textContent = `${stats.totalTarget.toLocaleString()}萬`;
    document.getElementById('totalAchieved').textContent = `${stats.totalAchieved.toLocaleString()}萬`;
    document.getElementById('totalRemaining').textContent = `${stats.totalRemaining.toLocaleString()}萬`;
    document.getElementById('totalProgress').textContent = `${stats.progressPercentage}%`;
}

// 更新業務目標顯示
function updateTargetsDisplay() {
    const targetsGrid = document.getElementById('targetsGrid');
    const salespersonStats = calculateSalespersonStats();
    
    targetsGrid.innerHTML = '';
    
    Object.keys(salesTargets).forEach(salesperson => {
        const stats = salespersonStats[salesperson];
        const targetCard = document.createElement('div');
        targetCard.className = 'target-card slide-up';
        
        targetCard.innerHTML = `
            <h3>${salesperson}</h3>
            <div class="target-info">
                <span>目標：${stats.target.toLocaleString()}萬</span>
                <span>已達成：${stats.achieved.toLocaleString()}萬</span>
            </div>
            <div class="target-info">
                <span>剩餘：${stats.remaining.toLocaleString()}萬</span>
                <span>達成率：${stats.progress}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(stats.progress, 100)}%"></div>
            </div>
        `;
        
        // 根據達成率設置進度條顏色
        const progressFill = targetCard.querySelector('.progress-fill');
        if (stats.progress >= 100) {
            progressFill.style.background = 'linear-gradient(90deg, #27ae60, #2ecc71)';
        } else if (stats.progress >= 80) {
            progressFill.style.background = 'linear-gradient(90deg, #f39c12, #f1c40f)';
        } else if (stats.progress >= 50) {
            progressFill.style.background = 'linear-gradient(90deg, #3498db, #5dade2)';
        } else {
            progressFill.style.background = 'linear-gradient(90deg, #e74c3c, #ec7063)';
        }
        
        targetsGrid.appendChild(targetCard);
    });
}

// 更新月份統計顯示
function updateMonthlyDisplay() {
    const monthlyStats = calculateMonthlyStats();
    
    // 月份對應的 HTML id 前綴
    const monthIdMap = {
        '2025-12': 'december',
        '2026-01': 'january',
        '2026-02': 'february',
        '2026-03': 'march',
        '2026-04': 'april',
        '2026-05': 'may',
        '2026-06': 'june',
        '2026-07': 'july',
        '2026-08': 'august',
        '2026-09': 'september',
        '2026-10': 'october',
        '2026-11': 'november'
    };
    
    Object.keys(monthIdMap).forEach(monthKey => {
        const prefix = monthIdMap[monthKey];
        const stats = monthlyStats[monthKey];
        if (stats) {
            document.getElementById(`${prefix}-total`).textContent = `${stats.total.toLocaleString()}萬`;
            document.getElementById(`${prefix}-finance`).textContent = `${stats.finance.toLocaleString()}萬`;
            document.getElementById(`${prefix}-insurance`).textContent = `${stats.insurance.toLocaleString()}萬`;
        }
    });
}

// 過濾客戶清單
function filterCustomers() {
    const filterSalesperson = document.getElementById('filterSalesperson').value;
    const filterMonth = document.getElementById('filterMonth').value;
    const filterProduct = document.getElementById('filterProduct').value;
    
    return customers.filter(customer => {
        return (!filterSalesperson || customer.salesperson === filterSalesperson) &&
               (!filterMonth || customer.orderMonth === filterMonth) &&
               (!filterProduct || customer.productType === filterProduct);
    });
}

// 更新客戶清單顯示
function updateCustomerList() {
    const customerList = document.getElementById('customerList');
    const filteredCustomers = filterCustomers();
    
    customerList.innerHTML = '';
    
    if (filteredCustomers.length === 0) {
        customerList.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">目前沒有符合條件的客戶資料</p>';
        return;
    }
    
    filteredCustomers.forEach(customer => {
        const customerItem = document.createElement('div');
        customerItem.className = 'customer-item fade-in';
        
        const monthText = {
            '2025-12': '2025年12月',
            '2026-01': '2026年1月',
            '2026-02': '2026年2月',
            '2026-03': '2026年3月',
            '2026-04': '2026年4月',
            '2026-05': '2026年5月',
            '2026-06': '2026年6月',
            '2026-07': '2026年7月',
            '2026-08': '2026年8月',
            '2026-09': '2026年9月',
            '2026-10': '2026年10月',
            '2026-11': '2026年11月'
        }[customer.orderMonth];
        
        customerItem.innerHTML = `
            <div class="customer-info">
                <span class="customer-name">${customer.maskedName}</span>
                <span class="customer-salesperson">${customer.salesperson}</span>
                <span class="customer-month">${monthText}</span>
                <span class="customer-product">${customer.productType}</span>
                <span class="customer-amount">${customer.amount.toLocaleString()}萬</span>
            </div>
            <div class="customer-actions">
                <button class="edit-btn" onclick="openEditModal('${customer.id}')">
                    <i class="fas fa-edit"></i> 編輯
                </button>
                <button class="delete-btn" onclick="deleteCustomer('${customer.id}')">
                    <i class="fas fa-trash"></i> 刪除
                </button>
            </div>
        `;
        
        customerList.appendChild(customerItem);
    });
}

// 更新所有顯示
function updateAllDisplays() {
    updateOverviewStats();
    updateTargetsDisplay();
    updateMonthlyDisplay();
    updateCustomerList();
}

// 開啟編輯模態框
function openEditModal(customerId) {
    // 檢查客戶清單是否已解鎖
    if (!isCustomerListUnlocked) {
        showToast('請先輸入密碼解鎖客戶清單', true);
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById('editCustomerId').value = customer.id;
    document.getElementById('editCustomerName').value = customer.name;
    document.getElementById('editSalesperson').value = customer.salesperson;
    document.getElementById('editOrderMonth').value = customer.orderMonth;
    document.getElementById('editProductType').value = customer.productType;
    document.getElementById('editAmount').value = customer.amount;

    document.getElementById('editModal').style.display = 'block';
}

// 關閉編輯模態框
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

// 重新載入數據
async function reloadData() {
    console.log('用戶手動重新載入數據');
    showToast('正在重新載入數據...', false);
    
    try {
        await loadCustomersOnce();
        showToast('數據重新載入成功！');
    } catch (error) {
        console.error('重新載入數據失敗:', error);
        showToast('重新載入失敗，請檢查網路連接', true);
    }
}

// 初始化頁面 - 修復版本
function initializePage() {
    console.log('開始初始化頁面...');
    
    // 監聽 Firebase 準備就緒事件
    window.addEventListener('firebaseReady', () => {
        console.log('收到 Firebase 準備就緒事件');
        initializeFirebase();
    });
    
    // 如果 Firebase 已經準備好，直接初始化
    if (window.db && window.firestoreActions) {
        console.log('Firebase 已經準備就緒');
        initializeFirebase();
    } else {
        console.log('等待 Firebase 準備就緒...');
    }

    // 新增客戶表單事件 - 修復版本
    document.getElementById('customerForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('表單提交事件觸發');
        
        const customerData = {
            name: document.getElementById('customerName').value.trim(),
            salesperson: document.getElementById('salesperson').value,
            orderMonth: document.getElementById('orderMonth').value,
            productType: document.getElementById('productType').value,
            amount: document.getElementById('amount').value
        };
        
        console.log('收集到的表單數據:', customerData);
        
        if (!customerData.name) {
            showToast('請輸入客戶姓名', true);
            return;
        }
        
        if (!customerData.salesperson || !customerData.orderMonth || !customerData.productType || !customerData.amount) {
            showToast('請填寫完整資料', true);
            return;
        }
        
        try {
            // 禁用提交按鈕防止重複提交
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '保存中...';
            
            await addCustomer(customerData);
            this.reset();
            
            // 重新啟用提交按鈕
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> 新增客戶';
            
        } catch (error) {
            console.error('表單提交處理失敗:', error);
            
            // 重新啟用提交按鈕
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> 新增客戶';
        }
    });
    
    // 編輯客戶表單事件
    document.getElementById('editCustomerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const customerId = document.getElementById('editCustomerId').value;
        const customerData = {
            name: document.getElementById('editCustomerName').value.trim(),
            salesperson: document.getElementById('editSalesperson').value,
            orderMonth: document.getElementById('editOrderMonth').value,
            productType: document.getElementById('editProductType').value,
            amount: document.getElementById('editAmount').value
        };
        
        editCustomer(customerId, customerData);
        closeEditModal();
    });
    
    // 過濾器事件
    document.getElementById('filterSalesperson').addEventListener('change', updateCustomerList);
    document.getElementById('filterMonth').addEventListener('change', updateCustomerList);
    document.getElementById('filterProduct').addEventListener('change', updateCustomerList);
    
    // 管理員登入表單事件
    document.getElementById('adminLoginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const password = document.getElementById('adminPassword').value;
        if (password === ADMIN_PASSWORD) {
            showAdmin();
        } else {
            showToast('密碼錯誤', true);
            document.getElementById('adminPassword').value = '';
        }
    });
    
    // 新增RM表單事件
    document.getElementById('addRmForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const rmData = {
            name: document.getElementById('rmName').value.trim(),
            target: document.getElementById('rmTarget').value
        };
        
        addRm(rmData);
        this.reset();
    });
    
    // 點擊管理模態框外部關閉
    window.addEventListener('click', function(e) {
        const adminLoginModal = document.getElementById('adminLoginModal');
        const adminModal = document.getElementById('adminModal');
        const editModal = document.getElementById('editModal');
        
        if (e.target === adminLoginModal) {
            closeAdminLogin();
        }
        if (e.target === adminModal) {
            closeAdmin();
        }
        if (e.target === editModal) {
            closeEditModal();
        }
    });
    
    // 載入RM目標配置
    loadRmTargetsFromFirestore();
    
    // 初始化顯示（Firebase 監聽器會自動更新）
    updateAllDisplays();
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', initializePage);

// 管理員密碼
const ADMIN_PASSWORD = '88888888';

// 管理員功能
function showAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'block';
}

function closeAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'none';
    document.getElementById('adminLoginForm').reset();
}

function showAdmin() {
    closeAdminLogin();
    document.getElementById('adminModal').style.display = 'block';
    renderRmList();
    updateBatchRmSelect();
    updateBatchAddRmSelect();
}

function closeAdmin() {
    document.getElementById('adminModal').style.display = 'none';
}

function showTab(tabName) {
    // 移除所有標籤頁的 active 類
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 顯示選中的標籤頁
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// 渲染RM清單
function renderRmList() {
    const rmList = document.getElementById('rmList');
    rmList.innerHTML = '';
    
    Object.keys(salesTargets).forEach(rmName => {
        const rmItem = document.createElement('div');
        rmItem.className = 'rm-item';
        rmItem.innerHTML = `
            <div class="rm-info">
                <div class="rm-name">${rmName}</div>
                <div class="rm-target">目標：${salesTargets[rmName].toLocaleString()}萬元</div>
            </div>
            <div class="rm-actions">
                <button class="edit-rm-btn" onclick="editRm('${rmName}')">
                    <i class="fas fa-edit"></i> 編輯
                </button>
                <button class="delete-rm-btn" onclick="deleteRm('${rmName}')">
                    <i class="fas fa-trash"></i> 刪除
                </button>
            </div>
        `;
        rmList.appendChild(rmItem);
    });
}

// 編輯RM
function editRm(rmName) {
    const newTarget = prompt(`請輸入 ${rmName} 的新目標金額(萬元):`, salesTargets[rmName]);
    
    if (newTarget !== null && newTarget.trim() !== '') {
        const targetNumber = parseInt(newTarget.trim());
        if (!isNaN(targetNumber) && targetNumber > 0) {
            salesTargets[rmName] = targetNumber;
            saveRmTargetsToFirestore();
            renderRmList();
            updateAllDisplays();
            showToast(`${rmName} 的目標已更新為 ${targetNumber.toLocaleString()}萬元`);
        } else {
            showToast('請輸入有效的數字', true);
        }
    }
}

// 刪除RM
function deleteRm(rmName) {
    if (confirm(`確定要刪除 ${rmName} 嗎？這將同時刪除所有相關的客戶資料。`)) {
        if (confirm(`再次確認：刪除 ${rmName} 後將無法復原，確定要繼續嗎？`)) {
            // 刪除RM
            delete salesTargets[rmName];
            
            // 刪除相關客戶資料
            const relatedCustomers = customers.filter(c => c.salesperson === rmName);
            relatedCustomers.forEach(customer => {
                deleteCustomerFromFirestore(customer.id);
            });
            
            saveRmTargetsToFirestore();
            renderRmList();
            updateAllDisplays();
            showToast(`${rmName} 及相關資料已刪除`);
        }
    }
}

// 新增RM
async function addRm(rmData) {
    const rmName = rmData.name.trim();
    const rmTarget = parseInt(rmData.target);
    
    if (salesTargets[rmName]) {
        showToast('該RM名稱已存在', true);
        return;
    }
    
    if (!rmName || isNaN(rmTarget) || rmTarget <= 0) {
        showToast('請輸入有效的RM姓名和目標金額', true);
        return;
    }
    
    salesTargets[rmName] = rmTarget;
    await saveRmTargetsToFirestore();
    await updateSelectOptions();
    renderRmList();
    updateAllDisplays();
    showToast(`${rmName} 已新增，目標：${rmTarget.toLocaleString()}萬元`);
}

// 更新下拉選單選項
function updateSelectOptions() {
    const selects = [
        document.getElementById('salesperson'),
        document.getElementById('filterSalesperson'),
        document.getElementById('editSalesperson')
    ];
    
    const rmNames = Object.keys(salesTargets);
    
    selects.forEach(select => {
        if (select.id === 'filterSalesperson') {
            // 保留 "所有業務" 選項
            select.innerHTML = '<option value="">所有業務</option>';
        } else if (select.id === 'salesperson') {
            // 保留 "請選擇業務" 選項
            select.innerHTML = '<option value="">請選擇業務</option>';
        } else {
            select.innerHTML = '';
        }
        
        rmNames.forEach(rmName => {
            const option = document.createElement('option');
            option.value = rmName;
            option.textContent = rmName;
            select.appendChild(option);
        });
    });
}

// 保存RM目標到Firestore
async function saveRmTargetsToFirestore() {
    try {
        if (!window.db || !window.firestoreActions) {
            throw new Error('Firebase 未初始化');
        }
        
        const { collection, doc, updateDoc, addDoc, getDocs, query, where } = window.firestoreActions;
        const configCollection = collection(window.db, 'config');
        
        // 檢查是否已存在配置文檔
        const configQuery = query(configCollection, where('type', '==', 'salesTargets'));
        const querySnapshot = await getDocs(configQuery);
        
        const configData = {
            type: 'salesTargets',
            data: salesTargets,
            updatedAt: new Date().toISOString()
        };
        
        if (querySnapshot.empty) {
            // 創建新文檔
            await addDoc(configCollection, configData);
            console.log('銷售目標配置已創建');
        } else {
            // 更新現有文檔
            const docId = querySnapshot.docs[0].id;
            await updateDoc(doc(window.db, 'config', docId), configData);
            console.log('銷售目標配置已更新');
        }
        
    } catch (error) {
        console.error('保存RM目標時出錯:', error);
        showToast('保存設定失敗', true);
    }
}

// 從Firestore載入RM目標
async function loadRmTargetsFromFirestore() {
    try {
        if (!window.db || !window.firestoreActions) {
            console.log('Firebase 未初始化，使用預設RM目標');
            return;
        }
        
        const { collection, getDocs, query, where } = window.firestoreActions;
        const configCollection = collection(window.db, 'config');
        const configQuery = query(configCollection, where('type', '==', 'salesTargets'));
        const querySnapshot = await getDocs(configQuery);
        
        if (!querySnapshot.empty) {
            const configDoc = querySnapshot.docs[0];
            const configData = configDoc.data();
            if (configData.data) {
                salesTargets = configData.data;
                updateSelectOptions();
                updateAllDisplays();
                console.log('RM目標已從Firestore載入');
            }
        } else {
            console.log('未找到RM目標配置，使用預設值');
            // 保存預設配置到Firestore
            await saveRmTargetsToFirestore();
        }
        
    } catch (error) {
        console.error('載入RM目標時出錯:', error);
        console.log('使用預設RM目標');
    }
}

// 客戶清單密碼驗證函數
function verifyCustomerListPassword(event) {
    event.preventDefault();

    const password = document.getElementById('customerListPassword').value;

    if (password === CUSTOMER_LIST_PASSWORD) {
        isCustomerListUnlocked = true;
        document.getElementById('customerListPasswordForm').style.display = 'none';
        document.getElementById('customerListContent').style.display = 'block';
        document.getElementById('lockCustomerListBtn').style.display = 'inline-block';
        showToast('客戶清單已解鎖');
        document.getElementById('customerListPassword').value = '';
    } else {
        showToast('密碼錯誤，請重試', true);
        document.getElementById('customerListPassword').value = '';
    }
}

// 鎖定客戶清單函數
function lockCustomerList() {
    isCustomerListUnlocked = false;
    document.getElementById('customerListPasswordForm').style.display = 'block';
    document.getElementById('customerListContent').style.display = 'none';
    document.getElementById('lockCustomerListBtn').style.display = 'none';
    showToast('客戶清單已鎖定');
}

// =====================
// 批量編輯功能
// =====================

// 載入批量編輯的客戶列表
function loadBatchCustomers() {
    const rmName = document.getElementById('batchRmSelect').value;
    const customerList = document.getElementById('batchCustomerList');
    const batchActions = document.getElementById('batchActions');

    if (!rmName) {
        customerList.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">請先選擇理專</p>';
        batchActions.style.display = 'none';
        return;
    }

    const rmCustomers = customers.filter(c => c.salesperson === rmName);

    if (rmCustomers.length === 0) {
        customerList.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">該理專目前沒有客戶資料</p>';
        batchActions.style.display = 'none';
        return;
    }

    batchActions.style.display = 'block';
    document.getElementById('batchSelectAll').checked = false;
    updateBatchSelectedCount();

    const monthNames = {
        '2025-12': '2025年12月',
        '2026-01': '2026年1月', '2026-02': '2026年2月', '2026-03': '2026年3月',
        '2026-04': '2026年4月', '2026-05': '2026年5月', '2026-06': '2026年6月',
        '2026-07': '2026年7月', '2026-08': '2026年8月', '2026-09': '2026年9月',
        '2026-10': '2026年10月', '2026-11': '2026年11月'
    };

    customerList.innerHTML = '';
    rmCustomers.forEach(customer => {
        const item = document.createElement('div');
        item.className = 'batch-customer-item';
        item.innerHTML = `
            <label class="batch-checkbox-label">
                <input type="checkbox" class="batch-checkbox" value="${customer.id}" onchange="updateBatchSelectedCount()">
                <span class="batch-customer-info">
                    <span class="batch-customer-name">${customer.maskedName}</span>
                    <span class="batch-customer-detail">${monthNames[customer.orderMonth] || customer.orderMonth} | ${customer.productType} | ${customer.amount.toLocaleString()}萬</span>
                </span>
            </label>
        `;
        customerList.appendChild(item);
    });
}

// 全選/取消全選
function toggleBatchSelectAll() {
    const selectAll = document.getElementById('batchSelectAll').checked;
    document.querySelectorAll('.batch-checkbox').forEach(cb => {
        cb.checked = selectAll;
    });
    updateBatchSelectedCount();
}

// 更新已選擇數量
function updateBatchSelectedCount() {
    const count = document.querySelectorAll('.batch-checkbox:checked').length;
    document.getElementById('batchSelectedCount').textContent = `已選擇 ${count} 筆`;
}

// 批量操作選擇變更
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'batchAction') {
            const action = e.target.value;
            const valueSelect = document.getElementById('batchActionValue');

            valueSelect.innerHTML = '';
            valueSelect.style.display = 'none';

            if (action === 'transferRm') {
                valueSelect.style.display = 'inline-block';
                valueSelect.innerHTML = '<option value="">選擇目標理專</option>';
                const currentRm = document.getElementById('batchRmSelect').value;
                Object.keys(salesTargets).forEach(rm => {
                    if (rm !== currentRm) {
                        valueSelect.innerHTML += `<option value="${rm}">${rm}</option>`;
                    }
                });
            } else if (action === 'changeProduct') {
                valueSelect.style.display = 'inline-block';
                valueSelect.innerHTML = '<option value="">選擇商品類型</option><option value="理財">理財</option><option value="保險">保險</option>';
            } else if (action === 'changeMonth') {
                valueSelect.style.display = 'inline-block';
                valueSelect.innerHTML = `<option value="">選擇月份</option>
                    <option value="2025-12">2025年12月</option>
                    <option value="2026-01">2026年1月</option><option value="2026-02">2026年2月</option>
                    <option value="2026-03">2026年3月</option><option value="2026-04">2026年4月</option>
                    <option value="2026-05">2026年5月</option><option value="2026-06">2026年6月</option>
                    <option value="2026-07">2026年7月</option><option value="2026-08">2026年8月</option>
                    <option value="2026-09">2026年9月</option><option value="2026-10">2026年10月</option>
                    <option value="2026-11">2026年11月</option>`;
            }
        }
    });
});

// 執行批量操作
async function executeBatchAction() {
    const action = document.getElementById('batchAction').value;
    const actionValue = document.getElementById('batchActionValue').value;
    const selectedIds = Array.from(document.querySelectorAll('.batch-checkbox:checked')).map(cb => cb.value);

    if (selectedIds.length === 0) {
        showToast('請先選擇要操作的客戶', true);
        return;
    }

    if (!action) {
        showToast('請選擇批量操作類型', true);
        return;
    }

    if ((action === 'transferRm' || action === 'changeProduct' || action === 'changeMonth') && !actionValue) {
        showToast('請選擇操作目標值', true);
        return;
    }

    let confirmMsg = '';
    if (action === 'transferRm') {
        confirmMsg = `確定要將 ${selectedIds.length} 筆客戶資料轉移至「${actionValue}」嗎？`;
    } else if (action === 'changeProduct') {
        confirmMsg = `確定要將 ${selectedIds.length} 筆客戶的商品類型變更為「${actionValue}」嗎？`;
    } else if (action === 'changeMonth') {
        const monthNames = {'2025-12':'2025年12月','2026-01':'2026年1月','2026-02':'2026年2月','2026-03':'2026年3月','2026-04':'2026年4月','2026-05':'2026年5月','2026-06':'2026年6月','2026-07':'2026年7月','2026-08':'2026年8月','2026-09':'2026年9月','2026-10':'2026年10月','2026-11':'2026年11月'};
        confirmMsg = `確定要將 ${selectedIds.length} 筆客戶的月份變更為「${monthNames[actionValue]}」嗎？`;
    } else if (action === 'batchDelete') {
        confirmMsg = `確定要刪除 ${selectedIds.length} 筆客戶資料嗎？此操作無法復原！`;
        if (!confirm(confirmMsg)) return;
        confirmMsg = `再次確認：即將刪除 ${selectedIds.length} 筆資料，確定要繼續嗎？`;
    }

    if (!confirm(confirmMsg)) return;

    try {
        const { doc, updateDoc, deleteDoc } = window.firestoreActions;
        let successCount = 0;

        for (const customerId of selectedIds) {
            try {
                if (action === 'transferRm') {
                    await updateDoc(doc(window.db, COLLECTION_NAME, customerId), {
                        salesperson: actionValue,
                        updatedAt: new Date().toISOString()
                    });
                } else if (action === 'changeProduct') {
                    await updateDoc(doc(window.db, COLLECTION_NAME, customerId), {
                        productType: actionValue,
                        updatedAt: new Date().toISOString()
                    });
                } else if (action === 'changeMonth') {
                    await updateDoc(doc(window.db, COLLECTION_NAME, customerId), {
                        orderMonth: actionValue,
                        updatedAt: new Date().toISOString()
                    });
                } else if (action === 'batchDelete') {
                    await deleteDoc(doc(window.db, COLLECTION_NAME, customerId));
                }
                successCount++;
            } catch (error) {
                console.error(`操作客戶 ${customerId} 時出錯:`, error);
            }
        }

        showToast(`批量操作完成，成功處理 ${successCount} 筆資料`);

        document.getElementById('batchAction').value = '';
        document.getElementById('batchActionValue').style.display = 'none';
        document.getElementById('batchSelectAll').checked = false;

        setTimeout(() => {
            loadBatchCustomers();
        }, 1000);

    } catch (error) {
        console.error('批量操作時出錯:', error);
        showToast('批量操作失敗，請重試', true);
    }
}

// 更新批量編輯的RM下拉選單
function updateBatchRmSelect() {
    const select = document.getElementById('batchRmSelect');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">請選擇理專</option>';
    Object.keys(salesTargets).forEach(rm => {
        const option = document.createElement('option');
        option.value = rm;
        option.textContent = rm;
        select.appendChild(option);
    });
    if (currentValue && salesTargets[currentValue]) {
        select.value = currentValue;
    }
}

// =====================
// 批量新增功能
// =====================

function updateBatchAddRmSelect() {
    const select = document.getElementById('batchAddRmSelect');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">請選擇理專</option>';
    Object.keys(salesTargets).forEach(rm => {
        const option = document.createElement('option');
        option.value = rm;
        option.textContent = rm;
        select.appendChild(option);
    });
    if (currentValue && salesTargets[currentValue]) {
        select.value = currentValue;
    }
}

function addBatchRow(name = '', month = '', product = '', amount = '') {
    const tbody = document.getElementById('batchAddTableBody');
    const wrapper = document.getElementById('batchAddTableWrapper');
    wrapper.style.display = 'block';

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="batch-input" placeholder="客戶姓名" value="${name}"></td>
        <td>
            <select class="batch-input">
                <option value="">選擇月份</option>
                <option value="2025-12" ${month === '2025-12' ? 'selected' : ''}>2025年12月</option>
                <option value="2026-01" ${month === '2026-01' ? 'selected' : ''}>2026年1月</option>
                <option value="2026-02" ${month === '2026-02' ? 'selected' : ''}>2026年2月</option>
                <option value="2026-03" ${month === '2026-03' ? 'selected' : ''}>2026年3月</option>
                <option value="2026-04" ${month === '2026-04' ? 'selected' : ''}>2026年4月</option>
                <option value="2026-05" ${month === '2026-05' ? 'selected' : ''}>2026年5月</option>
                <option value="2026-06" ${month === '2026-06' ? 'selected' : ''}>2026年6月</option>
                <option value="2026-07" ${month === '2026-07' ? 'selected' : ''}>2026年7月</option>
                <option value="2026-08" ${month === '2026-08' ? 'selected' : ''}>2026年8月</option>
                <option value="2026-09" ${month === '2026-09' ? 'selected' : ''}>2026年9月</option>
                <option value="2026-10" ${month === '2026-10' ? 'selected' : ''}>2026年10月</option>
                <option value="2026-11" ${month === '2026-11' ? 'selected' : ''}>2026年11月</option>
            </select>
        </td>
        <td>
            <select class="batch-input">
                <option value="">選擇類型</option>
                <option value="理財" ${product === '理財' ? 'selected' : ''}>理財</option>
                <option value="保險" ${product === '保險' ? 'selected' : ''}>保險</option>
            </select>
        </td>
        <td><input type="number" class="batch-input" placeholder="金額" min="1" step="1" value="${amount}"></td>
        <td><button class="remove-row-btn" onclick="removeBatchRow(this)"><i class="fas fa-times"></i></button></td>
    `;
    tbody.appendChild(tr);
    updateBatchAddCount();
}

function removeBatchRow(btn) {
    btn.closest('tr').remove();
    updateBatchAddCount();
    if (document.getElementById('batchAddTableBody').children.length === 0) {
        document.getElementById('batchAddTableWrapper').style.display = 'none';
    }
}

function updateBatchAddCount() {
    const count = document.getElementById('batchAddTableBody').children.length;
    document.getElementById('batchAddCount').textContent = `共 ${count} 筆`;
}

function clearBatchAddTable() {
    if (!confirm('確定要清空所有輸入資料嗎？')) return;
    document.getElementById('batchAddTableBody').innerHTML = '';
    document.getElementById('batchAddTableWrapper').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    document.getElementById('uploadFileName').textContent = '';
    updateBatchAddCount();
}

function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('uploadFileName').textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCsvData(text);
    };
    reader.readAsText(file, 'UTF-8');
}

function parseCsvData(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        showToast('CSV 檔案格式錯誤：至少需要標題列和一筆資料', true);
        return;
    }

    document.getElementById('batchAddTableBody').innerHTML = '';

    const validMonths = ['2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11'];
    const validProducts = ['理財', '保險'];
    let errorCount = 0;
    let successCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 4) { errorCount++; continue; }

        const name = cols[0];
        const month = cols[1];
        const product = cols[2];
        const amount = parseInt(cols[3]);

        if (!name || !validMonths.includes(month) || !validProducts.includes(product) || isNaN(amount) || amount <= 0) {
            errorCount++;
            continue;
        }

        addBatchRow(name, month, product, amount.toString());
        successCount++;
    }

    if (successCount > 0) {
        showToast(`成功解析 ${successCount} 筆資料` + (errorCount > 0 ? `，${errorCount} 筆格式錯誤已跳過` : ''));
    } else {
        showToast('未能解析任何有效資料，請檢查 CSV 格式', true);
    }
}

async function submitBatchAdd() {
    const rmName = document.getElementById('batchAddRmSelect').value;
    if (!rmName) {
        showToast('請先選擇理專', true);
        return;
    }

    const rows = document.getElementById('batchAddTableBody').querySelectorAll('tr');
    if (rows.length === 0) {
        showToast('請先新增客戶資料', true);
        return;
    }

    const customersToAdd = [];
    let hasError = false;

    rows.forEach((row, index) => {
        const inputs = row.querySelectorAll('.batch-input');
        const name = inputs[0].value.trim();
        const month = inputs[1].value;
        const product = inputs[2].value;
        const amount = parseInt(inputs[3].value);

        if (!name || !month || !product || isNaN(amount) || amount <= 0) {
            hasError = true;
            row.style.background = '#ffe0e0';
            return;
        }
        row.style.background = '';

        customersToAdd.push({ name, salesperson: rmName, orderMonth: month, productType: product, amount });
    });

    if (hasError) {
        showToast('部分資料填寫不完整，已標記為紅色，請修正後重試', true);
        return;
    }

    if (!confirm(`確定要新增 ${customersToAdd.length} 筆客戶資料至「${rmName}」名下嗎？`)) return;

    try {
        let successCount = 0;
        for (const data of customersToAdd) {
            try {
                await addCustomer(data);
                successCount++;
            } catch (error) {
                console.error('新增客戶失敗:', error);
            }
        }

        showToast(`批量新增完成，成功新增 ${successCount} 筆資料`);

        document.getElementById('batchAddTableBody').innerHTML = '';
        document.getElementById('batchAddTableWrapper').style.display = 'none';
        document.getElementById('csvFileInput').value = '';
        document.getElementById('uploadFileName').textContent = '';
        updateBatchAddCount();

    } catch (error) {
        console.error('批量新增時出錯:', error);
        showToast('批量新增失敗，請重試', true);
    }
}

// 導出函數供全域使用
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.deleteCustomer = deleteCustomer;
window.reloadData = reloadData;
window.showAdminLogin = showAdminLogin;
window.closeAdminLogin = closeAdminLogin;
window.showAdmin = showAdmin;
window.closeAdmin = closeAdmin;
window.showTab = showTab;
window.editRm = editRm;
window.deleteRm = deleteRm;
window.verifyCustomerListPassword = verifyCustomerListPassword;
window.lockCustomerList = lockCustomerList;
window.loadBatchCustomers = loadBatchCustomers;
window.toggleBatchSelectAll = toggleBatchSelectAll;
window.updateBatchSelectedCount = updateBatchSelectedCount;
window.executeBatchAction = executeBatchAction;
window.addBatchRow = addBatchRow;
window.removeBatchRow = removeBatchRow;
window.clearBatchAddTable = clearBatchAddTable;
window.handleCsvUpload = handleCsvUpload;
window.submitBatchAdd = submitBatchAdd;