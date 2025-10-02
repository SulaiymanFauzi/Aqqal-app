import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv

load_dotenv()

from api_tools import execute_tool


def _auto_cast(value: str) -> Any:
    lower = value.lower()
    if lower == "true":
        return True
    if lower == "false":
        return False

    if value.startswith("[") or value.startswith("{"):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            pass

    try:
        if value.startswith("0") and value != "0":
            raise ValueError
        return int(value)
    except ValueError:
        try:
            return float(value)
        except ValueError:
            return value


def _parse_args(tokens: Any) -> Dict[str, Any]:
    args: Dict[str, Any] = {}
    for token in tokens:
        if "=" not in token:
            raise SystemExit(f"Argument '{token}' must be in key=value format")
        key, raw_value = token.split("=", 1)
        if not key:
            raise SystemExit("Argument key cannot be empty")
        args[key] = _auto_cast(raw_value)
    return args


def _print_usage() -> None:
    script = Path(__file__).name
    print(
        f"Usage:\n  python {script} <tool_name> [key=value ...]\n\n"
        "Examples:\n"
        "  python {script} searchNarrators limit=3 name_en=Malik\n"
        "  python {script} getSingleHadith hadithVersion=1 editionName=en-bukhari hadithNo=1\n"
        "  python {script} GetSingleTranslation translation_id=21 verse_key=1:1\n"
    )


def main() -> None:
    if len(sys.argv) < 2:
        _print_usage()
        raise SystemExit(1)

    tool_name = sys.argv[1]
    if tool_name in {"-h", "--help"}:
        _print_usage()
        return

    arguments = _parse_args(sys.argv[2:])

    async def _run() -> None:
        result = await execute_tool(tool_name, arguments)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")

    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        raise SystemExit(130)


if __name__ == "__main__":
    main()
