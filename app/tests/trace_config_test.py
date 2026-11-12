import importlib.util
from pathlib import Path
import types
import unittest

spec = importlib.util.spec_from_file_location("trace_config", Path(__file__).parents[1] / "server/trace_config.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TraceConfigTests(unittest.TestCase):
    def client(self, prefix):
        calls = []
        experiment = types.SimpleNamespace(tags={module.DESTINATION_TAG: prefix}, trace_location=types.SimpleNamespace(full_table_prefix=prefix))
        fake = types.SimpleNamespace(get_experiment=lambda _: experiment, set_experiment=lambda **kwargs: calls.append(kwargs), entities=types.SimpleNamespace(UnityCatalog=lambda **kwargs: kwargs))
        return fake, calls, experiment

    def test_matching_preprovisioned_binding_selects_native_uc_destination(self):
        fake, calls, _ = self.client("catalog.schema.traces")
        module.configure_trace_destination(fake, "123", "catalog.schema.traces")
        self.assertEqual(calls, [{"experiment_id": "123", "trace_location": {"catalog_name": "catalog", "schema_name": "schema", "table_prefix": "traces"}}])

    def test_unbound_experiment_never_enters_native_provisioning_path(self):
        fake, calls, experiment = self.client("catalog.schema.traces")
        experiment.tags = {}
        with self.assertRaises(ValueError):
            module.configure_trace_destination(fake, "123", "catalog.schema.traces")
        self.assertEqual(calls, [])

    def test_different_binding_cannot_be_changed_by_app(self):
        fake, calls, _ = self.client("catalog.schema.original")
        with self.assertRaises(ValueError):
            module.configure_trace_destination(fake, "123", "catalog.schema.traces")
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
