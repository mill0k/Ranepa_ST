let currentMode = 'schedule';
let currentView = 'list';
let scheduleData = [];
let sessionData = [];
let currentWeekOffset = 0;
let currentMonthOffset = 0;
let selectedGroup = 'all';
let changelogData = [];

let scheduleMinDate = null;
let scheduleMaxDate = null;
let sessionMinDate = null;
let sessionMaxDate = null;

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
        
        computeDateBounds();
        
        if (changelogRes.ok) {
            const changelog = await changelogRes.json();
            document.getElementById('updateDate').textContent = changelog.date;
            document.getElementById('lastUpdateDate').textContent = changelog.date;
            
            const changesList = document.getElementById('updateChanges');
            changesList.innerHTML = '';
            changelog.changes.forEach(change => {
                const li = document.createElement('li');
                li.textContent = change;
                changesList.appendChild(li);
            });
            document.getElementById('changelogFooter').classList.remove('hidden');
            
            const panelChanges = document.getElementById('changesList');
            panelChanges.innerHTML = '';
            changelog.changes.forEach(change => {
                const div = document.createElement('div');
                div.className = 'change-item';
                div.innerHTML = `
                    <div class="change-date">${changelog.date}</div>
                    <div class="change-details">${change}</div>
                `;
                panelChanges.appendChild(div);
            });
        }
        
        render();
    } catch (error) {
        console.error("Ошибка загрузки:", error);
        document.getElementById('scheduleList').innerHTML = '<p style="text-align:center; color: #757575; padding: 20px;">Не удалось загрузить расписание</p>';
    }
}

function getYearForDate(month) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    let year = now.getFullYear();
    
    if (month < currentMonth) {
        year++;
    }
    
    return year;
}

function computeDateBounds() {
    // Границы для расписания
    const scheduleDates = [];
    scheduleData.forEach(l => {
        if (!l.date || !l.month) return;
        const d = parseInt(l.date);
        const m = parseInt(l.month);
        let year = 2026;
        if (m === 1 && new Date().getMonth() === 11) year = 2027;
        scheduleDates.push(new Date(year, m - 1, d));
    });
    
    if (scheduleDates.length > 0) {
        scheduleMinDate = new Date(Math.min(...scheduleDates));
        scheduleMaxDate = new Date(Math.max(...scheduleDates));
    }
    
    // Границы для сессии
    const sessionDates = [];
    sessionData.forEach(l => {
        if (!l.date || !l.month) return;
        const d = parseInt(l.date);
        const m = parseInt(l.month);
        let year = 2027; // Сессия обычно в январе
        if (m === 12) year = 2026;
        sessionDates.push(new Date(year, m - 1, d));
    });
    
    if (sessionDates.length > 0) {
        sessionMinDate = new Date(Math.min(...sessionDates));
        sessionMaxDate = new Date(Math.max(...sessionDates));
    }
}

function render() {
    const data = currentMode === 'schedule' ? scheduleData : sessionData;
    
    if (currentView === 'list') {
        document.getElementById('scheduleView').classList.remove('hidden');
        document.getElementById('calendarView').classList.add('hidden');
        renderScheduleList(data);
    } else {
        document.getElementById('scheduleView').classList.add('hidden');
        document.getElementById('calendarView').classList.remove('hidden');
        renderCalendar(data);
    }
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
        const year1 = currentMode === 'session' ? getYearForDate(m1) : 2026;
        const year2 = currentMode === 'session' ? getYearForDate(m2) : 2026;
        return new Date(year1, m1-1, d1) - new Date(year2, m2-1, d2);
    });
    
    let datesToShow;
    if (currentMode === 'session') {
        datesToShow = sortedDates;
    } else {
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
        datesToShow = filteredDates.length > 0 ? filteredDates : sortedDates.slice(0, 7);
    }
    
    if (datesToShow.length === 0) {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        container.innerHTML = `
            <div style="text-align:center; color: #757575; padding: 40px 20px;">
                <p style="font-size: 1.1rem; margin-bottom: 8px;">📭 На этой неделе нет занятий</p>
                <p style="font-size: 0.9rem;">${weekStart.getDate()}.${String(weekStart.getMonth()+1).padStart(2,'0')} — ${weekEnd.getDate()}.${String(weekEnd.getMonth()+1).padStart(2,'0')}</p>
            </div>
        `;
        return;
    }
    
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth()+1).padStart(2, '0')}`;
    
    datesToShow.forEach(dateKey => {
        const dayData = grouped[dateKey];
        const [day, month] = dateKey.split('.').map(Number);
        const year = currentMode === 'session' ? getYearForDate(month) : 2026;
        const lessonDate = new Date(year, month - 1, day);
        const dayOfWeek = lessonDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = dateKey === todayStr && year === today.getFullYear();
        
        const dayBlock = document.createElement('div');
        dayBlock.className = 'day-block' + (isWeekend ? ' weekend' : '');
        
        const header = document.createElement('div');
        header.className = 'day-header' + (isToday ? ' today' : '');
        const dayNames = {
            'Пн.': 'Понедельник', 'Вт.': 'Вторник', 'Ср.': 'Среда',
            'Чт.': 'Четверг', 'Пт.': 'Пятница', 'Сб.': 'Суббота', 'Вс.': 'Воскресенье'
        };
        header.innerHTML = `
            <span>${dayNames[dayData.dayName] || dayData.dayName}, ${dateKey}${currentMode === 'session' ? '.' + year : ''}</span>
            ${isToday ? '<span style="font-size:0.8rem"> Сегодня</span>' : ''}
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
                    <div class="lesson-teacher"> ${lesson.teacher || 'Не указан'}</div>
                    <div class="lesson-room"> ${lesson.room || 'Не указана'}</div>
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
    
    const filteredData = filterByGroup(data);
    
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + currentMonthOffset;
    
    document.getElementById('calendarMonthTitle').textContent = `${monthNames[currentMonth % 12]} ${currentYear}`;
    
    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(day => {
        const div = document.createElement('div');
        div.className = 'cal-day-header' + (day === 'Сб' || day === 'Вс' ? ' weekend' : '');
        div.textContent = day;
        container.appendChild(div);
    });
    
    const year = currentYear;
    const month = currentMonth % 12;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    
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
        div.textContent = d;
        
        const dateStr = String(d).padStart(2, '0');
        const dayOfWeek = new Date(year, month, d).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        if (isWeekend) div.classList.add('weekend');
        if (d === today.getDate() && month === today.getMonth() && currentMonthOffset === 0) {
            div.classList.add('today');
        }
        
        if (lessonDates[dateStr]) {
            div.classList.add('has-lessons');
            const hasDSR = lessonDates[dateStr].some(l => l.type === 'ДСР');
            if (hasDSR) div.classList.add('dsr-day');
            
            const firstLesson = lessonDates[dateStr][0];
            
            const lessonInfo = document.createElement('div');
            lessonInfo.className = 'cal-lesson-info';
            lessonInfo.innerHTML = `
                <div class="cal-time">${firstLesson.time || ''}</div>
                <div class="cal-subject">${firstLesson.subject || ''}</div>
                <div class="cal-type">${firstLesson.type || ''}</div>
            `;
            div.appendChild(lessonInfo);
        }
        
        div.addEventListener('click', () => {
            currentView = 'list';
            updateNavButtons();
            render();
        });
        
        container.appendChild(div);
    }
}

function updateWeekTitle() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const title = `${weekStart.getDate()}.${String(weekStart.getMonth()+1).padStart(2,'0')} - ${weekEnd.getDate()}.${String(weekEnd.getMonth()+1).padStart(2,'0')}`;
    document.getElementById('weekTitle').textContent = currentWeekOffset === 0 ? 'Текущая неделя' : title;
}

function updateWeekButtons() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const prevBtn = document.getElementById('prevWeek');
    const nextBtn = document.getElementById('nextWeek');
    
    // Определяем границы в зависимости от режима
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
    document.getElementById('calendarBtn').classList.toggle('active', currentView === 'calendar');
    
    const scheduleBtn = document.getElementById('scheduleBtn');
    const label = scheduleBtn.querySelector('.nav-label');
    if (label) {
        label.textContent = currentMode === 'schedule' ? 'Расписание' : 'Сессия';
    }
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
    render();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonthOffset++;
    render();
});

document.getElementById('scheduleBtn').addEventListener('click', () => {
    if (currentView === 'calendar') {
        currentView = 'list';
    } else {
        currentMode = currentMode === 'schedule' ? 'session' : 'schedule';
    }
    updateNavButtons();
    render();
});

document.getElementById('calendarBtn').addEventListener('click', () => {
    currentView = 'calendar';
    updateNavButtons();
    render();
});

document.getElementById('groupSelect').addEventListener('change', (e) => {
    selectedGroup = e.target.value;
    render();
});

// Панель обновлений
document.getElementById('updatesBtn').addEventListener('click', () => {
    document.getElementById('updatesPanel').classList.remove('hidden');
});

document.getElementById('closeUpdates').addEventListener('click', () => {
    document.getElementById('updatesPanel').classList.add('hidden');
});

document.addEventListener('click', (e) => {
    const panel = document.getElementById('updatesPanel');
    const btn = document.getElementById('updatesBtn');
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.add('hidden');
    }
});

// Инициализация
updateNavButtons();
loadData();
