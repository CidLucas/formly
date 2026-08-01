#!/bin/bash
# Sobe o backend do Formly exportando as chaves do ~/.hermes/.env no ambiente do processo
set -a
if [ -f /home/ec2-user/.hermes/.env ]; then
  source /home/ec2-user/.hermes/.env
fi
set +a
cd /home/ec2-user/formly/services/formly
exec .venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0
