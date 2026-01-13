// ==============================================
// КОНФИГУРАЦИЯ
// ==============================================

const CONFIG = {
    SERVER_URL: 'http://78.40.188.120:3000',
    USE_PROXY: false, // true для использования прокси через текущий сервер
    AUTO_REFRESH_INTERVAL: 5000, // 5 секунд
    DEMO_MODE_ENABLED: true, // показывать демо-данные если сервер недоступен
    RETRY_ATTEMPTS: 3, // количество попыток перед переходом в демо-режим
    REQUEST_TIMEOUT: 3000 // таймаут запроса в мс
};

// ==============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==============================================

let appState = {
    isOnline: false,
    isDemoMode: false,
    retryCount: 0,
    lastUpdateTime: null,
    connectionChecked: false
};

// ==============================================
// ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ DOM
// ==============================================

const elements = {
    totalCats: document.getElementById('totalCats'),
    totalAttacks: document.getElementById('totalAttacks'),
    avgSuccess: document.getElementById('avgSuccess'),
    totalMatroskin: document.getElementById('totalMatroskin'),
    totalRecords: document.getElementById('totalRecords'),
    lastUpdate: document.getElementById('lastUpdate'),
    prestigeStats: document.getElementById('prestigeStats'),
    catsTable: document.querySelector('#catsTable tbody')
};

// ==============================================
// УТИЛИТЫ
// ==============================================

function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

function getCurrentTime() {
    return new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function getCurrentDateTime() {
    return new Date().toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ==============================================
// ОБРАБОТКА API
// ==============================================

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            mode: 'cors',
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Пытаемся получить данные разными способами
async function tryFetchData() {
    const methods = [
        tryDirectFetch,
        tryProxyFetch,
        tryJsonpFetch
    ];
    
    for (const method of methods) {
        try {
            console.log(`Пробуем метод: ${method.name}`);
            const data = await method();
            return data;
        } catch (error) {
            console.log(`Метод ${method.name} не сработал:`, error.message);
            continue;
        }
    }
    
    throw new Error('Все методы получения данных не сработали');
}

// Прямой запрос к серверу
async function tryDirectFetch() {
    const endpoints = [
        `${CONFIG.SERVER_URL}/stats`,
        `${CONFIG.SERVER_URL}/prestige-stats`,
        `${CONFIG.SERVER_URL}/cats-data`
    ];
    
    const [stats, prestige, allData] = await Promise.all(
        endpoints.map(endpoint => fetchWithTimeout(endpoint))
    );
    
    return { stats, prestige, allData };
}

// Запрос через прокси (если настроен)
async function tryProxyFetch() {
    if (!CONFIG.USE_PROXY) {
        throw new Error('Прокси не настроен');
    }
    
    const endpoints = ['/proxy/stats', '/proxy/prestige-stats', '/proxy/cats-data'];
    
    const [stats, prestige, allData] = await Promise.all(
        endpoints.map(endpoint => fetchWithTimeout(endpoint))
    );
    
    return { stats, prestige, allData };
}

// JSONP запрос (обход CORS)
async function tryJsonpFetch() {
    return new Promise((resolve, reject) => {
        const callbackName = `jsonp_callback_${Date.now()}`;
        const script = document.createElement('script');
        
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            
            // JSONP возвращает только один endpoint, нужно адаптировать
            const result = {
                stats: data,
                prestige: { prestigeStats: {} },
                allData: {}
            };
            
            resolve(result);
        };
        
        script.src = `${CONFIG.SERVER_URL}/stats?callback=${callbackName}`;
        script.onerror = () => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('JSONP failed'));
        };
        
        document.body.appendChild(script);
        
        // Таймаут
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('JSONP timeout'));
            }
        }, CONFIG.REQUEST_TIMEOUT);
    });
}

// ==============================================
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
// ==============================================

function updateUI(statsData, prestigeData, allData) {
    updateStats(statsData);
    updatePrestigeStats(prestigeData);
    updateTable(allData);
    updateTimestamp(statsData.timestamp || new Date().toISOString());
}

function updateStats(data) {
    if (!elements.totalCats) return;
    
    elements.totalCats.textContent = formatNumber(data.totalCats || 0);
    elements.totalAttacks.textContent = formatNumber(data.totalAttacks || 0);
    elements.avgSuccess.textContent = (data.avgSuccess || 0) + '%';
    elements.totalMatroskin.textContent = formatNumber(data.totalMatroskin || 0);
    elements.totalRecords.textContent = formatNumber(data.count || 0);
}

function updatePrestigeStats(data) {
    if (!elements.prestigeStats) return;
    
    const prestigeStats = data.prestigeStats || {0: 0};
    let html = '';
    
    const sortedLevels = Object.keys(prestigeStats).sort((a, b) => a - b);
    
    sortedLevels.forEach(level => {
        const count = prestigeStats[level];
        const percentage = data.count ? Math.round((count / data.count) * 100) : 0;
        
        html += `
            <div class="prestige-item">
                <div class="prestige-level">${level}</div>
                <div class="prestige-count">${formatNumber(count)} игроков</div>
                <div class="prestige-percentage">${percentage}%</div>
            </div>
        `;
    });
    
    elements.prestigeStats.innerHTML = html;
}

function updateTable(data) {
    if (!elements.catsTable) return;
    
    const entries = Object.entries(data || {});
    let html = '';
    
    if (entries.length === 0) {
        html = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <i class="fas fa-database" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <div>Нет данных</div>
                    <small>Ожидание обновления...</small>
                </td>
            </tr>
        `;
    } else {
        entries.sort((a, b) => (b[1].cats || 0) - (a[1].cats || 0));
        
        entries.forEach(([player, stats]) => {
            const successRate = stats.attacks > 0 
                ? Math.round((stats.successful_attacks || 0) / stats.attacks * 100)
                : 0;
            
            const prestigeLevel = stats.prestige_level || 0;
            let prestigeClass = '';
            
            if (prestigeLevel >= 4) prestigeClass = 'prestige-legendary';
            else if (prestigeLevel >= 2) prestigeClass = 'prestige-epic';
            else if (prestigeLevel >= 1) prestigeClass = 'prestige-rare';
            
            html += `
                <tr>
                    <td><i class="fas fa-user"></i> ${player}</td>
                    <td><i class="fas fa-cat"></i> ${formatNumber(stats.cats || 0)}</td>
                    <td><i class="fas fa-bolt"></i> ${formatNumber(stats.attacks || 0)}</td>
                    <td>
                        <i class="fas fa-crosshairs"></i> ${formatNumber(stats.successful_attacks || 0)}
                        <small style="color: ${successRate >= 70 ? '#27ae60' : successRate >= 40 ? '#f39c12' : '#e74c3c'}">
                            (${successRate}%)
                        </small>
                    </td>
                    <td><i class="fas fa-crown"></i> ${formatNumber(stats.matroskin || 0)}</td>
                    <td><span class="prestige-badge ${prestigeClass}">${prestigeLevel}</span></td>
                </tr>
            `;
        });
    }
    
    elements.catsTable.innerHTML = html;
}

function updateTimestamp(timestamp) {
    if (!elements.lastUpdate) return;
    
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const statusText = appState.isDemoMode ? 'ДЕМО-ДАННЫЕ' : 'Онлайн';
    const statusColor = appState.isDemoMode ? '#f39c12' : '#27ae60';
    
    elements.lastUpdate.innerHTML = `
        <i class="fas fa-clock"></i> ${timeString}
        <span style="margin-left: 10px; color: ${statusColor}; font-weight: bold;">
            ${statusText}
        </span>
    `;
}

// ==============================================
// ДЕМО-РЕЖИМ
// ==============================================

function generateDemoData() {
    console.log('Генерация демо-данных...');
    
    const players = [
        "ShadowCat", "MidnightWhisper", "GoldenPaw", "SilverFang", "EmeraldEyes",
        "VelvetPaws", "ThunderTail", "Starlight", "Moonbeam", "WhiskerWizard",
        "ShadowStalker", "CrimsonClaw", "SapphireGaze", "IronWhiskers", "VelvetShadow",
        "AmberHunter", "OnyxProwler", "RubyRoamer", "JadeJumper", "TopazTracker",
        "PlatinumPaw", "CopperCat", "Obsidian", "PearlPurrer", "DiamondDash"
    ];
    
    const demoAllData = {};
    let totalCats = 0;
    let totalAttacks = 0;
    let totalSuccessfulAttacks = 0;
    let totalMatroskin = 0;
    const prestigeStats = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    
    players.forEach((player, index) => {
        const cats = Math.floor(Math.random() * 400) + 100;
        const attacks = Math.floor(Math.random() * 150) + 30;
        const successfulAttacks = Math.floor(attacks * (0.5 + Math.random() * 0.3));
        const matroskin = Math.floor(Math.random() * 8);
        const prestigeLevel = Math.floor(Math.random() * 6);
        
        demoAllData[player] = {
            cats,
            attacks,
            successful_attacks: successfulAttacks,
            matroskin,
            prestige_level: prestigeLevel
        };
        
        totalCats += cats;
        totalAttacks += attacks;
        totalSuccessfulAttacks += successfulAttacks;
        totalMatroskin += matroskin;
        prestigeStats[prestigeLevel] = (prestigeStats[prestigeLevel] || 0) + 1;
    });
    
    const avgSuccess = totalAttacks > 0 ? Math.round((totalSuccessfulAttacks / totalAttacks) * 100) : 0;
    
    return {
        stats: {
            totalCats,
            totalAttacks,
            avgSuccess,
            totalMatroskin,
            count: players.length,
            timestamp: new Date().toISOString()
        },
        prestige: {
            prestigeStats,
            timestamp: new Date().toISOString()
        },
        allData: demoAllData
    };
}

function showDemoData() {
    const demoData = generateDemoData();
    appState.isDemoMode = true;
    appState.isOnline = false;
    
    updateUI(demoData.stats, demoData.prestige, demoData.allData);
    showNotification('Используются демо-данные. Сервер недоступен.', 'warning');
    updateConnectionStatus();
}

// ==============================================
// УВЕДОМЛЕНИЯ И ОШИБКИ
// ==============================================

function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    document.querySelectorAll('.app-notification').forEach(el => el.remove());
    
    const colors = {
        success: '#27ae60',
        warning: '#f39c12',
        info: '#3498db',
        error: '#e74c3c'
    };
    
    const icons = {
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
        error: 'fa-times-circle'
    };
    
    const notification = document.createElement('div');
    notification.className = 'app-notification';
    notification.innerHTML = `
        <i class="fas ${icons[type]}" style="margin-right: 10px;"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
        word-break: break-word;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, type === 'error' ? 8000 : 5000);
}

// ==============================================
// СТАТУС СОЕДИНЕНИЯ
// ==============================================

function updateConnectionStatus() {
    let statusElement = document.getElementById('connectionStatus');
    
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'connectionStatus';
        statusElement.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 8px;
            backdrop-filter: blur(10px);
        `;
        document.body.appendChild(statusElement);
    }
    
    if (appState.isDemoMode) {
        statusElement.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: #f39c12;"></i>
            <span>Демо-режим</span>
        `;
        statusElement.style.background = 'rgba(243, 156, 18, 0.9)';
    } else if (appState.isOnline) {
        statusElement.innerHTML = `
            <i class="fas fa-wifi" style="color: #27ae60;"></i>
            <span>Онлайн</span>
        `;
        statusElement.style.background = 'rgba(39, 174, 96, 0.9)';
    } else {
        statusElement.innerHTML = `
            <i class="fas fa-wifi-slash" style="color: #e74c3c;"></i>
            <span>Оффлайн</span>
        `;
        statusElement.style.background = 'rgba(231, 76, 60, 0.9)';
    }
}

// ==============================================
// ОСНОВНАЯ ЛОГИКА
// ==============================================

async function fetchData() {
    console.log(`[${getCurrentTime()}] Запрос данных...`);
    
    if (!appState.connectionChecked) {
        appState.connectionChecked = true;
        updateConnectionStatus();
    }
    
    try {
        const data = await tryFetchData();
        
        appState.isOnline = true;
        appState.isDemoMode = false;
        appState.retryCount = 0;
        
        updateUI(data.stats, data.prestige, data.allData);
        updateConnectionStatus();
        
        if (appState.retryCount > 0) {
            showNotification('Соединение восстановлено!', 'success');
        }
        
        return true;
        
    } catch (error) {
        console.error(`[${getCurrentTime()}] Ошибка:`, error.message);
        
        appState.isOnline = false;
        appState.retryCount++;
        
        updateConnectionStatus();
        
        if (appState.retryCount >= CONFIG.RETRY_ATTEMPTS && CONFIG.DEMO_MODE_ENABLED) {
            if (!appState.isDemoMode) {
                appState.isDemoMode = true;
                showDemoData();
            }
        } else {
            showNotification(`Ошибка подключения (${appState.retryCount}/${CONFIG.RETRY_ATTEMPTS})`, 'error');
        }
        
        return false;
    }
}

// ==============================================
// ИНИЦИАЛИЗАЦИЯ И КОНТРОЛЛЕРЫ
// ==============================================

function setupAutoRefresh() {
    // Первый запрос
    setTimeout(() => fetchData(), 1000);
    
    // Интервальное обновление
    setInterval(() => {
        if (!appState.isDemoMode || appState.retryCount < CONFIG.RETRY_ATTEMPTS) {
            fetchData();
        }
    }, CONFIG.AUTO_REFRESH_INTERVAL);
}

function setupManualRefreshButton() {
    const button = document.createElement('button');
    button.id = 'manualRefreshBtn';
    button.innerHTML = `
        <i class="fas fa-sync-alt"></i>
        <span>Обновить</span>
    `;
    
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #3498db, #2980b9);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
        transition: all 0.3s ease;
        font-family: inherit;
    `;
    
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 20px rgba(52, 152, 219, 0.4)';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 15px rgba(52, 152, 219, 0.3)';
    });
    
    button.addEventListener('click', async () => {
        const icon = button.querySelector('i');
        const originalIcon = icon.className;
        
        button.disabled = true;
        icon.className = 'fas fa-spinner fa-spin';
        
        await fetchData();
        
        setTimeout(() => {
            button.disabled = false;
            icon.className = originalIcon;
        }, 1000);
    });
    
    document.body.appendChild(button);
}

function setupServerInfo() {
    const info = document.createElement('div');
    info.id = 'serverInfo';
    info.innerHTML = `
        <i class="fas fa-server"></i>
        <span>Сервер: ${CONFIG.SERVER_URL.replace('http://', '')}</span>
    `;
    
    info.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.8rem;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(info);
}

function setupGlobalStyles() {
    const styles = document.createElement('style');
    styles.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .prestige-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 15px;
            font-weight: bold;
            font-size: 0.85rem;
            min-width: 30px;
            text-align: center;
            color: white;
        }
        
        .prestige-common {
            background: #7f8c8d;
        }
        
        .prestige-rare {
            background: linear-gradient(135deg, #3498db, #2980b9);
        }
        
        .prestige-epic {
            background: linear-gradient(135deg, #9b59b6, #8e44ad);
        }
        
        .prestige-legendary {
            background: linear-gradient(135deg, #f39c12, #d35400);
            box-shadow: 0 0 10px rgba(243, 156, 18, 0.5);
        }
        
        .prestige-item {
            background: white;
            border-radius: 10px;
            padding: 15px;
            text-align: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.08);
            transition: transform 0.2s;
        }
        
        .prestige-item:hover {
            transform: translateY(-3px);
        }
        
        .prestige-level {
            font-size: 1.8rem;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .prestige-count {
            font-size: 0.9rem;
            color: #7f8c8d;
        }
        
        .prestige-percentage {
            font-size: 0.8rem;
            color: #3498db;
            margin-top: 3px;
        }
        
        .fa-spinner {
            animation: spin 1s linear infinite;
        }
        
        /* Адаптивность */
        @media (max-width: 768px) {
            #manualRefreshBtn {
                bottom: 10px;
                right: 10px;
                padding: 10px 20px;
                font-size: 13px;
            }
            
            #connectionStatus, #serverInfo {
                bottom: 10px;
                left: 10px;
                font-size: 0.7rem;
                padding: 6px 12px;
            }
            
            #connectionStatus {
                top: 60px;
                right: 10px;
            }
        }
    `;
    
    document.head.appendChild(styles);
}

// ==============================================
// ТОЧКА ВХОДА
// ==============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🐱 Статистика котов инициализируется...');
    console.log('Конфигурация:', CONFIG);
    console.log('Текущий URL:', window.location.href);
    console.log('Протокол:', window.location.protocol);
    
    // Настройка глобальных стилей
    setupGlobalStyles();
    
    // Настройка интерфейса
    setupManualRefreshButton();
    setupServerInfo();
    updateConnectionStatus();
    
    // Начальная загрузка данных
    setupAutoRefresh();
    
    // Показываем приветственное сообщение
    setTimeout(() => {
        if (!appState.isOnline) {
            showNotification('Загрузка данных...', 'info');
        }
    }, 500);
    
    // Проверяем доступность сервера
    checkServerAvailability();
});

async function checkServerAvailability() {
    try {
        const response = await fetch(`${CONFIG.SERVER_URL}/stats`, {
            method: 'HEAD',
            mode: 'no-cors' // no-cors для простой проверки
        });
        
        console.log('Сервер доступен');
        appState.isOnline = true;
    } catch (error) {
        console.log('Сервер недоступен, переходим в демо-режим');
        if (CONFIG.DEMO_MODE_ENABLED) {
            showDemoData();
        }
    }
    
    updateConnectionStatus();
}

// Экспортируем функции для отладки
window.appDebug = {
    getState: () => appState,
    getConfig: () => CONFIG,
    forceDemoMode: () => showDemoData(),
    forceRefresh: () => fetchData(),
    checkConnection: () => checkServerAvailability()
};

console.log('✅ Скрипт загружен и готов к работе');