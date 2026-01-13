// Базовые URL API - используем только старые маршруты
const API_BASE = "http://78.40.188.120:3000";
const DATA_API = API_BASE + '/cats-data';
const STATS_API = API_BASE + '/stats';
const PRESTIGE_API = API_BASE + '/prestige-stats';

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

// Форматирование чисел
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

// Получение данных с сервера
async function fetchData() {
    try {
        console.log('Запрашиваем данные...');
        const [statsData, prestigeData, allData] = await Promise.all([
            fetch(STATS_API).then(res => res.json()),
            fetch(PRESTIGE_API).then(res => res.json()),
            fetch(DATA_API).then(res => res.json())
        ]);

        console.log('Данные получены:', statsData);
        updateStats(statsData);
        updatePrestigeStats(prestigeData);
        updateTable(allData);
        updateTimestamp(statsData.timestamp);
        
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        showError('Ошибка подключения к серверу. Проверьте консоль для подробностей.');
    }
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
    
    sortedLevels.forEach(level => {
        const count = prestigeStats[level];
        html += `
            <div class="prestige-item">
                <div class="prestige-level">${level}</div>
                <div class="prestige-count">${formatNumber(count)} игроков</div>
            </div>
        `;
    });
    
    elements.prestigeStats.innerHTML = html;
}

// Обновление таблицы
function updateTable(data) {
    let html = '';
    const entries = Object.entries(data || {});
    
    // Сортируем по количеству котов (по убыванию)
    entries.sort((a, b) => (b[1].cats || 0) - (a[1].cats || 0));
    
    entries.forEach(([player, stats]) => {
        const successRate = stats.attacks > 0 
            ? Math.round((stats.successful_attacks || 0) / stats.attacks * 100)
            : 0;
            
        html += `
            <tr>
                <td><strong>${player}</strong></td>
                <td>${formatNumber(stats.cats || 0)}</td>
                <td>${formatNumber(stats.attacks || 0)}</td>
                <td>${formatNumber(stats.successful_attacks || 0)} (${successRate}%)</td>
                <td>${formatNumber(stats.matroskin || 0)}</td>
                <td>${stats.prestige_level || 0}</td>
            </tr>
        `;
    });
    
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
    elements.lastUpdate.textContent = `Обновлено: ${timeString}`;
}

// Показать ошибку
function showError(message) {
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
    `;
    
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="margin-right: 10px; font-size: 1.2rem;"></i>
        <div>${message}</div>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Обновление данных каждую секунду
function startAutoRefresh() {
    fetchData(); // Первоначальная загрузка
    
    setInterval(() => {
        fetchData();
    }, 1000);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', startAutoRefresh);