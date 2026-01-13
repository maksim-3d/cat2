// Настройки API
const SERVER_URL = 'http://78.40.188.120:3000';
const USE_PROXY = true; // true для GitHub Pages, false для локальной разработки

// Определяем базовый URL в зависимости от окружения
function getBaseUrl() {
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '';
    
    const isGitHub = window.location.hostname.includes('github.io');
    
    if (isLocal) {
        // Для локальной разработки
        return '';
    } else if (isGitHub && USE_PROXY) {
        // Для GitHub Pages используем ваш сервер
        return SERVER_URL;
    } else {
        // Для других случаев
        return window.location.origin;
    }
}

// URL API
const API_BASE = getBaseUrl();
const DATA_API = `${API_BASE}/cats-data`;
const STATS_API = `${API_BASE}/stats`;
const PRESTIGE_API = `${API_BASE}/prestige-stats`;

// Элементы DOM
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

// Состояние приложения
let appState = {
    isOnline: true,
    lastUpdateTime: null,
    retryCount: 0
};

// Форматирование чисел
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

// Получение данных с сервера с обработкой ошибок
async function fetchData() {
    try {
        console.log(`Запрашиваем данные с ${API_BASE}...`);
        
        // Создаем запросы с таймаутом
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const fetchOptions = {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        };
        
        const [statsData, prestigeData, allData] = await Promise.all([
            fetch(STATS_API, fetchOptions).then(handleResponse),
            fetch(PRESTIGE_API, fetchOptions).then(handleResponse),
            fetch(DATA_API, fetchOptions).then(handleResponse)
        ]);
        
        clearTimeout(timeoutId);
        
        console.log('Данные успешно получены');
        appState.isOnline = true;
        appState.retryCount = 0;
        
        updateStats(statsData);
        updatePrestigeStats(prestigeData);
        updateTable(allData);
        updateTimestamp(statsData.timestamp || new Date().toISOString());
        
        showNotification('Данные успешно обновлены', 'success');
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('Ошибка при получении данных:', error);
        
        appState.retryCount++;
        appState.isOnline = false;
        
        if (appState.retryCount > 3) {
            showError('Не удалось подключиться к серверу. Показываем демо-данные.');
            showDemoData();
        } else {
            showError(`Ошибка подключения (попытка ${appState.retryCount}/3). Повтор через 5 секунд...`);
            setTimeout(fetchData, 5000);
        }
    }
}

// Обработка ответа сервера
async function handleResponse(response) {
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
}

// Обновление основных статистик
function updateStats(data) {
    elements.totalCats.textContent = formatNumber(data.totalCats || 0);
    elements.totalAttacks.textContent = formatNumber(data.totalAttacks || 0);
    elements.avgSuccess.textContent = (data.avgSuccess || 0) + '%';
    elements.totalMatroskin.textContent = formatNumber(data.totalMatroskin || 0);
    elements.totalRecords.textContent = formatNumber(data.count || 0);
}

// Обновление статистики престижей
function updatePrestigeStats(data) {
    const prestigeStats = data.prestigeStats || {0: 0};
    let html = '';
    
    // Сортируем уровни престижа
    const sortedLevels = Object.keys(prestigeStats).sort((a, b) => a - b);
    
    if (sortedLevels.length === 0) {
        html = '<div class="no-data">Нет данных о престижах</div>';
    } else {
        sortedLevels.forEach(level => {
            const count = prestigeStats[level];
            html += `
                <div class="prestige-item">
                    <div class="prestige-level">${level}</div>
                    <div class="prestige-count">${formatNumber(count)} игроков</div>
                </div>
            `;
        });
    }
    
    elements.prestigeStats.innerHTML = html;
}

// Обновление таблицы
function updateTable(data) {
    let html = '';
    const entries = Object.entries(data || {});
    
    if (entries.length === 0) {
        html = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-database" style="font-size: 2rem; color: #ccc; margin-bottom: 10px; display: block;"></i>
                    <div>Нет данных о котах</div>
                    <small style="color: #888;">Ожидание данных от сервера...</small>
                </td>
            </tr>
        `;
    } else {
        // Сортируем по количеству котов (по убыванию)
        entries.sort((a, b) => (b[1].cats || 0) - (a[1].cats || 0));
        
        entries.forEach(([player, stats]) => {
            const successRate = stats.attacks > 0 
                ? Math.round((stats.successful_attacks || 0) / stats.attacks * 100)
                : 0;
                
            // Определяем цвет для уровня престижа
            const prestigeLevel = stats.prestige_level || 0;
            let prestigeClass = '';
            if (prestigeLevel >= 3) prestigeClass = 'prestige-high';
            else if (prestigeLevel >= 1) prestigeClass = 'prestige-medium';
            
            html += `
                <tr>
                    <td><strong>${player}</strong></td>
                    <td>${formatNumber(stats.cats || 0)}</td>
                    <td>${formatNumber(stats.attacks || 0)}</td>
                    <td>${formatNumber(stats.successful_attacks || 0)} <small>(${successRate}%)</small></td>
                    <td>${formatNumber(stats.matroskin || 0)}</td>
                    <td><span class="prestige-badge ${prestigeClass}">${prestigeLevel}</span></td>
                </tr>
            `;
        });
    }
    
    elements.catsTable.innerHTML = html;
}

// Обновление времени последнего обновления
function updateTimestamp(timestamp) {
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = date.toLocaleDateString('ru-RU');
    elements.lastUpdate.textContent = `Обновлено: ${dateString} ${timeString}`;
    elements.lastUpdate.style.color = appState.isOnline ? '#2ecc71' : '#e74c3c';
}

// Показать демо-данные
function showDemoData() {
    console.log('Показываем демо-данные');
    
    // Генерируем реалистичные демо-данные
    const demoStats = {
        totalCats: Math.floor(Math.random() * 5000) + 1000,
        totalAttacks: Math.floor(Math.random() * 1500) + 500,
        avgSuccess: Math.floor(Math.random() * 30) + 50,
        totalMatroskin: Math.floor(Math.random() * 100) + 20,
        count: 22,
        timestamp: new Date().toISOString()
    };
    
    const demoPrestige = {
        prestigeStats: {
            "0": 5,
            "1": 8,
            "2": 4,
            "3": 3,
            "4": 2,
            "5": 1
        },
        timestamp: new Date().toISOString()
    };
    
    // Генерируем демо-данные игроков
    const demoAllData = {};
    const playerNames = [
        "КотУченый", "Мурзик", "Барсик", "Рыжик", "Васька", 
        "Мурка", "Снежок", "Пушистик", "Тигра", "Леопольд",
        "Гарфилд", "Том", "Багира", "Матроскин", "Чеширский",
        "Феликс", "Симба", "Луна", "Оскар", "Зевс", "Локи", "Тори"
    ];
    
    playerNames.forEach(name => {
        demoAllData[name] = {
            cats: Math.floor(Math.random() * 500) + 50,
            attacks: Math.floor(Math.random() * 150) + 20,
            successful_attacks: Math.floor(Math.random() * 100) + 10,
            matroskin: Math.floor(Math.random() * 10),
            prestige_level: Math.floor(Math.random() * 6)
        };
    });
    
    updateStats(demoStats);
    updatePrestigeStats(demoPrestige);
    updateTable(demoAllData);
    updateTimestamp(demoStats.timestamp);
    
    // Обновляем статус
    elements.lastUpdate.textContent = 'ДЕМО-РЕЖИМ (сервер недоступен)';
    elements.lastUpdate.style.color = '#f39c12';
    
    showNotification('Используются демо-данные. Сервер временно недоступен.', 'warning');
}

// Показать ошибку
function showError(message) {
    // Удаляем старые сообщения об ошибках
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e74c3c;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        max-width: 400px;
        display: flex;
        align-items: center;
        animation: slideIn 0.3s ease;
    `;
    
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="margin-right: 10px; font-size: 1.2rem;"></i>
        <div>${message}</div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Добавляем стили для анимации
    if (!document.querySelector('#error-styles')) {
        const style = document.createElement('style');
        style.id = 'error-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        errorDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
}

// Показать уведомление
function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    document.querySelectorAll('.notification').forEach(el => el.remove());
    
    const colors = {
        success: '#2ecc71',
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
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999;
        max-width: 350px;
        display: flex;
        align-items: center;
        animation: slideIn 0.3s ease;
    `;
    
    notification.innerHTML = `
        <i class="fas ${icons[type] || icons.info}" style="margin-right: 10px; font-size: 1.1rem;"></i>
        <div style="flex-grow: 1;">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Проверка соединения с сервером
async function checkServerConnection() {
    try {
        const response = await fetch(`${API_BASE}/stats`, {
            method: 'HEAD',
            mode: 'cors',
            cache: 'no-cache'
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Обновление статуса соединения
function updateConnectionStatus() {
    const statusIndicator = document.getElementById('connectionStatus') || createStatusIndicator();
    
    if (appState.isOnline) {
        statusIndicator.innerHTML = '<i class="fas fa-wifi"></i> Онлайн';
        statusIndicator.style.color = '#2ecc71';
    } else {
        statusIndicator.innerHTML = '<i class="fas fa-wifi-slash"></i> Оффлайн';
        statusIndicator.style.color = '#e74c3c';
    }
}

// Создание индикатора статуса
function createStatusIndicator() {
    const header = document.querySelector('.header');
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connectionStatus';
    statusDiv.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255,255,255,0.2);
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 5px;
    `;
    header.appendChild(statusDiv);
    return statusDiv;
}

// Обновление данных каждую секунду
function startAutoRefresh() {
    console.log('Запуск автообновления данных...');
    
    // Первоначальная загрузка
    fetchData();
    
    // Обновление каждые 5 секунд (вместо 1 секунды, чтобы не нагружать)
    setInterval(() => {
        if (appState.isOnline) {
            fetchData();
        }
    }, 5000);
    
    // Проверка соединения каждые 30 секунд
    setInterval(async () => {
        const isConnected = await checkServerConnection();
        if (isConnected !== appState.isOnline) {
            appState.isOnline = isConnected;
            updateConnectionStatus();
            
            if (isConnected) {
                showNotification('Соединение с сервером восстановлено', 'success');
                fetchData();
            } else {
                showNotification('Потеряно соединение с сервером', 'warning');
            }
        }
    }, 30000);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница загружена, инициализация...');
    console.log('API Base URL:', API_BASE);
    console.log('Stats API:', STATS_API);
    
    // Создаем индикатор статуса
    createStatusIndicator();
    updateConnectionStatus();
    
    // Запускаем автообновление
    startAutoRefresh();
    
    // Добавляем кнопку для ручного обновления
    const updateBtn = document.createElement('button');
    updateBtn.innerHTML = '<i class="fas fa-redo"></i> Обновить';
    updateBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3498db;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 25px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: inherit;
        font-size: 14px;
        transition: all 0.3s ease;
    `;
    
    updateBtn.onmouseover = () => {
        updateBtn.style.transform = 'translateY(-2px)';
        updateBtn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.25)';
    };
    
    updateBtn.onmouseout = () => {
        updateBtn.style.transform = 'translateY(0)';
        updateBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    };
    
    updateBtn.onclick = () => {
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обновление...';
        updateBtn.style.opacity = '0.7';
        
        fetchData().finally(() => {
            setTimeout(() => {
                updateBtn.disabled = false;
                updateBtn.innerHTML = '<i class="fas fa-redo"></i> Обновить';
                updateBtn.style.opacity = '1';
            }, 1000);
        });
    };
    
    document.body.appendChild(updateBtn);
    
    // Добавляем информацию о сервере
    const serverInfo = document.createElement('div');
    serverInfo.innerHTML = `
        <div style="position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.7); color: white; padding: 8px 15px; border-radius: 20px; font-size: 0.8rem; z-index: 100;">
            <i class="fas fa-server"></i> Сервер: ${API_BASE || 'локальный'}
        </div>
    `;
    document.body.appendChild(serverInfo);
    
    // Показываем стартовое сообщение
    setTimeout(() => {
        showNotification('Статистика котов загружена. Данные обновляются автоматически.', 'info');
    }, 1000);
});

// Добавляем CSS для престижных бейджей
document.head.insertAdjacentHTML('beforeend', `
    <style>
        .prestige-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            background: #ecf0f1;
            color: #2c3e50;
            font-weight: bold;
            font-size: 0.85rem;
            min-width: 24px;
            text-align: center;
        }
        
        .prestige-high {
            background: linear-gradient(135deg, #ffd166, #f39c12);
            color: white;
        }
        
        .prestige-medium {
            background: linear-gradient(135deg, #4a6fa5, #166088);
            color: white;
        }
        
        .no-data {
            grid-column: 1 / -1;
            text-align: center;
            padding: 30px;
            color: #95a5a6;
            font-style: italic;
        }
    </style>
`);