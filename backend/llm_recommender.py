import os
import json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

groq_client = None
if GROQ_API_KEY:
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception:
        groq_client = None


def generate_ai_recommendation(text: str, category: str, priority: str, resources: list[str]) -> str:
    if groq_client is None:
        return json.dumps({
            "recommended_resources": resources,
            "tactical_action": "Standard emergency dispatch protocol."
        })

    prompt = (
        f"You are an emergency disaster response assistant. Incident text: '{text}'. "
        f"Assigned category: '{category}', Priority: '{priority}', Assigned resources: {resources}. "
        f"Provide a concise 2-sentence tactical guidance note for the field incident commander. "
        f"Do not alter or question the category or priority."
    )

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            max_tokens=150,
        )
        tactical_action = chat_completion.choices[0].message.content.strip()
    except Exception:
        tactical_action = "Immediate tactical dispatch per standard operating procedure."

    return json.dumps({
        "recommended_resources": resources,
        "tactical_action": tactical_action
    })
