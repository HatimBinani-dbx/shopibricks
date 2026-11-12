"""Select a provisioned trace store without creating tables or changing its binding."""

DESTINATION_TAG = "mlflow.experiment.databricksTraceDestinationPath"


def configure_trace_destination(mlflow, experiment_id, table_prefix):
    if not table_prefix:
        mlflow.set_experiment(experiment_id=experiment_id)
        return
    parts = table_prefix.split(".")
    if len(parts) != 3 or not all(parts):
        raise ValueError("Trace destination must be catalog.schema.table_prefix")
    experiment = mlflow.get_experiment(experiment_id)
    linked = getattr(experiment, "trace_location", None)
    if (
        experiment.tags.get(DESTINATION_TAG) != table_prefix
        or linked is None
        or linked.full_table_prefix != table_prefix
    ):
        raise ValueError("The experiment is not already linked to the configured trace destination")
    location = mlflow.entities.UnityCatalog(
        catalog_name=parts[0], schema_name=parts[1], table_prefix=parts[2]
    )
    # MLflow 3.18 recognizes the matching existing binding and selects it without
    # provisioning or re-linking. Configuration above prevents its creation path.
    mlflow.set_experiment(experiment_id=experiment_id, trace_location=location)
