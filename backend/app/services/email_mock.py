import datetime
from typing import List, Dict

# Global in-memory list to store sent emails so the frontend can display them for demo purposes
sent_emails: List[Dict] = []

def send_email(to_email: str, subject: str, body: str):
    email_entry = {
        "id": len(sent_emails) + 1,
        "to_email": to_email,
        "subject": subject,
        "body": body,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    sent_emails.append(email_entry)
    
    print("\n" + "="*50)
    print("MOCK EMAIL SENT:")
    print(f"TO: {to_email}")
    print(f"SUBJECT: {subject}")
    print(f"BODY:\n{body}")
    print("="*50 + "\n")

def get_sent_emails() -> List[Dict]:
    return sent_emails
