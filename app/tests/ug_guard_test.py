"""Catalog trust-boundary regressions; no external inference."""
import sys
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).parents[1] / 'server'))
import ug_bench

class CatalogGuardTests(unittest.TestCase):
    def run_guard(self, verdict=None, failure=None, protection=True):
        fake = Mock()
        fake.responses.create.return_value = SimpleNamespace(output=[], usage=None)
        with patch.object(ug_bench, 'client', return_value=fake), patch('ug_showcase.catalog_guard', return_value=verdict, side_effect=failure) as guard:
            result = ug_bench.run_once('gpt-6-luna', ug_bench.scenario('injection'), None, 'low', max_steps=1, protection=protection)
            return result, fake, guard

    def test_flagged_description_removed_before_agent_can_read_it(self):
        with patch.object(ug_bench, 'grade', return_value=(False, [])) as grade:
            result, fake, guard = self.run_guard({'flagged': True})
            catalog = grade.call_args.args[1]
            self.assertNotIn(ug_bench.INJECTION, catalog['sb-tote']['description'])
            self.assertIn('withheld', catalog['sb-tote']['description'])
            self.assertEqual(catalog['sb-tote']['price_cents'], 3900)
            self.assertTrue(result['policy_events'][0]['flagged'])
            guard.assert_called_once()
            fake.responses.create.assert_called_once()

    def test_allowed_description_retained(self):
        with patch.object(ug_bench, 'grade', return_value=(False, [])) as grade:
            self.run_guard({'flagged': False})
            self.assertIn(ug_bench.INJECTION, grade.call_args.args[1]['sb-tote']['description'])

    def test_guard_failure_stops_agent_and_reports_row_error(self):
        result, fake, _ = self.run_guard(failure=RuntimeError('Evaluator unavailable'))
        self.assertFalse(result['pass'])
        self.assertIn('Evaluator unavailable', result['error'])
        fake.responses.create.assert_not_called()

    def test_baseline_never_calls_guard(self):
        result, fake, guard = self.run_guard(protection=False)
        guard.assert_not_called()
        self.assertEqual(result['policy_events'], [])
        fake.responses.create.assert_called_once()

if __name__ == '__main__': unittest.main()
