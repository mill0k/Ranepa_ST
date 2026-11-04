import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime

URLS = {
    "schedule": "https://spb.ranepa.ru/raspisanie/ekonomicheskaya-bezopasnost-eb-5-23-01-eb-5-23-02/",
    "session": "https://spb.ranepa.ru/raspisanie/eb-5-23-01-02/"
}

def fetch_schedule(url):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Ошибка загрузки {url}: {e}")
        return []
    
    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table')
    if not table:
        return []
    
    schedule = []
    for row in table.find_all('tr'):
        cols = row.find_all(['td', 'th'])
        texts = [col.get_text(strip=True) for col in cols]
        
        # Фильтр: строка должна начинаться с дня недели и иметь достаточно колонок
        if len(texts) >= 6 and texts[0] in ['Пн.', 'Вт.', 'Ср.', 'Чт.', 'Пт.', 'Сб.', 'Вс.']:
            schedule.append({
                "day": texts[0],
                "date": texts[1] if len(texts) > 1 else "",
                "month": texts[2] if len(texts) > 2 else "",
                "time": texts[3] if len(texts) > 3 else "",
                "group": texts[4] if len(texts) > 4 else "",
                "type": texts[5] if len(texts) > 5 else "",
                "subject": texts[6] if len(texts) > 6 else "",
                "teacher": texts[8] if len(texts) > 8 else "",
                "room": texts[9] if len(texts) > 9 else ""
            })
    return schedule

def get_diff(old, new):
    old_set = set(json.dumps(item, sort_keys=True) for item in old)
    new_set = set(json.dumps(item, sort_keys=True) for item in new)
    
    added = [json.loads(item) for item in new_set - old_set]
    removed = [json.loads(item) for item in old_set - new_set]
    
    changes = []
    if added:
        changes.append(f"Добавлено пар: {len(added)}")
    if removed:
        changes.append(f"Удалено/изменено пар: {len(removed)}")
    return changes

os.makedirs('data', exist_ok=True)
changelog = []

for key, url in URLS.items():
    filename = f"data/{key}.json"
    new_data = fetch_schedule(url)
    
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            try:
                old_data = json.load(f)
            except:
                old_data = []
        
        diff = get_diff(old_data, new_data)
        if diff:
            changelog.append(f"{key.capitalize()}: " + ", ".join(diff))
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)

if changelog:
    log_data = {
        "date": datetime.now().strftime("%d.%m.%Y в %H:%M"),
        "changes": changelog
    }
    with open('data/changelog.json', 'w', encoding='utf-8') as f:
        json.dump(log_data, f, ensure_ascii=False, indent=2)
