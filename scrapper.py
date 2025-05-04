import requests
import time
import json
from typing import List, Dict

headers = {
    "User-Agent": "HH-User-Agent",
}

def get_vacancies(text_prompt: str, per_page: int, max_pages: int) -> List[Dict]:
    """ Returns the vacancies as a pair of name and skills """
    params = {
        "text": f"NAME:({text_prompt})",
        "per_page": per_page,
    }

    vacancies_data = []
    
    for page in range(max_pages):
        params["page"] = page
        response = requests.get("https://api.hh.ru/vacancies", headers=headers, params=params)
            
        data = response.json()
        vacancies = data.get('items', [])
        
        if not vacancies:
            break

        for vacancy in vacancies:
            vacancy_id = vacancy.get('id')
            if not vacancy_id:
                continue

            # Get the details on each vacancy
            detail_response = requests.get(
                f"https://api.hh.ru/vacancies/{vacancy_id}", 
                headers=headers
            )
            
            if detail_response.status_code != 200:
                continue

            vacancy_details = detail_response.json()
            skills = [skill['name'] for skill in vacancy_details.get('key_skills', [])]
            
            if not skills:
                continue
                
            vacancy_data = {
                "name": vacancy_details.get('name', ''),
                "skills": skills
            }
            vacancies_data.append(vacancy_data)
            print(f'{len(vacancies_data)} records for the current text prompt')
            
            time.sleep(1) # Limit the rate of requests

    return vacancies_data

def save_to_json(data: List[Dict], filename: str) -> None:
    """ Saves the data as a JSON file """
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Data saved in {filename} ({len(data)} records)")

# Text prompts for search
prompts = {
    "backend": "Backend",
    "frontend": "Frontend",
    "fullstack": "Fullstack",
    "data_analyst": '"Data analyst" OR "Аналитик данных"'
}

# Data retrieval parameters
search_params = {
    "per_page": 100,
    "max_pages": 20
}

# Retrieve and save all data for each prompt
for category, prompt in prompts.items():
    print(f"\nStarting collecting data for: {category}")
    vacancies = get_vacancies(prompt, **search_params)
    filename = f"{category}_vacancies.json"
    save_to_json(vacancies, filename)

print("\nData collection finished!")