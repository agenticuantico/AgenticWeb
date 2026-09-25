from __future__ import annotations

import os

import google.auth
from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.apps import App
from google.adk.tools.bigquery import BigQueryCredentialsConfig, BigQueryToolset
from google.adk.tools.preload_memory_tool import PreloadMemoryTool


PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
if not PROJECT_ID:
    raise ValueError("GOOGLE_CLOUD_PROJECT environment variable is required. Set it with: export GOOGLE_CLOUD_PROJECT=<your-project-id>")

credentials, _ = google.auth.default()
bq_toolset = BigQueryToolset(credentials_config=BigQueryCredentialsConfig(credentials=credentials))
agent_engine_id = os.getenv("GOOGLE_CLOUD_AGENT_ENGINE_ID")


async def _save_memory(callback_context: CallbackContext) -> None:
    """Persist the session to Memory Bank when running on Agent Engine."""
    if agent_engine_id:
        await callback_context.add_session_to_memory()


root_agent = LlmAgent(
    name="data_science_agent",
    model=os.getenv("DATA_SCIENCE_MODEL", "gemini-2.5-pro"),
    instruction=(
        "You are the Data Science Agent inside AgentiCuantico. "
        "Analyze authorized enterprise and public BigQuery datasets. "
        "Inspect schemas before querying, execute safe read-only SQL, validate results, "
        "and explain findings in clear Spanish unless another language is requested. "
        "Use the configured Google Cloud project as the billing project unless the user "
        "explicitly specifies another authorized project. Never invent data. State when "
        "a query cannot be executed or the available dataset does not support a conclusion. "
        "Format numbers, percentages and dates clearly. Remember useful user preferences "
        "across sessions when Memory Bank is available."
    ),
    tools=[bq_toolset, PreloadMemoryTool()],
    after_agent_callback=_save_memory,
)


app = App(name="data_science_agent", root_agent=root_agent)