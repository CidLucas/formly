import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/formly")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
S3_BUCKET = os.getenv("S3_BUCKET", "formly-uploads")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

# API keys loaded from environment:
# GROQ_API_KEY, DEEPSEEK_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
