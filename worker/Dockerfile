FROM python:3.12-slim
WORKDIR /srv/mf-v3
COPY worker /srv/mf-v3/worker
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MF_STUDIO_ROOT=/data/studio
CMD ["python3","worker/mf_v3_worker.py"]