from typing import Any

import yaml


def load_config(path: str) -> dict[str, Any]:
    """Configuration loader.

    Description:
        Load configuration yaml file into python dictionary.

    Args:
        path (str): Configuration path.

    Returns:
        (Dict[str, Any]): Dictionary of configuration.
    """
    with open(path, encoding="utf-8") as file:
        return yaml.safe_load(file)
