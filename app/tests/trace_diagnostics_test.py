import importlib.util
import logging
from pathlib import Path
import time
import types
import unittest

spec = importlib.util.spec_from_file_location("trace_diagnostics", Path(__file__).parents[1] / "server/trace_diagnostics.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TraceDiagnosticsTests(unittest.TestCase):
    def test_failure_keeps_only_status_host_path_and_class(self):
        error = RuntimeError("Authorization: Bearer SECRET; response body PRIVATE")
        error.response = types.SimpleNamespace(status_code=403, url="https://user:SECRET@storage.cloud.databricks.com/traces/data?signature=SECRET#PRIVATE")
        result = module.safe_failure(error)
        self.assertEqual(result, {"exception_class": "RuntimeError", "http_status": 403, "host": "storage.cloud.databricks.com", "path": "/traces/data"})
        self.assertNotIn("SECRET", str(result))

    def test_warning_does_not_forward_message_or_traceback(self):
        events = []
        handler = module.TraceDiagnostics(events.append)
        record = logging.LogRecord("mlflow", logging.WARNING, "", 0, "private prompt SECRET tr-12345678123456781234567812345678", (), None)
        handler.emit(record)
        self.assertEqual(events[0]["trace_id"], "tr-12345678123456781234567812345678")
        self.assertNotIn("SECRET", str(events))

    def test_connection_failure_keeps_request_destination_and_deepest_class(self):
        error = RuntimeError("NEVER LOG ME")
        error.request = types.SimpleNamespace(url="https://storage.cloud.databricks.com/traces/data?token=SECRET")
        nested = OSError("NEVER LOG THIS EITHER")
        nested.pool = types.SimpleNamespace(host="storage.cloud.databricks.com", port=443)
        nested.__cause__ = ConnectionRefusedError()
        error.__cause__ = nested
        self.assertEqual(module.safe_failure(error), {"exception_class": "ConnectionRefusedError", "host": "storage.cloud.databricks.com", "path": "/traces/data", "port": 443})

    def test_normal_completion_does_not_flush_or_query_trace_storage(self):
        events = []
        fake = types.SimpleNamespace(get_last_active_trace_id=lambda **_: "tr-location/id")
        module.TraceDiagnostics(events.append).finish(fake)
        self.assertEqual(events, [{"type": "diagnostic", "source": "mlflow", "status": "trace_emitted", "trace_id": "tr-location/id"}])

    def test_verified_status_requires_native_body_read(self):
        events = []
        class Client:
            def get_trace(self, trace_id, display):
                self.trace_id = trace_id
        fake = types.SimpleNamespace(get_last_active_trace_id=lambda **_: "tr-test", flush_trace_async_logging=lambda: None, MlflowClient=Client)
        module.TraceDiagnostics(events.append).finish(fake, probe=True)
        self.assertEqual(events[-1]["status"], "body_verified")

    def test_flush_wait_is_bounded_and_does_not_fail_model(self):
        events = []
        fake = types.SimpleNamespace(get_last_active_trace_id=lambda **_: "tr-test", flush_trace_async_logging=lambda: time.sleep(.1), MlflowClient=lambda: None)
        handler = module.TraceDiagnostics(events.append)
        start = time.monotonic()
        handler.finish(fake, probe=True, wait_seconds=.01)
        self.assertLess(time.monotonic() - start, .08)
        self.assertEqual(events[-1]["status"], "flush_pending")
        handler.thread.join()


if __name__ == "__main__":
    unittest.main()
