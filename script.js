let currentMode = 'schedule'; // 'schedule' или 'session'
let currentView = 'list';     // 'list' или 'calendar'
let scheduleData = [];
let sessionData = [];

// Навигация
let weekOffset = 0;  // смещение недель от текущей
let monthOffset = 0; // смещение месяцев от текущего

const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", 
                     "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAY_NAMES_FULL = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

async function loadData() {
    try {
        const t = Date.now();
        const [scheduleRes, sessionRes, changelogRes] = await Promise.all([
            fetch(`data/schedule.json?t=${t}`),
            fetch(`data/session.json?t=${t}`),
            fetch(`data/changelog.json?t=${t}`)
        ]);
        
        if (scheduleRes.ok) scheduleData = await scheduleRes.json();
        if (sessionRes.ok) sessionData = await sessionRes.json();
        
        if (changelogRes.ok) {
            const changelog = await changelogRes.json();
            document.getElementById('updateDate').textContent = changelog.date;
            const changesList = document.getElementById('updateChanges');
            changesList.innerHTML = '';
            changelog.changes.forEach(change => {
                const li = document.createElement('li');
                li.textContent = change;
                changesList.appendChild(li);
            });
            document.getElementById('changelogBanner').classList.remove('hidden');
        }
        
        render();
    } catch (error) {
        console.error("Ошибка загрузки:", error);
        document.getElementById('scheduleList').innerHTML = '<p style="text-align:center; color: #8e8e93; padding: 40px;">⚠️ Не удалось загрузить расписание</p>';
    }
}

// ===== УТИЛИТЫ ДАТ =====
function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

function formatDateKey(d) {
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth()+1).padStart(2, '0')}`;
}

function parseDate(dateStr, monthStr) {
    const d = parseInt(dateStr);
    const m = parseInt(monthStr) - 1;
    const year = new Date().getFullYear();
    return new Date(year, m, d);
}

function isSameDay(d1, d2) {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
}

// ===== РЕНДЕР =====
function render() {
    const data = currentMode === 'schedule' ? scheduleData : sessionData;
    
    if (currentView === 'list') {
        document.getElementById('scheduleView').classList.remove('hidden');
        document.getElementById('calendarView').classList.add('hidden');
        document.getElementById('weekNav').classList.remove('hidden');
        document.getElementById('monthNav').classList.add('hidden');
        renderScheduleList(data);
    } else {
        document.getElementById('scheduleView').classList.add('hidden');
        document.getElementById('calendarView').classList.remove('hidden');
        document.getElementById('weekNav').classList.add('hidden');
        document.getElementById('monthNav').classList.remove('hidden');
        renderCalendar(data);
    }
}

function renderScheduleList(data) {
    const container = document.getElementById('scheduleList');
    container.innerHTML = '';
    
    // Группируем по датам
    const grouped = {};
    data.forEach(lesson => {
        if (!lesson.date) return;
        const dateKey = `${lesson.date}.${lesson.month}`;
        if (!grouped[dateKey]) {
            grouped[dateKey] = { dayName: lesson.day, lessons: [], date: lesson.date, month: lesson.month };
        }
        grouped[dateKey].lessons.push(lesson);
    });
    
    // Сортируем даты
    const sortedDates = Object.keys(grouped).sort((a, b) => {
        const [d1, m1] = a.split('.').map(Number);
        const [d2, m2] = b.split('.').map(Number);
        return new Date(2026, m1-1, d1) - new Date(2026, m2-1, d2);
    });
    
    // Определяем диапазон недели
    const today = new Date();
    const monday = getMonday(today);
    const targetMonday = new Date(monday);
    targetMonday.setDate(monday.getDate() + weekOffset * 7);
    const sunday = new Date(targetMonday);
    sunday.setDate(targetMonday.getDate() + 6);
    
    // Фильтруем даты в диапазоне недели
    const weekDates = sortedDates.filter(dateKey => {
        const [d, m] = dateKey.split('.').map(Number);
        const year = today.getFullYear();
        const lessonDate = new Date(year, m - 1, d);
        return lessonDate >= targetMonday && lessonDate <= sunday;
    });
    
    // Обновляем заголовок
    const weekTitle = document.getElementById('weekTitle');
    if (weekOffset === 0) {
        weekTitle.textContent = 'Текущая неделя';
    } else if (weekOffset === 1) {
        weekTitle.textContent = 'Следующая неделя';
    } else if (weekOffset === -1) {
        weekTitle.textContent = 'Прошлая неделя';
    } else {
        weekTitle.textContent = `${formatDateKey(targetMonday)} — ${formatDateKey(sunday)}`;
    }
    
    if (weekDates.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #8e8e93; padding: 40px;">На этой неделе пар нет 🎉</p>';
        return;
    }
    
    weekDates.forEach(dateKey => {
        const dayData = grouped[dateKey];
        const [d, m] = dateKey.split('.').map(Number);
        const lessonDate = new Date(today.getFullYear(), m - 1, d);
        const dayOfWeek = lessonDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = isSameDay(lessonDate, today);
        const hasDsr = dayData.lessons.some(l => l.type === 'ДСР');
        
        const dayBlock = document.createElement('div');
        dayBlock.className = 'day-block';
        if (isWeekend) dayBlock.classList.add('weekend');
        if (isToday) dayBlock.classList.add('today');
        if (hasDsr) dayBlock.classList.add('dsr-day');
        
        const header = document.createElement('div');
        header.className = 'day-header';
        const dateLabel = `${DAY_NAMES_FULL[dayOfWeek]}, ${dateKey}`;
        header.innerHTML = `<span>${dateLabel}</span><span class="date-label">${isToday ? '📍 Сегодня' : ''}</span>`;
        dayBlock.appendChild(header);
        
        dayData.lessons.forEach(lesson => {
            const lessonDiv = document.createElement('div');
            lessonDiv.className = 'lesson';
            
            const isDsr = lesson.type === 'ДСР';
            const isSdo = lesson.subject.toLowerCase().includes('сдо') || 
                         lesson.room?.toLowerCase().includes('сдо');
            
            if (isDsr) lessonDiv.classList.add('dsr');
            if (isSdo) lessonDiv.classList.add('sdo');
            
            let subjectHtml = lesson.subject;
            if (isDsr) subjectHtml += ' <span class="badge badge-dsr">ДСР</span>';
            if (isSdo) subjectHtml += ' <span class="badge badge-sdo">СДО</span>';
            
            lessonDiv.innerHTML = `
                <div class="lesson-time">${lesson.time || '—'}</div>
                <div class="lesson-details">
                    <div class="lesson-subject">${subjectHtml}</div>
                    <div class="lesson-type">${lesson.type} | ${lesson.group}</div>
                    <div class="lesson-teacher">👤 ${lesson.teacher || '—'}</div>
                    <div class="lesson-room">🚪 ${lesson.room || 'Не указана'}</div>
                </div>
            `;
            dayBlock.appendChild(lessonDiv);
        });
        container.appendChild(dayBlock);
    });
}

function renderCalendar(data) {
    const container = document.getElementById('calendarGrid');
    container.innerHTML = '';
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + monthOffset;
    
    // Корректировка года при переходе через декабрь/январь
    const actualYear = year + Math.floor(month / 12);
    const actualMonth = ((month % 12) + 12) % 12;
    
    document.getElementById('monthTitle').textContent = `${MONTH_NAMES[actualMonth]} ${actualYear}`;
    
    const firstDay = new Date(actualYear, actualMonth, 1).getDay();
    const daysInMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    
    // Пустые ячейки в начале
    for (let i = 0; i < startOffset; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day empty';
        container.appendChild(div);
    }
    
    // Группируем уроки по дням
    const lessonsByDay = {};
    data.forEach(lesson => {
        if (!lesson.date) return;
        const d = parseInt(lesson.date);
        const m = parseInt(lesson.month) - 1;
        if (m === actualMonth) {
            if (!lessonsByDay[d]) lessonsByDay[d] = [];
            lessonsByDay[d].push(lesson);
        }
    });
    
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(actualYear, actualMonth, d);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = isSameDay(date, today);
        const dayLessons = lessonsByDay[d] || [];
        
        const div = document.createElement('div');
        div.className = 'cal-day';
        if (isWeekend) div.classList.add('weekend');
        if (isToday) div.classList.add('today');
        
        const numDiv = document.createElement('div');
        numDiv.className = 'cal-day-number';
        numDiv.textContent = d;
        div.appendChild(numDiv);
        
        // Показываем до 3 событий
        const maxShow = 3;
        dayLessons.slice(0, maxShow).forEach(lesson => {
            const event = document.createElement('div');
            event.className = 'cal-event';
            if (lesson.type === 'ДСР') event.classList.add('dsr');
            if (lesson.room?.toLowerCase().includes('сдо')) event.classList.add('sdo');
            event.textContent = lesson.time ? `${lesson.time.split('-')[0]} ${lesson.subject}` : lesson.subject;
            event.title = `${lesson.subject}\n${lesson.teacher}\n${lesson.room}`;
            div.appendChild(event);
        });
        
        if (dayLessons.length > maxShow) {
            const more = document.createElement('div');
            more.className = 'cal-more';
            more.textContent = `+${dayLessons.length - maxShow}`;
            div.appendChild(more);
        }
        
        div.addEventListener('click', () => {
            // Переходим к списку на эту неделю
            const monday = getMonday(date);
            const todayMonday = getMonday(today);
            weekOffset = Math.round((monday - todayMonday) / (7 * 24 * 60 * 60 * 1000));
            currentView = 'list';
            render();
        });
        
        container.appendChild(div);
    }
}

// ===== ОБРАБОТЧИКИ =====
document.getElementById('modeSchedule').addEventListener('click', () => {
    currentMode = 'schedule';
    document.getElementById('modeSchedule').classList.add('active');
    document.getElementById('modeSession').classList.remove('active');
    render();
});

document.getElementById('modeSession').addEventListener('click', () => {
    currentMode = 'session';
    document.getElementById('modeSession').classList.add('active');
    document.getElementById('modeSchedule').classList.remove('active');
    render();
});

document.getElementById('toggleView').addEventListener('click', () => {
    currentView = currentView === 'list' ? 'calendar' : 'list';
    document.getElementById('fabIcon').textContent = currentView === 'list' ? '📅' : '📋';
    render();
});

// Навигация по неделям
document.getElementById('prevWeek').addEventListener('click', () => { weekOffset--; render(); });
document.getElementById('nextWeek').addEventListener('click', () => { weekOffset++; render(); });
document.getElementById('todayWeek').addEventListener('click', () => { weekOffset = 0; render(); });

// Навигация по месяцам
document.getElementById('prevMonth').addEventListener('click', () => { monthOffset--; render(); });
document.getElementById('nextMonth').addEventListener('click', () => { monthOffset++; render(); });
document.getElementById('todayMonth').addEventListener('click', () => { monthOffset = 0; render(); });

// Закрытие баннера
document.getElementById('closeChangelog').addEventListener('click', () => {
    document.getElementById('changelogBanner').classList.add('hidden');
});

// Запуск
loadData();
