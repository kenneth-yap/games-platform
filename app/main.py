"""Application entry point.

Defines the API surface. For now it exposes a single health-check
endpoint — the minimum needed to prove the service runs and responds.
"""

from fastapi import FastAPI

# The single application instance. Everything (routes, middleware,
# startup hooks) will attach to this object as the project grows.
app = FastAPI(title="Games Platform")


@app.get("/health")
def health_check() -> dict[str, str]:
    """Liveness probe.

    Monitoring systems and load balancers call this to confirm the
    service is alive. It deliberately does no real work — its only job
    is to answer 'yes, I'm running' as cheaply as possible.
    """
    return {"status": "ok"}