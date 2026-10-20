import os
from app import create_app

env = os.getenv('FLASK_ENV', 'development')
app = create_app(env)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '127.0.0.1')
    debug = env == 'development'
    print(f"[*] Starting SmartRoute Pro API server on http://{host}:{port}")
    print(f"[*] Health check available at: http://{host}:{port}/api/health")
    app.run(host=host, port=port, debug=debug)
