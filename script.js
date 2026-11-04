let currentMode = 'schedule'; // 'schedule' или 'session'
let currentView = 'list';     // 'list' или 'calendar'
let scheduleData = [];
let sessionData = [];

async function loadData() {
    try {
        const t = Date.now(); // Защита от кэширования
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
            document.getElementById('changelogFooter').classList.remove('hidden');
        }
        
        render();
    } catch (error) {
        console.error("Ошибка загрузки:", error);
        document.getElementById('scheduleList').innerHTML = '<p style="text-align:center; color: #8D6E63;">Не удалось загрузить расписание. Проверьте интернет.</p>';
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
}

function renderScheduleList(data) {
    const container = document.getElementById('scheduleList');
    container.innerHTML = '';
    
    const grouped = {};
    data.forEach(lesson => {
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
        return new Date(2026, m1-1, d1) - new Date(2026, m2-1, d2);
    });
    
    // Фильтр: показываем только текущую неделю (от 2 дней назад до 5 дней вперед)
    const today = new Date();
    const validDates = sortedDates.filter(dateKey => {
        const [d, m] = dateKey.split('.').map(Number);
        let year = today.getFullYear();
        if (m === 1 && today.getMonth() === 11) year++;
        if (m === 12 && today.getMonth() === 0) year--;
        
        const lessonDate = new Date(year, m - 1, d);
        const diffDays = Math.ceil((lessonDate - today) / (1000 * 60 * 60 * 24));
        return diffDays >= -2 && diffDays <= 5;
    });
    
    const datesToShow = validDates.length > 0 ? validDates : sortedDates.slice(0, 7);
    const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth()+1).padStart(2, '0')}`;
    
    datesToShow.forEach(dateKey => {
        const dayData = grouped[dateKey];
        const dayBlock = document.createElement('div');
        dayBlock.className = 'day-block';
        
        const isToday = dateKey === todayStr;
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = `${dayData.dayName}, ${dateKey}${isToday ? ' (Сегодня)' : ''}`;
        if (isToday) header.style.color = '#D32F2F';
        dayBlock.appendChild(header);
        
        dayData.lessons.forEach(lesson => {
            const lessonDiv = document.createElement('div');
            lessonDiv.className = 'lesson';
            lessonDiv.innerHTML = `
                <div class="lesson-time">${lesson.time || '—'}</div>
                <div class="lesson-details">
                    <div class="lesson-subject">${lesson.subject}</div>
                    <div class="lesson-type">${lesson.type} | ${lesson.group}</div>
                    <div class="lesson-teacher">👤 ${lesson.teacher}</div>
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
    
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const today = new Date();
    document.getElementById('calendarMonthTitle').textContent = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(day => {
        const div = document.createElement('div');
        div.className = 'cal-day-header';
        div.textContent = day;
        container.appendChild(div);
    });
    
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    
    for (let i = 0; i < startOffset; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day empty';
        container.appendChild(div);
    }
    
    const lessonDates = new Set(data.map(l => parseInt(l.date)));
    
    for (let d = 1; d <= daysInMonth; d++) {
        const div = document.createElement('div');
        div.className = 'cal-day';
        div.textContent = d;
        
        if (lessonDates.has(d)) div.classList.add('has-lessons');
        if (d === today.getDate() && month === today.getMonth()) div.classList.add('today');
        
        div.addEventListener('click', () => {
            currentView = 'list';
            document.getElementById('calendarBtn').textContent = 'Календарь';
            document.getElementById('calendarBtn').classList.remove('active');
            render();
        });
        
        container.appendChild(div);
    }
}

document.getElementById('toggleMode').addEventListener('click', (e) => {
    currentMode = currentMode === 'schedule' ? 'session' : 'schedule';
    e.target.textContent = currentMode === 'schedule' ? 'Расписание' : 'Сессия';
    render();
});

document.getElementById('calendarBtn').addEventListener('click', (e) => {
    currentView = currentView === 'list' ? 'calendar' : 'list';
    e.target.textContent = currentView === 'list' ? 'Календарь' : 'Список';
    e.target.classList.toggle('active');
    render();
});

loadData();
