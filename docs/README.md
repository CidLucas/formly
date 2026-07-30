# Formly

## Setup

### Frontend
```bash
cd apps/formly_app
npm install
npm run dev
```

### Backend
```bash
cd services/formly
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### Banco
```bash
# Criar migration inicial
cd services/formly
python -c "from app.db import engine, Base; from app import models; Base.metadata.create_all(bind=engine)"
```
