"""
Simple WebSocket Test Client for Form-Filling AI

This script connects to the backend and allows you to:
1. Send text messages to Gemini
2. Receive text responses
3. See tool call results

Usage:
    python test_client.py
"""

import asyncio
import json
import os
import websockets


async def test_chat():
    # Use 8080 for Docker (default), 8000 for local development
    port = os.getenv("WS_PORT", "8000")
    uri = f"ws://localhost:{port}/ws"
    
    print("=" * 50)
    print("Form-Filling AI - WebSocket Test Client")
    print("=" * 50)
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected!")
            print("-" * 50)
            print("Type your messages and press Enter to send.")
            print("Type 'quit' to exit.")
            print("-" * 50)
            
            # Start receiver task
            receiver_task = asyncio.create_task(receive_messages(websocket))
            
            # Input loop
            while True:
                try:
                    # Get user input
                    user_input = await asyncio.get_event_loop().run_in_executor(
                        None, input, "\n📝 You: "
                    )
                    
                    if user_input.lower() == 'quit':
                        print("Closing connection...")
                        break
                    
                    if user_input.strip():
                        # Send as text message
                        message = json.dumps({
                            "type": "text",
                            "text": user_input
                        })
                        await websocket.send(message)
                        print(f"   [Sent: {user_input}]")
                        
                except KeyboardInterrupt:
                    print("\nClosing connection...")
                    break
            
            receiver_task.cancel()
            
    except ConnectionRefusedError:
        print("❌ Connection refused! Make sure the backend is running:")
        print("   python app.py")
    except Exception as e:
        print(f"❌ Error: {e}")


async def receive_messages(websocket):
    """Receive and display messages from the server"""
    try:
        async for message in websocket:
            # Check if it's binary (audio) or text
            if isinstance(message, bytes):
                print(f"\n🔊 [Audio: {len(message)} bytes]")
            else:
                try:
                    data = json.loads(message)
                    msg_type = data.get("type", "unknown")
                    
                    if msg_type == "connected":
                        print(f"\n🔗 Connected to model: {data.get('model')}")
                        print(f"   Voice: {data.get('voice')}")
                        features = data.get('features', {})
                        print(f"   Form Automation: {features.get('formAutomation', False)}")
                        
                    elif msg_type == "text":
                        content = data.get("content", "")
                        print(f"\n🤖 Gemini: {content}")
                        
                    elif msg_type == "inputTranscription":
                        text = data.get("text", "")
                        print(f"\n📢 [You said: {text}]")
                        
                    elif msg_type == "outputTranscription":
                        text = data.get("text", "")
                        print(f"\n📝 [AI transcript: {text}]")
                        
                    elif msg_type == "toolResult":
                        func = data.get("function", "")
                        result = data.get("result", {})
                        print(f"\n🔧 Tool: {func}")
                        print(f"   Result: {json.dumps(result, indent=2)}")
                        
                    elif msg_type == "turnComplete":
                        print("\n   [Turn complete - your turn to speak]")
                        
                    elif msg_type == "interrupted":
                        print("\n   [Interrupted]")
                        
                    elif msg_type == "error":
                        print(f"\n❌ Error: {data.get('message')}")
                        
                    else:
                        print(f"\n📨 {msg_type}: {data}")
                        
                except json.JSONDecodeError:
                    print(f"\n📨 Raw: {message}")
                    
    except asyncio.CancelledError:
        pass
    except websockets.exceptions.ConnectionClosed:
        print("\n🔌 Connection closed")


if __name__ == "__main__":
    print("\nStarting test client...")
    asyncio.run(test_chat())
