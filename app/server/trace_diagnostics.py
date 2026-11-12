"""Bounded MLflow export diagnostics; never forward raw messages or credentials."""
import logging
import re
import threading
from urllib.parse import urlsplit


def safe_failure(exc=None, message=""):
    result = {}
    seen = set()
    while exc is not None and id(exc) not in seen:
        seen.add(id(exc))
        result["exception_class"] = type(exc).__name__
        response = getattr(exc, "response", None)
        if response is not None:
            result["http_status"] = response.status_code
        request = getattr(exc, "request", None)
        url = getattr(response, "url", None) or getattr(request, "url", None)
        if isinstance(url, str):
            parsed = urlsplit(url)
            result["host"] = parsed.hostname
            result["path"] = re.sub(r"/[^/]{80,}", "/[redacted]", parsed.path)[:240]
        # Connection failures have no response. urllib3 retains only the pool or
        # connection on these exceptions; read its host/port, never headers/args text.
        connection = getattr(exc, "pool", None) or getattr(exc, "conn", None)
        if connection is not None:
            host = getattr(connection, "host", None)
            if isinstance(host, str) and re.fullmatch(r"[A-Za-z0-9.:-]+", host):
                result.setdefault("host", host)
            port = getattr(connection, "port", None)
            if isinstance(port, int) and 0 < port < 65536:
                result["port"] = port
        # Some SDK exceptions hold the underlying HTTP exception in their args.
        exc = exc.__cause__ or exc.__context__ or next(
            (arg for arg in exc.args if isinstance(arg, BaseException)), None
        )
    if trace_id := re.search(r"\btr-[0-9a-f]{32}\b", message):
        result["trace_id"] = trace_id.group()
    # No arbitrary warning text, exception text, request headers, or response bodies.
    return result


class TraceDiagnostics(logging.Handler):
    def __init__(self, emit):
        super().__init__(logging.WARNING)
        self.publish = emit
        self.failures = 0
        self.thread = None

    def install(self):
        for name in (
            "mlflow.tracing.export.mlflow_v3",
            "mlflow.tracing.export.async_export_queue",
            "mlflow.tracing.export.uc_table",
        ):
            logger = logging.getLogger(name)
            # These exporters only attach the caught exception at DEBUG. The handler
            # drops all records below WARNING and never formats a traceback/message.
            logger.setLevel(logging.DEBUG)
            logger.handlers = [self]
            logger.propagate = False

    def emit(self, record):
        self.failures += 1
        exc = record.exc_info[1] if record.exc_info else None
        self.publish({
            "type": "diagnostic", "source": "mlflow", "status": "export_warning",
            **safe_failure(exc, record.getMessage()),
        })

    def finish(self, mlflow, probe=False, wait_seconds=3):
        trace_id = mlflow.get_last_active_trace_id(thread_local=True)
        if not trace_id:
            self.publish({"type": "diagnostic", "source": "mlflow", "status": "no_trace_id"})
            return
        self.publish({"type": "diagnostic", "source": "mlflow", "status": "trace_emitted", "trace_id": trace_id})
        # Native UC ingestion batches asynchronously. Reading a UC trace can query
        # a SQL warehouse, so verification is an explicit diagnostic opt-in only.
        if not probe:
            return
        if self.thread and self.thread.is_alive():
            self.publish({"type": "diagnostic", "source": "mlflow", "status": "flush_pending", "trace_id": trace_id})
            return

        def flush_and_probe():
            try:
                mlflow.flush_trace_async_logging()
                self.publish({"type": "diagnostic", "source": "mlflow", "status": "flush_drained", "trace_id": trace_id})
                # The native client verifies stored data; queue drainage alone is not
                # proof of upload, since MLflow catches exporter errors internally.
                self.publish({"type": "diagnostic", "source": "mlflow", "status": "body_probe_started", "trace_id": trace_id})
                mlflow.MlflowClient().get_trace(trace_id, display=False)
                self.publish({"type": "diagnostic", "source": "mlflow", "status": "body_verified", "trace_id": trace_id})
            except Exception as exc:
                self.publish({"type": "diagnostic", "source": "mlflow", "status": "body_unavailable", "trace_id": trace_id, **safe_failure(exc)})

        self.thread = threading.Thread(target=flush_and_probe, name="shopibricks-trace-diagnostic", daemon=True)
        self.thread.start()
        self.thread.join(wait_seconds)
        if self.thread.is_alive():
            self.publish({"type": "diagnostic", "source": "mlflow", "status": "flush_pending", "trace_id": trace_id})
