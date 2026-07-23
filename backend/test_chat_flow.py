"""
Test script to reproduce the empty-text-after-tool-call issue.
Simulates the exact history that causes the problem in production.
"""
import asyncio
import json
from google import genai
from google.genai.types import GenerateContentConfig, FunctionDeclaration, Tool
from dotenv import load_dotenv
import os

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

TOOLS = Tool(function_declarations=[
    FunctionDeclaration(
        name="fill_field",
        description="Fill a field in the loan application form",
        parameters={"type": "object", "properties": {"field_name": {"type": "string"}, "value": {"type": "string"}}, "required": ["field_name", "value"]}
    ),
    FunctionDeclaration(
        name="click_button",
        description="Submit the form or click a button",
        parameters={"type": "object", "properties": {"button": {"type": "string"}}, "required": ["button"]}
    ),
])

async def main():
    with open("system_prompt.txt") as f:
        system_prompt = f.read()

    model = "gemini-2.0-flash"
    history = []

    async def call(contents):
        resp = await client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=GenerateContentConfig(system_instruction=system_prompt, tools=[TOOLS]),
        )
        c = resp.candidates[0]
        print(f"  finish_reason: {c.finish_reason}")
        parts = c.content.parts or []
        print(f"  parts ({len(parts)}):")
        for i, p in enumerate(parts):
            fc = getattr(p, 'function_call', None)
            txt = getattr(p, 'text', None)
            print(f"    [{i}] function_call={fc.name if fc and fc.name else None}  text={repr(txt[:60]) if txt else repr(txt)}")
        print(f"  response.text={repr(resp.text)}")
        print(f"  response.function_calls={[fc.name for fc in (resp.function_calls or [])]}")
        return resp

    print("=== Turn 1: Start conversation ===")
    history.append({"role": "user", "parts": [{"text": "Start the conversation."}]})
    r = await call(history)
    history.append(r.candidates[0].content)

    print("\n=== Turn 2: User provides mobile ===")
    history.append({"role": "user", "parts": [{"text": "9876543210"}]})
    r = await call(history)
    history.append(r.candidates[0].content)

    fn_calls = r.function_calls or []
    if fn_calls:
        fc = fn_calls[0]
        print(f"\n  → Executing tool: {fc.name}({dict(fc.args)})")
        # Simulate SUCCESS result (like production)
        success_result = {"success": True, "message": f"Field '{dict(fc.args).get('field_name')}' filled successfully"}
        print(f"  → Tool result: {success_result}")
        history.append({"role": "user", "parts": [{"function_response": {"name": fc.name, "response": success_result}}]})

        print("\n=== Turn 3: After tool success (THE PROBLEMATIC CALL) ===")
        r = await call(history)
        history.append(r.candidates[0].content)

asyncio.run(main())
