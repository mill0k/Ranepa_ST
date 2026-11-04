let currentMode = 'schedule';
let currentView = 'list';
let scheduleData = [];
let sessionData = [];
let currentWeekOffset = 0;
let currentMonthOffset = 0;
let selectedGroup = 'all';
let changelogData = null;

let scheduleMinDate = null;
let scheduleMaxDate = null;
let sessionMinDate = null;
let sessionMaxDate = null;

// Структура учебного года
const academicYear = {
    semester1_4: { start: '2026-09-01', end: '2026-12-31', name: '1 семестр 4 курса' },
    session1_4: { start: '2027-01-01', end: '2027-02-28', name: 'Сессия 1 семестра 4 курса' },
    semester2_4: { start: '2027-02-01', end: '2027-05-31', name: '2 семестр 4 курса' },
    session2_4: { start: '2027-06-01', end: '2027-07-31', name: 'Сессия 2 семестра 4 курса' },
    
    semester1_5: { start: '2027-09-01', end: '2027-12-31', name: '1 семестр 5 курса' },
    session1_5: { start: '2028-01-01', end: '2028-02-28', name: 'Сессия 1 семестра 5 курса' },
    semester2_5: { start: '2028-02-01', end: '2028-05-31', name: '2 семестр 5 курса' },
    session2_5: { start: '2028-06-01', end: '2028-07-31', name: 'Сессия 2 семестра 5 курса' }
};

function getCurrentPeriod(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    
    for (let key in academicYear) {
        const period = academicYear[key];
        if (dateStr >= period.start && dateStr <= period.end) {
            return { key, ...period };
        }
    }
    
    return null;
}

function isSessionPeriod(periodKey) {
    return periodKey && periodKey.includes('session');
}

// Получить смещение месяца для календаря на основе периода
function getMonthOffsetForPeriod(period) {
    if (!period) return 0;
    
    const startDate = new Date(period.start);
    const today = new Date();
    
    return (startDate.getFullYear() - today.getFullYear()) * 12 + (startDate.getMonth() - today.getMonth());
}

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
        
        computeDateBounds(scheduleData, 'schedule');
        computeDateBounds(sessionData, 'session');
        
        if (changelogRes.ok) {
            changelogData = await changelogRes.json();
            document.getElementById('updateDate').textContent = changelogData.date;
            const changesList = document.getElementById('updateChanges');
            changesList.innerHTML = '';
            changelogData.changes.forEach(change => {
                const li = document.createElement('li');
                li.textContent = change;
                changesList.appendChild(li);
            });
            document.getElementById('changelogFooter').classList.remove('hidden');
        }
        
        // Автоматически определяем режим и смещение календаря
        const currentPeriod = getCurrentPeriod();
        if (currentPeriod && isSessionPeriod(currentPeriod.key)) {
            currentMode = 'session';
            currentMonthOffset = getMonthOffsetForPeriod(currentPeriod);
            if (sessionMinDate) {
                currentWeekOffset = getWeekOffsetForDate(sessionMinDate);
            }
        } else {
            currentMode = 'schedule';
            currentMonthOffset = 0;
            currentWeekOffset = 0;
        }
        
        render();
    } catch (error) {
        console.error("Ошибка загрузки:", error);
        document.getElementById('scheduleList').innerHTML = '<p style="text-align:center; color: #757575; padding: 20px;">Не удалось загрузить расписание</p>';
    }
}

function getDateFromDayMonth(d, m) {
    const now = new Date();
    let year = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const currentPeriod = getCurrentPeriod();
    
    if (currentPeriod) {
        if (isSessionPeriod(currentPeriod.key)) {
            if (m >= 11 || m <= 2) {
                if (m <= 2) year++;
            }
        } else {
            if (m >= 9 && m <= 12 && currentMonth >= 1 && currentMonth <= 7) {
                year--;
            } else if (m >= 1 && m <= 7 && currentMonth >= 9 && currentMonth <= 12) {
                year++;
            }
        }
    } else {
        if (m <= 2 && currentMonth >= 10) {
            year++;
        } else if (m >= 11 && currentMonth <= 2) {
            year--;
        }
    }
    
    return new Date(year, m - 1, d);
}

function computeDateBounds(data, type) {
    const dates = [];
    data.forEach(l => {
        if (!l.date || !l.month) return;
        const d = parseInt(l.date);
        const m = parseInt(l.month);
        dates.push(getDateFromDayMonth(d, m));
    });
    
    if (dates.length > 0) {
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        
        if (type === 'schedule') {
            scheduleMinDate = min;
            scheduleMaxDate = max;
        } else {
            sessionMinDate = min;
            sessionMaxDate = max;
        }
    }
}

function render() {
    const data = currentMode === 'schedule' ? scheduleData : sessionData;
    renderScheduleList(data);
    updateWeekTitle();
    updateWeekButtons();
}

function filterByGroup(data) {
    if (selectedGroup === 'all') return data;
    return data.filter(lesson => {
        if (!lesson.group) return false;
        return lesson.group.includes(selectedGroup);
    });
}

function renderScheduleList(data) {
    const container = document.getElementById('scheduleList');
    container.innerHTML = '';
    
    const filteredData = filterByGroup(data);
    
    const grouped = {};
    filteredData.forEach(lesson => {
        if (!lesson.date) return;
        const dateKey = `${lesson.date}.${lesson.month}`;
        if (!grouped[dateKey]) {
            grouped[dateKey] = { dayName: lesson.day, lessons: [] };
        }
        grouped[dateKey].lessons.push(lesson);
    });
    
    const sortedDates = Object.keys(grouped).sort((a, b) => {
        const [d1, m1] = a.split('.').map(Number);
        const [d2, m2] = b.split('.').map(Number);
        return getDateFromDayMonth(d1, m1) - getDateFromDayMonth(d2, m2);
    });
    
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekDates = [];
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        weekDates.push(`${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth()+1).padStart(2, '0')}`);
    }
    
    const filteredDates = sortedDates.filter(date => weekDates.includes(date));
    
    if (filteredDates.length === 0) {
        const currentPeriod = getCurrentPeriod();
        const periodName = currentPeriod ? currentPeriod.name : 'текущий период';
        
        container.innerHTML = `
            <div style="text-align:center; color: #757575; padding: 40px 20px;">
                <p style="font-size: 1.1rem; margin-bottom: 8px;">📭 На этой неделе нет занятий</p>
                <p style="font-size: 0.9rem; margin-bottom: 12px;">${periodName}</p>
                <p style="font-size: 0.85rem;">${weekStart.getDate()}.${String(weekStart.getMonth()+1).padStart(2,'0')} — ${weekEnd.getDate()}.${String(weekEnd.getMonth()+1).padStart(2,'0')}</p>
            </div>
        `;
        return;
    }
    
    const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth()+1).padStart(2, '0')}`;
    
    filteredDates.forEach(dateKey => {
        const dayData = grouped[dateKey];
        const [day, month] = dateKey.split('.').map(Number);
        const lessonDate = getDateFromDayMonth(day, month);
        const dayOfWeek = lessonDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = dateKey === todayStr;
        
        const dayBlock = document.createElement('div');
        dayBlock.className = 'day-block' + (isWeekend ? ' weekend' : '');
        
        const header = document.createElement('div');
        header.className = 'day-header' + (isToday ? ' today' : '');
        const dayNames = {
            'Пн.': 'Понедельник', 'Вт.': 'Вторник', 'Ср.': 'Среда',
            'Чт.': 'Четверг', 'Пт.': 'Пятница', 'Сб.': 'Суббота', 'Вс.': 'Воскресенье'
        };
        header.innerHTML = `
            <span>${dayNames[dayData.dayName] || dayData.dayName}, ${dateKey}</span>
            ${isToday ? '<span style="font-size:0.8rem">📍 Сегодня</span>' : ''}
            ${isWeekend && !isToday ? '<span style="font-size:0.8rem; color:#f44336">Выходной</span>' : ''}
        `;
        dayBlock.appendChild(header);
        
        dayData.lessons.forEach(lesson => {
            const lessonDiv = document.createElement('div');
            lessonDiv.className = 'lesson';
            
            const isDSR = lesson.type === 'ДСР' || (lesson.subject && lesson.subject.includes('самостоятельной'));
            const isSDO = lesson.type === 'СДО' || (lesson.room && lesson.room.includes('СДО'));
            
            if (isDSR) lessonDiv.classList.add('dsr');
            if (isSDO) lessonDiv.classList.add('sdo');
            
            let badge = '';
            if (isDSR) badge = '<span class="badge dsr">ДСР</span>';
            if (isSDO) badge = '<span class="badge sdo">СДО</span>';
            
            let groups = lesson.group || '';
            if (groups.includes('/')) {
                groups = groups.split('/').map(g => g.trim()).join(', ');
            }
            
            lessonDiv.innerHTML = `
                <div class="lesson-time">${lesson.time || '—'}</div>
                <div class="lesson-details">
                    <div class="lesson-subject">${lesson.subject || ''} ${badge}</div>
                    <div class="lesson-type">${lesson.type || ''} | ${groups}</div>
                    <div class="lesson-teacher">👤 ${lesson.teacher || 'Не указан'}</div>
                    <div class="lesson-room">🚪 ${lesson.room || 'Не указана'}</div>
                </div>
            `;
            dayBlock.appendChild(lessonDiv);
        });
        container.appendChild(dayBlock);
    });
}

function renderCalendar() {
    const container = document.getElementById('calendarGrid');
    container.innerHTML = '';
    
    const data = currentMode === 'schedule' ? scheduleData : sessionData;
    const filteredData = filterByGroup(data);
    
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const today = new Date();
    
    // Правильный расчет года и месяца с учетом смещения
    const targetDate = new Date(today.getFullYear(), today.getMonth() + currentMonthOffset, 1);
    const currentYear = targetDate.getFullYear();
    const currentMonth = targetDate.getMonth();
    
    // Ограничения по реальным датам
    const minDate = currentMode === 'schedule' ? scheduleMinDate : sessionMinDate;
    const maxDate = currentMode === 'schedule' ? scheduleMaxDate : sessionMaxDate;
    
    let minMonthOffset = -12;
    let maxMonthOffset = 12;
    
    if (minDate) {
        minMonthOffset = (minDate.getFullYear() - today.getFullYear()) * 12 + (minDate.getMonth() - today.getMonth());
    }
    if (maxDate) {
        maxMonthOffset = (maxDate.getFullYear() - today.getFullYear()) * 12 + (maxDate.getMonth() - today.getMonth());
    }
    
    document.getElementById('prevMonth').disabled = currentMonthOffset <= minMonthOffset;
    document.getElementById('nextMonth').disabled = currentMonthOffset >= maxMonthOffset;
    
    document.getElementById('calendarMonthTitle').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(day => {
        const div = document.createElement('div');
        div.className = 'cal-day-header' + (day === 'Вс' ? ' weekend' : '');
        div.textContent = day;
        container.appendChild(div);
    });
    
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    for (let i = 0; i < startOffset; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day empty';
        div.style.visibility = 'hidden';
        container.appendChild(div);
    }
    
    const lessonDates = {};
    filteredData.forEach(l => {
        if (!lessonDates[l.date]) lessonDates[l.date] = [];
        lessonDates[l.date].push(l);
    });
    
    for (let d = 1; d <= daysInMonth; d++) {
        const div = document.createElement('div');
        div.className = 'cal-day';
        
        const dateStr = String(d).padStart(2, '0');
        const monthStr = String(currentMonth + 1).padStart(2, '0');
        const dateKey = `${dateStr}.${monthStr}`;
        
        const currentDayDate = new Date(currentYear, currentMonth, d);
        const dayOfWeek = currentDayDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isSunday = dayOfWeek === 0;
        
        const isPast = currentDayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const dayNumber = document.createElement('div');
        dayNumber.textContent = d;
        dayNumber.style.fontWeight = '600';
        dayNumber.style.fontSize = '0.75rem';
        div.appendChild(dayNumber);
        
        if (isWeekend) div.classList.add('weekend');
        if (isPast) div.classList.add('past');
        if (d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
            div.classList.add('today');
        }
        
        if (!isSunday && lessonDates[dateKey]) {
            const firstLesson = lessonDates[dateKey][0];
            
            const isDSR = firstLesson.type === 'ДСР' || (firstLesson.subject && firstLesson.subject.includes('самостоятельной'));
            const isSDO = firstLesson.type === 'СДО' || (firstLesson.room && firstLesson.room.includes('СДО'));
            
            if (isDSR) {
                div.classList.add('dsr-day');
            } else if (isSDO) {
                div.classList.add('sdo-day');
            }
            
            const lessonInfo = document.createElement('div');
            lessonInfo.className = 'cal-lesson-info';
            lessonInfo.innerHTML = `
                <div class="cal-time">${firstLesson.time || ''}</div>
                <div class="cal-subject">${firstLesson.subject || ''}</div>
                <div class="cal-type">${firstLesson.type || ''}</div>
                <div class="cal-room">🚪${firstLesson.room || ''}</div>
            `;
            div.appendChild(lessonInfo);
        }
        
        container.appendChild(div);
    }
}

function renderHistory() {
    const container = document.getElementById('historyContent');
    
    if (!changelogData || !changelogData.changes || changelogData.changes.length === 0) {
        container.innerHTML = '<p class="no-history">📭 История изменений пуста.<br>Здесь появятся записи, когда расписание обновится.</p>';
        return;
    }
    
    const html = `
        <div class="history-update">
            <div class="history-date">🕐 Последнее обновление: ${changelogData.date}</div>
            <ul class="history-changes">
                ${changelogData.changes.map(change => `<li>${change}</li>`).join('')}
            </ul>
        </div>
    `;
    
    container.innerHTML = html;
}

function updateWeekTitle() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const title = `${weekStart.getDate()}.${String(weekStart.getMonth()+1).padStart(2,'0')} - ${weekEnd.getDate()}.${String(weekEnd.getMonth()+1).padStart(2,'0')}`;
    
    const currentPeriod = getCurrentPeriod();
    const periodName = currentPeriod ? currentPeriod.name : '';
    
    document.getElementById('weekTitle').textContent = currentWeekOffset === 0 
        ? `Текущая неделя (${periodName})` 
        : title;
}

function updateWeekButtons() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const prevBtn = document.getElementById('prevWeek');
    const nextBtn = document.getElementById('nextWeek');
    
    const minDate = currentMode === 'schedule' ? scheduleMinDate : sessionMinDate;
    const maxDate = currentMode === 'schedule' ? scheduleMaxDate : sessionMaxDate;
    
    if (minDate && weekEnd < minDate) {
        prevBtn.disabled = true;
    } else {
        prevBtn.disabled = false;
    }
    
    if (maxDate && weekStart > maxDate) {
        nextBtn.disabled = true;
    } else {
        nextBtn.disabled = false;
    }
}

function updateNavButtons() {
    document.getElementById('scheduleBtn').classList.toggle('active', currentView === 'list');
    document.getElementById('calendarBtn').classList.remove('active');
    document.getElementById('historyBtn').classList.remove('active');
    
    const scheduleBtn = document.getElementById('scheduleBtn');
    const label = scheduleBtn.querySelector('.nav-label');
    if (label) {
        label.textContent = currentMode === 'schedule' ? 'Расписание' : 'Сессия';
    }
}

function openCalendar() {
    document.getElementById('calendarPanel').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    renderCalendar();
}

function closeCalendar() {
    document.getElementById('calendarPanel').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

function openHistory() {
    document.getElementById('historyPanel').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    renderHistory();
}

function closeHistory() {
    document.getElementById('historyPanel').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

function closeAllPanels() {
    closeCalendar();
    closeHistory();
}

function getWeekOffsetForDate(targetDate) {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay() + 1);
    
    const targetWeekStart = new Date(targetDate);
    targetWeekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1);
    
    const diffTime = targetWeekStart - currentWeekStart;
    const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
    
    return diffWeeks;
}

// Event Listeners
document.getElementById('prevWeek').addEventListener('click', () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + ((currentWeekOffset - 1) * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const minDate = currentMode === 'schedule' ? scheduleMinDate : sessionMinDate;
    
    if (minDate && weekEnd < minDate) return;
    
    currentWeekOffset--;
    render();
});

document.getElementById('nextWeek').addEventListener('click', () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + ((currentWeekOffset + 1) * 7));
    
    const maxDate = currentMode === 'schedule' ? scheduleMaxDate : sessionMaxDate;
    
    if (maxDate && weekStart > maxDate) return;
    
    currentWeekOffset++;
    render();
});

document.getElementById('todayBtn').addEventListener('click', () => {
    currentWeekOffset = 0;
    render();
});

document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonthOffset--;
    renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonthOffset++;
    renderCalendar();
});

document.getElementById('scheduleBtn').addEventListener('click', () => {
    closeAllPanels();
    if (currentMode === 'schedule') {
        currentMode = 'session';
        // При переключении на сессию - перейти к месяцу сессии
        const sessionPeriod = getCurrentPeriod();
        if (sessionPeriod && isSessionPeriod(sessionPeriod.key)) {
            currentMonthOffset = getMonthOffsetForPeriod(sessionPeriod);
        } else {
            // Если сейчас не период сессии, показать январь следующего года
            const today = new Date();
            currentMonthOffset = (today.getFullYear() + 1 - today.getFullYear()) * 12 + (0 - today.getMonth());
        }
        if (sessionMinDate) {
            currentWeekOffset = getWeekOffsetForDate(sessionMinDate);
        } else {
            currentWeekOffset = 0;
        }
    } else {
        currentMode = 'schedule';
        currentMonthOffset = 0;
        currentWeekOffset = 0;
    }
    updateNavButtons();
    render();
});

document.getElementById('calendarBtn').addEventListener('click', () => {
    openCalendar();
    document.getElementById('calendarBtn').classList.add('active');
});

document.getElementById('historyBtn').addEventListener('click', () => {
    openHistory();
    document.getElementById('historyBtn').classList.add('active');
});

document.getElementById('groupSelect').addEventListener('change', (e) => {
    selectedGroup = e.target.value;
    render();
});

// Инициализация
updateNavButtons();
loadData();
