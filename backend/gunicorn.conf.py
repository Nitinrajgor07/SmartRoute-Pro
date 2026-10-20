import os
import multiprocessing

# Server socket
port = os.getenv('PORT', '5000')
bind = f"0.0.0.0:{port}"
backlog = 2048

# Worker processes
# Calculate workers based on CPU count, capped for college project scope
default_workers = max(2, min(4, multiprocessing.cpu_count() // 2))
workers = int(os.getenv('WEB_CONCURRENCY', default_workers))
worker_class = 'gthread'
threads = int(os.getenv('GUNICORN_THREADS', 4))
worker_connections = 1000
timeout = int(os.getenv('GUNICORN_TIMEOUT', 60))
keepalive = 5
graceful_timeout = 30

# Process naming
proc_name = 'smartroute_pro_api'

# Logging
accesslog = '-'
errorlog = '-'
loglevel = os.getenv('LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" (%(D)s µs)'

# Security & Proxy
forwarded_allow_ips = '*'
proxy_allow_ips = '*'

def on_starting(server):
    server.log.info("Starting SmartRoute Pro Production WSGI Server (Gunicorn)")
    server.log.info(f"Listening at: {bind} | Workers: {workers} | Threads: {threads}")

def post_fork(server, worker):
    server.log.info(f"Worker spawned (pid: {worker.pid})")
