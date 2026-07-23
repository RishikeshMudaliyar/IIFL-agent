"""
Test script to verify Chat and Talk modes work correctly.

Usage:
1. First start the backend: python app.py
2. Then run this test: python test_modes.py
"""

import asyncio
import websockets
import json

async def test_mode(mode):
    """Test WebSocket connection with specified mode."""
    uri = f"ws://localhost:8000/ws?mode={mode}"
    print(f"\n{'='*50}")
    print(f"Testing {mode.upper()} mode")
    print(f"{'='*50}")
    print(f"Connecting to: {uri}")
    
    try:
        async with websockets.connect(uri) as ws:
            print("✓ Connected!")
            
            # Wait for connection response
            response = await ws.recv()
            data = json.loads(response)
            
            if data.get("type") == "connected":
                print(f"✓ Mode: {data.get('mode')}")
                print(f"✓ Model: {data.get('model')}")
                print(f"✓ Output Mode: {data.get('features', {}).get('outputMode')}")
                
                expected_output = "text" if mode == "chat" else "audio"
                if data.get("features", {}).get("outputMode") == expected_output:
                    print(f"✓ PASS: Output mode is correctly set to '{expected_output}'")
                else:
                    print(f"✗ FAIL: Expected outputMode='{expected_output}', got '{data.get('features', {}).get('outputMode')}'")
            else:
                print(f"Unexpected response type: {data.get('type')}")
            
            # Listen for AI greeting
            print("\nWaiting for AI response...")
            message_count = 0
            while message_count < 5:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    message_count += 1
                    
                    # Check if it's binary (audio) or text (JSON)
                    if isinstance(msg, bytes):
                        print(f"  [Audio] Received {len(msg)} bytes")
                    else:
                        try:
                            json_msg = json.loads(msg)
                            msg_type = json_msg.get("type", "unknown")
                            if msg_type == "text":
                                print(f"  [Text] {json_msg.get('content', '')[:100]}")
                            elif msg_type == "toolResult":
                                print(f"  [Tool] {json_msg.get('function', 'unknown')}: {json_msg.get('result', {}).get('success', False)}")
                            elif msg_type == "turnComplete":
                                print(f"  [Turn Complete]")
                                break
                            else:
                                print(f"  [{msg_type}] {str(json_msg)[:80]}")
                        except json.JSONDecodeError:
                            print(f"  [Raw] {msg[:80]}")
                            
                except asyncio.TimeoutError:
                    print("  (timeout - no more messages)")
                    break
                    
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"Connection closed: {e}")
    except Exception as e:
        print(f"✗ Error: {e}")

async def main():
    print("\n" + "="*60)
    print("CHAT/TALK MODE TEST")
    print("Make sure the backend is running: python app.py")
    print("="*60)
    
    # Test chat mode (text only)
    await test_mode("chat")
    
    # Wait a bit between tests
    await asyncio.sleep(2)
    
    # Test talk mode (audio + text)
    await test_mode("talk")
    
    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
