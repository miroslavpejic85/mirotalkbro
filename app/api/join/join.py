# pip3 install requests
import requests
import json

API_KEY_SECRET = "mirotalkbro_default_secret"
MIROTALK_URL = "https://bro.mirotalk.com/api/v1/join"
#MIROTALK_URL = "http://localhost:3016/api/v1/join"

headers = {
    "authorization": API_KEY_SECRET,
    "Content-Type": "application/json",
}

data = {
    "room": "test"
}

response = requests.post(
    MIROTALK_URL,
    headers=headers,
    json=data,
)

print("Status code:", response.status_code)
data = json.loads(response.text)
print("join:", data["join"])
